// Task #421+ (save/report-by-email redesign, direct request): "when you request for your email,
// it will now be sent to your email... create a password to save your document... so you can always
// come back." This is the "email me a copy" half of that — the applicant types their email in
// SaveProgressPanel.tsx, which POSTs here with everything needed to build the report; this route
// builds the ReportPayload server-side (see lib/report/buildReportPayload.ts), renders it to a PDF
// (lib/report/renderReportPdf.ts), and sends it via Resend with a create-password link attached.
//
// Reuses the same find-or-invite pattern as app/api/capture-email/route.ts (generateLink({type:
// 'invite', ...}) rather than inviteUserByEmail, so Supabase's own built-in invite email never
// fires and duplicate this one) — deliberately NOT importing that route's handler directly (route
// handlers aren't meant to be called as functions, and capture-email is already shipped/live; this
// stays a self-contained copy of just the few lines it needs, so nothing here can regress it).
//
// checklist items (ChecklistItem[]) are never sent over the wire in either direction — appliesIf is
// a function and can't survive JSON. Instead this route looks the country's checklist up itself via
// ALL_CHECKLISTS, exactly like useChecklistState does client-side (see lib/checklist/all.ts's own
// header comment for why).
import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { sendReportEmail } from '@/lib/resend';
import { ALL_CHECKLISTS } from '@/lib/checklist/all';
import { Answers, DEFAULT_ANSWERS } from '@/lib/checklist/uk';
import { DEFAULT_FINANCIAL_INPUTS, FinancialInputs } from '@/lib/checklist/financial';
import { deserializeTxns, PersistedStatement } from '@/lib/statement/persist';
import { summarizeStatement, StatementSummary } from '@/lib/statement/combined';
import { buildReportPayload } from '@/lib/report/buildReportPayload';
import { renderReportPdf } from '@/lib/report/renderReportPdf';
import { COUNTRIES } from '@/lib/checklist/countries';

// Fix 2 (technical-co-founder review): this route used to render a PDF full of financial/passport-
// derived data and email it to ANY address a caller supplied, with no check that the requester owns
// that address and no cap on how many times it could be triggered — a spam-relay and NDPR exposure.
// True ownership verification (send a confirm link, only mail the PDF after it's clicked) would
// change the whole "instant" UX of this feature, so as a first, immediately-shippable layer this adds
// rate limiting instead: a request is capped per email address and per rough client IP, checked
// against public.report_request_log (0004_report_email_rate_limit.sql) BEFORE any expensive work
// (PDF render, Resend send, Supabase Auth user creation) happens.
const MAX_PER_EMAIL_PER_HOUR = 3;
const MAX_PER_IP_PER_HOUR = 8;
const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000;

