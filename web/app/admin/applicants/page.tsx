import { createClient } from '@/lib/supabase/server';

// "Details of the total applicants" — a real, sortable-by-eye list. Kept server-rendered and
// simple for the scaffold; add pagination once applicant counts get large enough to need it.
export default async function ApplicantsPage() {
  const supabase = createClient();
  const { data: applicants } = await supabase
    .from('applicant_profiles')
    .select('email, country, current_session_key, percent_complete, marked_ready_at, last_active_at, created_at')
    .order('created_at', { ascending: false })
    .limit(200);

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-lg font-semibold">Applicants</h1>
      <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-left text-gray-500">
            <tr>
              <th className="px-4 py-2">Email</th>
              <th className="px-4 py-2">Country</th>
              <th className="px-4 py-2">Current step</th>
              <th className="px-4 py-2">% complete</th>
              <th className="px-4 py-2">Status</th>
              <th className="px-4 py-2">Last active</th>
              <th className="px-4 py-2">Signed up</th>
            </tr>
          </thead>
          <tbody>
            {(applicants ?? []).map((a) => (
              <tr key={a.email} className="border-t border-gray-100">
                <td className="px-4 py-2">{a.email}</td>
                <td className="px-4 py-2">{a.country ?? '—'}</td>
                <td className="px-4 py-2">{a.current_session_key ?? '—'}</td>
                <td className="px-4 py-2">{a.percent_complete}%</td>
                <td className="px-4 py-2">
                  {a.marked_ready_at ? (
                    <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs text-green-700">Completed</span>
                  ) : (
                    <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs text-amber-700">In progress</span>
                  )}
                </td>
                <td className="px-4 py-2 text-gray-500">{a.last_active_at ? new Date(a.last_active_at).toLocaleString() : '—'}</td>
                <td className="px-4 py-2 text-gray-500">{a.created_at ? new Date(a.created_at).toLocaleDateString() : '—'}</td>
              </tr>
            ))}
            {(applicants ?? []).length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-6 text-center text-gray-400">
                  No applicants yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
