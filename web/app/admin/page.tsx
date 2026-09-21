import { createClient } from '@/lib/supabase/server';

// The four numbers explicitly requested: total applicants, applicants per week, applicants who
// have filled the form (marked_ready_at is set), and applicants who have not finished. Visible to
// EVERY admin role (super_admin, sub_admin, staff) — per the founder's spec, analytics visibility
// is not department-scoped, only staff/role MANAGEMENT is (see /admin/team).
export default async function AdminOverviewPage() {
  const supabase = createClient();

  const { count: totalApplicants } = await supabase
    .from('applicant_profiles')
    .select('*', { count: 'exact', head: true });

  const { count: completedApplicants } = await supabase
    .from('applicant_profiles')
    .select('*', { count: 'exact', head: true })
    .not('marked_ready_at', 'is', null);

  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const { count: signedUpThisWeek } = await supabase
    .from('applicant_profiles')
    .select('*', { count: 'exact', head: true })
    .gte('created_at', sevenDaysAgo);

  const total = totalApplicants ?? 0;
  const completed = completedApplicants ?? 0;
  const incomplete = total - completed;

  const { data: byCountry } = await supabase
    .from('applicant_profiles')
    .select('country')
    .not('country', 'is', null);
  const countryCounts = (byCountry ?? []).reduce<Record<string, number>>((acc, row) => {
    const c = row.country || 'Unknown';
    acc[c] = (acc[c] || 0) + 1;
    return acc;
  }, {});

  const stats = [
    { label: 'Total applicants', value: total },
    { label: 'Signed up this week', value: signedUpThisWeek ?? 0 },
    { label: 'Completed checklist', value: completed },
    { label: 'Still in progress', value: incomplete },
  ];

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-lg font-semibold">Overview</h1>
        <p className="text-sm text-gray-500">Live counts from applicant_profiles.</p>
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {stats.map((s) => (
          <div key={s.label} className="rounded-lg border border-gray-200 bg-white p-4">
            <div className="text-2xl font-bold">{s.value.toLocaleString()}</div>
            <div className="text-sm text-gray-500">{s.label}</div>
          </div>
        ))}
      </div>

      <div className="rounded-lg border border-gray-200 bg-white p-4">
        <h2 className="mb-3 text-sm font-semibold text-gray-700">By country</h2>
        {Object.keys(countryCounts).length === 0 ? (
          <p className="text-sm text-gray-500">No applicants with a country set yet.</p>
        ) : (
          <ul className="flex flex-col gap-1 text-sm">
            {Object.entries(countryCounts)
              .sort((a, b) => b[1] - a[1])
              .map(([country, count]) => (
                <li key={country} className="flex justify-between">
                  <span>{country}</span>
                  <span className="font-medium">{count}</span>
                </li>
              ))}
          </ul>
        )}
      </div>
    </div>
  );
}
