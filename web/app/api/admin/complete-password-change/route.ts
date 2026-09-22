// Clears must_change_password after a temp-password invitee sets their own password (see
// app/admin/change-password/page.tsx). Needs the service-role client because the RLS policies on
// admin_users only let a super_admin write arbitrary rows, or a sub_admin write into their own
// department's staff rows — nobody is allowed to update their OWN row via the anon/authenticated
// client. This route re-checks the caller is the signed-in user before touching anything, so it
// can only ever clear the flag on the caller's own account.
import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

export async function POST() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Not signed in' }, { status: 401 });

  const admin = createAdminClient();
  const { error } = await admin
    .from('admin_users')
    .update({ must_change_password: false })
    .eq('id', user.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