function getClientIp(request: Request): string | null {
  const fwd = request.headers.get('x-forwarded-for');
  if (fwd) return fwd.split(',')[0].trim();
  return request.headers.get('x-real-ip');
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);

  const email = typeof body?.email === 'string' ? body.email.trim().toLowerCase() : '';
  const countryCode = typeof body?.countryCode === 'string' ? body.countryCode.toUpperCase() : '';
  const answers: Answers = body?.answers && typeof body.answers === 'object' ? { ...DEFAULT_ANSWERS, ...body.answers } : DEFAULT_ANSWERS;
  const checked: Record<string, boolean> = body?.checked && typeof body.checked === 'object' ? body.checked : {};
  const financialInputs: FinancialInputs | null =
    body?.financialInputs && typeof body.financialInputs === 'object'
      ? { ...DEFAULT_FINANCIAL_INPUTS, ...body.financialInputs }
      : null;
  const statements: PersistedStatement[] = Array.isArray(body?.statements) ? body.statements : [];

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: 'A valid email is required' }, { status: 400 });
  }

  const countryData = ALL_CHECKLISTS[countryCode];
  if (!countryData) {
    return NextResponse.json({ error: 'Unknown country' }, { status: 400 });
  }

  const ip = getClientIp(request);
  const rateLimitClient = createAdminClient();
  const since = new Date(Date.now() - RATE_LIMIT_WINDOW_MS).toISOString();

  const { count: emailCount } = await rateLimitClient
    .from('report_request_log')
    .select('id', { count: 'exact', head: true })
    .eq('email', email)
    .gte('created_at', since);
  if ((emailCount ?? 0) >= MAX_PER_EMAIL_PER_HOUR) {
    return NextResponse.json(
      { error: "You've requested a lot of reports recently — please wait a bit before trying again." },
      { status: 429 }
    );
  }

  if (ip) {
    const { count: ipCount } = await rateLimitClient
      .from('report_request_log')
      .select('id', { count: 'exact', head: true })
      .eq('ip', ip)
      .gte('created_at', since);
    if ((ipCount ?? 0) >= MAX_PER_IP_PER_HOUR) {
      return NextResponse.json(
        { error: 'Too many report requests from this connection — please try again later.' },
        { status: 429 }
      );
    }
  }

  // Record this attempt regardless of what happens next, so a burst of otherwise-invalid requests
  // (bad country code, malformed payload, etc.) still counts against the caller's limit.
  await rateLimitClient.from('report_request_log').insert({ email, ip });

  const countryInfo = COUNTRIES.find((c) => c.code === countryCode);
  const countryName = countryInfo?.name || countryCode;
  const visaName = countryInfo?.visaName || 'visa';

  const statementSummaries: StatementSummary[] = statements.map((s, i) =>
    summarizeStatement(s.label || `Statement ${i + 1}`, deserializeTxns(s.txns || []))
  );

  const payload = buildReportPayload({
    countryCode,
    countryName,
    visaName,
    checklist: countryData.checklist,
    answers,
    checked,
    financialInputs,
    statementSummaries,
  });

  const pdfBuffer = await renderReportPdf(payload);

  const supabase = rateLimitClient;

  // Find or create the auth user — same generateLink (not inviteUserByEmail) reasoning as
  // capture-email/route.ts: creates the user without Supabase firing its own duplicate email.
  const { data: existingUsers } = await supabase.auth.admin.listUsers();
  let userId = existingUsers?.users.find((u) => u.email?.toLowerCase() === email)?.id;
  let isNewApplicant = false;
  let setPasswordUrl: string | null = null;

  if (!userId) {
    const { data: generated, error: genErr } = await supabase.auth.admin.generateLink({
      type: 'invite',
      email,
      options: { redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL}/create-password` },
    });
    if (genErr || !generated?.user) {
      return NextResponse.json({ error: genErr?.message || 'Could not create account' }, { status: 500 });
    }
    userId = generated.user.id;
    setPasswordUrl = generated.properties?.action_link ?? `${process.env.NEXT_PUBLIC_SITE_URL}/create-password`;
    isNewApplicant = true;
  }

  const now = new Date().toISOString();
  await supabase.from('applicant_profiles').upsert(
    {
      id: userId,
      email,
      country: countryCode,
      percent_complete: payload.docs.percent,
      last_active_at: now,
      ...(isNewApplicant ? { checklist_started_at: now } : {}),
    },
    { onConflict: 'id', ignoreDuplicates: false }
  );

  const { error: emailErr } = await sendReportEmail({ to: email, pdfBuffer, countryName, setPasswordUrl });
  if (emailErr) {
    return NextResponse.json({ error: emailErr.message || 'Could not send report email' }, { status: 500 });
  }

  // Fix 5/2 (technical-co-founder review): this insert used to be fire-and-forget with its error
  // silently discarded. It had ALSO been failing on every single call — the email_type enum never
  // included 'progress_report' until migration 0004 — so the audit trail for report emails has been
  // empty since this feature shipped, invisibly. Now checked and logged so a future schema drift like
  // this shows up in server logs instead of vanishing.
  const { error: logErr } = await supabase.from('email_log').insert({ applicant_id: userId, email_type: 'progress_report' });
  if (logErr) {
    console.error('email-report: failed to write email_log audit row', logErr);
  }

  return NextResponse.json({ ok: true, isNewApplicant });
}
