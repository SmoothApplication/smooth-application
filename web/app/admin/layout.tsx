import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login?next=/admin');

  const { data: adminRow } = await supabase
    .from('admin_users')
    .select('role, department_id, departments(name)')
    .eq('id', user.id)
    .maybeSingle();

  if (!adminRow) redirect('/');

  return (
    <div className="min-h-screen">
      <header className="flex items-center justify-between border-b border-gray-200 bg-white px-6 py-4">
        <div>
          <span className="font-semibold">Smooth Application — Admin</span>
          <span className="ml-3 rounded-full bg-brand/10 px-2.5 py-0.5 text-xs font-medium text-brand-dark">
            {adminRow.role === 'super_admin' ? 'Super Admin' : adminRow.role === 'sub_admin' ? 'Sub-admin' : 'Staff'}
            {/* @ts-expect-error departments is a joined relation, typed loosely for the scaffold */}
            {adminRow.departments?.name ? ` · ${adminRow.departments.name}` : ''}
          </span>
        </div>
        <nav className="flex gap-4 text-sm">
          <Link href="/admin" className="hover:text-brand">Overview</Link>
          <Link href="/admin/applicants" className="hover:text-brand">Applicants</Link>
          <Link href="/admin/team" className="hover:text-brand">Team</Link>
        </nav>
      </header>
      <div className="mx-auto max-w-6xl p-6">{children}</div>
    </div>
  );
}
