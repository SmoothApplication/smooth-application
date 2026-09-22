// Sub-admin-only: invites staff into the CALLER's own department — never an arbitrary one, even
// if a departmentId for another department were passed in (ignored; always uses the caller's own).
import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { generateTempPassword } from '@/lib/temp-password';

export async function POST(request: Request) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Not signed in' }, { status: 401 });

  const { data: me } = await supabase
    .from('admin_users')
    .select('role, department_id')
    .eq('id', user.id)
    .maybeSingle();
  if (me?.role !== 'sub_admin' || !me.department_id) {
    return NextResponse.json({ error: 'Only a sub-admin with a department can invite staff' }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const email = typeof body?.email === 'string' ? body.email.trim().toLowerCase() : '';
  const title = typeof body?.title === 'string' ? body.title.trim() : '';
  if (!email || !title) {
    return NextResponse.json({ error: 'Email and role title are required' }, { status: 400 });
  }

  const admin = createAdminClient();

  const { data: role, error: roleErr } = await admin
    .from('staff_roles')
    .upsert({ department_id: me.department_id, title, created_by: user.id }, { onConflict: 'department_id,title' })
    .select('id')
    .single();
  if (roleErr) return NextResponse.json({ error: roleErr.message }, { status: 500 });

  const { data: existingUsers } = await admin.auth.admin.listUsers();
  let userId = existingUsers?.users.find((u) => u.email?.toLowerCase() === email)?.id;

  // See invite-sub-admin/route.ts for why this sets a temp password directly rather than emailing
  // or linking one.
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
    role: 'staff',
    department_id: me.department_id,
    staff_role_id: role.id,
    invited_by: user.id,
    must_change_password: true,
  });
  if (upsertErr) return NextResponse.json({ error: upsertErr.message }, { status: 500 });

  return NextResponse.json({ ok: true, tempPassword });
}
