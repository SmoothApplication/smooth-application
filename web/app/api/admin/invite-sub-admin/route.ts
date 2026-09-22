// Super-admin-only: invites a new sub-admin (e.g. COO/CMO/CTO) into an existing or brand-new
// department. Uses the service-role client for the auth invite step (inviteUserByEmail needs
// admin privileges), but still checks the CALLER's own role first via the request-scoped client
// so a non-super-admin can't hit this endpoint directly and escalate themselves.
import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { generateTempPassword } from '@/lib/temp-password';

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

  // Sets a temp password directly instead of emailing/linking one — see
  // supabase/migrations/0003_temp_password_invites.sql for why. The admin sees this password once,
  // on screen, and shares it with the invitee themselves (text, call, in person). The
  // must_change_password flag below forces them to replace it with their own password on first
  // sign-in, so the shared value is only ever useful for that one login.
  const tempPassword = generateTempPassword();

  if (!userId) {
    const { data: created, error: createErr } = await admin.auth.admin.createUser({
      email,
      password: tempPassword,
      email_confirm: true,
    });
    if (createErr || !created?.user) {
      return NextResponse.json({ error: createErr?.message || 'Could not create user' }, { status: 500 });
    }
    userId = created.user.id;
  } else {
    const { error: updateErr } = await admin.auth.admin.updateUserById(userId, { password: tempPassword });
    if (updateErr) {
      return NextResponse.json({ error: updateErr.message }, { status: 500 });
    }
  }

  const { error: upsertErr } = await admin.from('admin_users').upsert({
    id: userId,
    email,
    role: 'sub_admin',
    department_id: departmentId,
    invited_by: user.id,
    must_change_password: true,
  });
  if (upsertErr) return NextResponse.json({ error: upsertErr.message }, { status: 500 });

  return NextResponse.json({ ok: true, tempPassword });
}
