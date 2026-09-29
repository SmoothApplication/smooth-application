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

export async function POST(request: Request) {
  try {
    return await handlePost(request);
  } catch (err) {
    // Task #421 hotfix: the first two production attempts at this route both crashed with an
    // opaque 500 (empty response body) — Next.js/Vercel strips uncaught-exception details in
    // production by default, which made the actual cause impossible to see from the client. This
    // temporary catch-all surfaces the real message/stack so the next failure (if any) is
    // diagnosable without another guess-and-redeploy cycle. Safe to remove once this route has
    // been confirmed working end-to-end for a while.
    const message = err instanceof Error ? err.message : String(err);
    const stack = err instanceof Error ? err.stack : undefined;
    console.error('email-report route crashed:', message, stack);
    return NextResponse.json({ error: message, stack }, { status: 500 });
  }
}

async function handlePost(request: Request) {
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

  const supabase = createAdminClient();

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

  await supabase.from('email_log').insert({ applicant_id: userId, email_type: 'progress_report' });

  return NextResponse.json({ ok: true, isNewApplicant });
}
