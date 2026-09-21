import { createClient } from '@/lib/supabase/server';
import InviteSubAdminForm from './InviteSubAdminForm';
import InviteStaffForm from './InviteStaffForm';

// Role management. Super Admin sees + can invite sub-admins into any department; a sub-admin sees
// this same page but only the "invite staff into MY department" form renders for them (enforced
// again server-side by RLS on admin_users/staff_roles — this UI gating is a convenience, not the
// actual security boundary).
export default async function TeamPage() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const { data: me } = await supabase
    .from('admin_users')
    .select('role, department_id')
    .eq('id', user!.id)
    .maybeSingle();

  const { data: departments } = await supabase.from('departments').select('id, name').order('name');

  const { data: roster } = await supabase
    .from('admin_users')
    .select('email, role, department_id, departments(name)')
    .order('role');

  const isSuperAdmin = me?.role === 'super_admin';
  const isSubAdmin = me?.role === 'sub_admin';

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-lg font-semibold">Team</h1>
        <p className="text-sm text-gray-500">
          {isSuperAdmin
            ? 'Assign COO / CMO / CTO (and any other department head) as sub-admins.'
            : isSubAdmin
            ? 'Create staff roles and invite staff into your own department.'
            : 'Read-only — staff accounts cannot manage the roster.'}
        </p>
      </div>

      {isSuperAdmin && <InviteSubAdminForm departments={departments ?? []} />}
      {isSubAdmin && me?.department_id && <InviteStaffForm departmentId={me.department_id} />}

      <div className="rounded-lg border border-gray-200 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-left text-gray-500">
            <tr>
              <th className="px-4 py-2">Email</th>
              <th className="px-4 py-2">Role</th>
              <th className="px-4 py-2">Department</th>
            </tr>
          </thead>
          <tbody>
            {(roster ?? []).map((r) => (
              <tr key={r.email} className="border-t border-gray-100">
                <td className="px-4 py-2">{r.email}</td>
                <td className="px-4 py-2 capitalize">{r.role.replace('_', ' ')}</td>
                {/* @ts-expect-error departments is a joined relation, typed loosely for the scaffold */}
                <td className="px-4 py-2">{r.departments?.name ?? '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
