import { createClient } from '@/lib/supabase/server';
import StatusSelect from './StatusSelect';

// Direct request: "No record-keeping for Readiness Kit requests... A lightweight admin view of
// review requests could help if volume picks up: create it." Every "Get my ___ Review" click on
// the homepage (components/ReadinessKits.tsx) logs a row here via app/api/readiness-kit-request's
// POST — this page is just a read view of that log, same server-rendered-table pattern as
// app/admin/applicants/page.tsx, plus a status dropdown so a request can be marked contacted/done
// instead of the list growing forever with no way to track what's been actioned.
//
// Deliberately NOT a CRM: there's no name, email or phone number on these rows (see the
// migration's own comment on why — a homepage click carries no identity until the applicant
// actually messages on WhatsApp), just a count of what was requested and when.
const KIT_LABELS: Record<string, string> = {
  document_review: 'Document Review',
  full_case_review: 'Full Case Review + Correction Plan',
};

export default async function ReadinessKitsAdminPage() {
  const supabase = createClient();
  const { data: requests } = await supabase
    .from('readiness_kit_requests')
    .select('id, kit, price_label, requested_at, status')
    .order('requested_at', { ascending: false })
    .limit(200);

  const rows = requests ?? [];
  const counts = rows.reduce<Record<string, number>>((acc, r) => {
    acc[r.kit] = (acc[r.kit] || 0) + 1;
    return acc;
  }, {});
  const newCount = rows.filter((r) => r.status === 'new').length;

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-lg font-semibold">Readiness Kit requests</h1>
        <p className="text-sm text-gray-500">
          Every &quot;Get my ___&quot; click from the homepage&apos;s Readiness Kits section. No contact
          details — just what was requested and when; the actual conversation happens on WhatsApp.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <div className="rounded-lg border border-gray-200 bg-white p-4">
          <div className="text-2xl font-bold">{rows.length}</div>
          <div className="text-sm text-gray-500">Total requests</div>
        </div>
        <div className="rounded-lg border border-gray-200 bg-white p-4">
          <div className="text-2xl font-bold">{newCount}</div>
          <div className="text-sm text-gray-500">Not yet contacted</div>
        </div>
        <div className="rounded-lg border border-gray-200 bg-white p-4">
          <div className="text-2xl font-bold">{counts.document_review ?? 0}</div>
          <div className="text-sm text-gray-500">Document Review</div>
        </div>
        <div className="rounded-lg border border-gray-200 bg-white p-4">
          <div className="text-2xl font-bold">{counts.full_case_review ?? 0}</div>
          <div className="text-sm text-gray-500">Full Case Review</div>
        </div>
      </div>

      <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-left text-gray-500">
            <tr>
              <th className="px-4 py-2">Kit</th>
              <th className="px-4 py-2">Price</th>
              <th className="px-4 py-2">Requested</th>
              <th className="px-4 py-2">Status</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-t border-gray-100">
                <td className="px-4 py-2">{KIT_LABELS[r.kit] ?? r.kit}</td>
                <td className="px-4 py-2">{r.price_label}</td>
                <td className="px-4 py-2 text-gray-500">
                  {r.requested_at ? new Date(r.requested_at).toLocaleString() : '—'}
                </td>
                <td className="px-4 py-2">
                  <StatusSelect id={r.id} status={r.status} />
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-6 text-center text-gray-400">
                  No Readiness Kit requests yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
