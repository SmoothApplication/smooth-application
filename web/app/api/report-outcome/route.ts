// Fix 1 (technical-co-founder review, launch-day priority): the other half of the outcome-tracking
// follow-up loop started in app/api/email-report/route.ts. This is the one-click GET a link in the
// report email's footer hits — no page to load, no form to fill in, just "I've applied" / "I was
// approved" / "I was refused". Deliberately public and deliberately dumb: it trusts nothing but the
// token (an unguessable uuid, meaningless on its own — see migration 0005_report_outcomes.sql's own
// comment on why a token and never the applicant's email), and it can only ever set THAT token's own
// outcome field, never read or touch anything else.
//
// A stale or already-clicked link, an unknown token, or a malformed result all resolve to the same
// friendly confirmation page rather than an error — this is a courtesy one-click link from an email,
// not a form a user is expected to get right, and there's nothing sensitive to protect by
// distinguishing "not found" from "already answered" here.
import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';

const VALID_OUTCOMES = new Set(['applied', 'approved', 'refused']);

function confirmationPage(message: string) {
  return new NextResponse(
    `<!doctype html>
<html>
<head><meta charset="utf-8" /><title>Thank you — Smooth Application</title></head>
<body style="font-family:system-ui,sans-serif;max-width:480px;margin:80px auto;text-align:center;color:#12232e;">
  <h1 style="font-size:20px;">✅ ${message}</h1>
  <p style="color:#566a76;font-size:14px;">You can close this tab now.</p>
</body>
</html>`,
    { status: 200, headers: { 'Content-Type': 'text/html; charset=utf-8' } }
  );
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const token = searchParams.get('token');
  const result = searchParams.get('result');

  if (!token || !result || !VALID_OUTCOMES.has(result)) {
    return confirmationPage("Thanks — that link wasn't quite right, but we appreciate you letting us know.");
  }

  const supabase = createAdminClient();
  const { error } = await supabase
    .from('report_outcomes')
    .update({ outcome: result, outcome_recorded_at: new Date().toISOString() })
    .eq('token', token);

  if (error) {
    console.error('report-outcome: failed to record outcome', error);
  }

  return confirmationPage('Got it — thanks for letting us know!');
}
