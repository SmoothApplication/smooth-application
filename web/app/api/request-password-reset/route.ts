// Task #419 (direct request, after seyiafeni@yahoo.co.uk got locked out of /admin with no way
// back in — had to be fixed by hand via a direct Supabase SQL password update): the login page
// (app/login/page.tsx) had no "forgot password" path at all, for either admins or applicants.
//
// Uses the service-role client, same reason as capture-email/route.ts: generating a recovery link
// for someone who isn't signed in has to run with no session at all.
//
// Deliberately returns the same generic response whether or not the email matches an account —
// otherwise this endpoint would let anyone check which emails have accounts here just by watching
// which response they get back (a classic account-enumeration leak).
import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { sendPasswordResetEmail } from '@/lib/resend';

const GENERIC_RESPONSE = { ok: true, message: 'If that email has an account, a reset link is on its way.' };

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const email = typeof body?.email === 'string' ? body.email.trim().toLowerCase() : '';

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: 'A valid email is required' }, { status: 400 });
  }

  const supabase = createAdminClient();

  const { data: existingUsers } = await supabase.auth.admin.listUsers();
  const user = existingUsers?.users.find((u) => u.email?.toLowerCase() === email);

  if (!user) {
    // Same response as the success path — see file-level comment on why.
    return NextResponse.json(GENERIC_RESPONSE);
  }

  // Send an admin back to /admin and an applicant back to /account after they set the new
  // password, same as how app/login/page.tsx already defaults to /admin and lets middleware.ts
  // bounce non-admins elsewhere — checked directly here instead so an applicant lands on their own
  // checklist rather than getting redirected through '/' first.
  const { data: adminRow } = await supabase.from('admin_users').select('id').eq('id', user.id).maybeSingle();
  const next = adminRow ? '/admin' : '/account';

  const { data: generated, error: genErr } = await supabase.auth.admin.generateLink({
    type: 'recovery',
    email,
    options: { redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL}/reset-password?next=${encodeURIComponent(next)}` },
  });

  if (genErr || !generated?.properties?.action_link) {
    // Don't leak the failure reason to the caller — log server-side only, still return the
    // generic response so behavior stays indistinguishable from the "no such account" case.
    console.error('generateLink (recovery) failed:', genErr?.message);
    return NextResponse.json(GENERIC_RESPONSE);
  }

  await sendPasswordResetEmail({ to: email, resetUrl: generated.properties.action_link });

  return NextResponse.json(GENERIC_RESPONSE);
}
