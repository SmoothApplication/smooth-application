// Super-admin-only: invites a new sub-admin (e.g. COO/CMO/CTO) into an existing or brand-new
// department. Uses the service-role client for the auth invite step (inviteUserByEmail needs
// admin privileges), but still checks the CALLER's own role first via the request-scoped client
// so a non-super-admin can't hit this endpoint directly and escalate themselves.
import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { wrapInviteLink } from '@/lib/invite-link';

export async function POST(request: Request) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Not signed in' }, { status: 401 });

  const { data: me } = await supabase.from('admin_users').select('role').eq('id', user.id).maybeSingle();
  if (me?.role !== 'super_admin') {
    return NextResponse.json({ error: 'Only a super admin can invite sub-admins' }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const email = typeof body?.email === 'string' ? body.email.trim().toLowerCase() : '';
  let departmentId = typeof body?.departmentId === 'string' ? body.departmentId : '';
  const newDepartmentName = typeof body?.newDepartmentName === 'string' ? body.newDepartmentName.trim() : '';

  if (!email) return NextResponse.json({ error: 'Email is required' }, { status: 400 });
  if (!departmentId && !newDepartmentName) {
    return NextResponse.json({ error: 'Pick a department or name a new one' }, { status: 400 });
  }

  const admin = createAdminClient();

  if (!departmentId && newDepartmentName) {
    const { data: dept, error: deptErr } = await admin
      .from('departments')
      .insert({ name: newDepartmentName })
      .select('id')
      .single();
    if (deptErr) return NextResponse.json({ error: deptErr.message }, { status: 500 });
    departmentId = dept.id;
  }

  const { data: existingUsers } = await admin.auth.admin.listUsers();
  let userId = existingUsers?.users.find((u) => u.email?.toLowerCase() === email)?.id;

  // generateLink never sends an email itself — it just creates the user (for type: 'invite') or
  // resolves an existing one (type: 'magiclink') and hands back a one-time sign-in URL. That link
  // is what actually matters: Resend's sandbox sender (onboarding@resend.dev, see lib/resend.ts)
  // can only deliver to the Resend account's own email address, so any automated email to a real
  // teammate silently fails until a custom domain is verified. Until then, the link below is
  // returned to the caller so the admin can copy/paste it to the invitee themselves.
  const redirectTo = `${process.env.NEXT_PUBLIC_SITE_URL}/create-password`;
  let inviteLink: string | null = null;

  if (!userId) {
    const { data: linked, error: linkErr } = await admin.auth.admin.generateLink({
      type: 'invite',
      email,
      options: { redirectTo },
    });
    if (linkErr || !linked?.user) {
      return NextResponse.json({ error: linkErr?.message || 'Could not invite user' }, { status: 500 });
    }
    userId = linked.user.id;
    inviteLink = linked.properties?.action_link ?? null;
  } else {
    const { data: linked, error: linkErr } = await admin.auth.admin.generateLink({
      type: 'magiclink',
      email,
      options: { redirectTo },
    });
    if (!linkErr) inviteLink = linked?.properties?.action_link ?? null;
  }

  const { error: upsertErr } = await admin.from('admin_users').upsert({
    id: userId,
    email,
    role: 'sub_admin',
    department_id: departmentId,
    invited_by: user.id,
  });
  if (upsertErr) return NextResponse.json({ error: upsertErr.message }, { status: 500 });

  return NextResponse.json({ ok: true, inviteLink: inviteLink ? wrapInviteLink(inviteLink) : null });
}
