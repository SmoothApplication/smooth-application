// Called from ANYWHERE in the applicant-facing checklist the moment an email is typed in (see the
// "Anywhere an applicant drops email it is recorded" requirement). Idempotent: calling it again
// for the same email just updates progress, never duplicates the profile row.
//
// Uses the service-role client because there is no signed-in user yet — this endpoint is what
// PROVISIONS the auth.users row in the first place, via a passwordless invite. The applicant sets
// their actual password later, from the link in the email this sends.
import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { sendCreatePasswordEmail } from '@/lib/resend';

// The free checklist (index.html) lives on a different origin — GitHub Pages today, possibly a
// custom domain or Netlify mirror later — so this needs CORS headers to be callable from browser
// JS there at all. Wildcarded on purpose: this endpoint takes no cookies/session and was already
// reachable by anyone who could see the URL (it's protected by nothing but the request body being
// a plausible email), so restricting the Origin header wouldn't add real security, just break
// legitimate calls whenever the checklist's hosting domain changes.
const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}

function corsJson(body: Record<string, unknown>, init?: { status?: number }) {
  return NextResponse.json(body, { status: init?.status, headers: CORS_HEADERS });
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const email = typeof body?.email === 'string' ? body.email.trim().toLowerCase() : '';
  const country = typeof body?.country === 'string' ? body.country : null;
  const sessionKey = typeof body?.sessionKey === 'string' ? body.sessionKey : null;
  const percentComplete = Number.isFinite(body?.percentComplete) ? Math.max(0, Math.min(100, body.percentComplete)) : 0;

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return corsJson({ error: 'A valid email is required' }, { status: 400 });
  }

  const supabase = createAdminClient();

  // Find or create the auth user. inviteUserByEmail is idempotent-ish (errors if the user already
  // exists), so check first rather than relying on the error path.
  const { data: existingUsers } = await supabase.auth.admin.listUsers();
  let userId = existingUsers?.users.find((u) => u.email?.toLowerCase() === email)?.id;
  let isNewApplicant = false;

  if (!userId) {
    const { data: invited, error: inviteErr } = await supabase.auth.admin.inviteUserByEmail(email, {
      redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL}/create-password`,
    });
    if (inviteErr || !invited?.user) {
      return corsJson({ error: inviteErr?.message || 'Could not create account' }, { status: 500 });
    }
    userId = invited.user.id;
    isNewApplicant = true;
  }

  const now = new Date().toISOString();
  const { error: upsertErr } = await supabase.from('applicant_profiles').upsert(
    {
      id: userId,
      email,
      country,
      current_session_key: sessionKey,
      percent_complete: percentComplete,
      checklist_started_at: now, // only meaningful on first insert; see ON CONFLICT note below
      last_active_at: now,
    },
    { onConflict: 'id', ignoreDuplicates: false }
  );
  // Note: upsert here will overwrite checklist_started_at on every call. If that matters later,
  // switch to a real upsert-with-coalesce via an RPC — left simple for the first pass since it's
  // not one of the four analytics numbers the Super Admin dashboard actually needs.

  if (upsertErr) {
    return corsJson({ error: upsertErr.message }, { status: 500 });
  }

  if (isNewApplicant) {
    const setPasswordUrl = `${process.env.NEXT_PUBLIC_SITE_URL}/create-password`;
    await sendCreatePasswordEmail({ to: email, setPasswordUrl, country, sessionLabel: sessionKey });
    await supabase.from('email_log').insert({ applicant_id: userId, email_type: 'password_setup' });
  }

  return corsJson({ ok: true });
}
