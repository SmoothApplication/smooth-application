// Direct instruction on the statement page's Analysis tab: "make sure you request for email once
// the applicant clicks 'download breakdown as spreadsheet'" — the xlsx income-breakdown export
// (Task #432) is still BUILT entirely client-side (StatementDashboard.tsx's handleSendBreakdownEmail:
// same 'xlsx' library, same buildIncomeBreakdownAoa as the old instant-download version), so no bank
// statement data or transaction detail is reconstructed or re-derived here — this route only relays
// the already-built workbook (received as a base64 string) as an email attachment via Resend.
//
// Deliberately a much lighter route than app/api/email-report/route.ts: no Supabase Auth user is
// created, no applicant_profiles row is written, and no create-password link is sent — this is a
// single spreadsheet attachment, not the full checklist/financial/passport report, so it doesn't
// need any of that account-creation machinery. For the same reason this also skips the email_log
// audit insert that email-report/route.ts does: email_log's own email_type enum (0001_init.sql,
// extended in 0004) has no value for this email type, and adding one requires a new migration to be
// created AND actually applied to production — exactly the kind of migration-drift that silently
// broke email_log auditing for months before task #450's fix. Rather than repeat that risk for a
// low-stakes, non-critical audit row, this route just skips it; the rate-limit table below (already
// deployed, no schema change needed) is what actually matters for abuse prevention.
import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { sendIncomeBreakdownEmail } from '@/lib/resend';

// Same anti-abuse pattern and even the same report_request_log table as email-report/route.ts
// (0004_report_email_rate_limit.sql, already applied to production — no new migration needed here).
// Slightly more generous than that route's limits since this is a much cheaper, lower-risk action
// (no PDF render, no account creation) — but still capped, since it's still an unauthenticated
// endpoint that sends email to an address the caller supplies.
const MAX_PER_EMAIL_PER_HOUR = 5;
const MAX_PER_IP_PER_HOUR = 12;
const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000;
const MAX_BASE64_LENGTH = 8_000_000; // ~6MB decoded — generous for a text-only income breakdown

function getClientIp(request: Request): string | null {
  const fwd = request.headers.get('x-forwarded-for');
  if (fwd) return fwd.split(',')[0].trim();
  return request.headers.get('x-real-ip');
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);

  const email = typeof body?.email === 'string' ? body.email.trim().toLowerCase() : '';
  const base64 = typeof body?.base64 === 'string' ? body.base64 : '';

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: 'A valid email is required' }, { status: 400 });
  }
  if (!base64 || base64.length > MAX_BASE64_LENGTH) {
    return NextResponse.json({ error: 'Missing or oversized spreadsheet data' }, { status: 400 });
  }

  let xlsxBuffer: Buffer;
  try {
    xlsxBuffer = Buffer.from(base64, 'base64');
    if (xlsxBuffer.length === 0) throw new Error('empty');
  } catch {
    return NextResponse.json({ error: 'Could not read the spreadsheet data' }, { status: 400 });
  }

  const ip = getClientIp(request);
  const supabase = createAdminClient();
  const since = new Date(Date.now() - RATE_LIMIT_WINDOW_MS).toISOString();

  const { count: emailCount } = await supabase
    .from('report_request_log')
    .select('id', { count: 'exact', head: true })
    .eq('email', email)
    .gte('created_at', since);
  if ((emailCount ?? 0) >= MAX_PER_EMAIL_PER_HOUR) {
    return NextResponse.json(
      { error: "You've requested a lot of emails recently — please wait a bit before trying again." },
      { status: 429 }
    );
  }

  if (ip) {
    const { count: ipCount } = await supabase
      .from('report_request_log')
      .select('id', { count: 'exact', head: true })
      .eq('ip', ip)
      .gte('created_at', since);
    if ((ipCount ?? 0) >= MAX_PER_IP_PER_HOUR) {
      return NextResponse.json(
        { error: 'Too many requests from this connection — please try again later.' },
        { status: 429 }
      );
    }
  }

  // Recorded up front, same as email-report/route.ts, so an invalid/oversized follow-up attempt
  // still counts against the caller's limit.
  await supabase.from('report_request_log').insert({ email, ip });

  const { error: emailErr } = await sendIncomeBreakdownEmail({ to: email, xlsxBuffer });
  if (emailErr) {
    return NextResponse.json({ error: emailErr.message || 'Could not send the email' }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
