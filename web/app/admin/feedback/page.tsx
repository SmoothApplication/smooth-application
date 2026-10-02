import { createClient } from '@/lib/supabase/server';
import FeedbackStatusSelect from './FeedbackStatusSelect';

// Task #537/#538 (direct request, following the UX audit): replaces the "share with 50 people"
// one-off poll with an ongoing on-site feedback mechanism — see components/checklist/
// SiteFeedbackPanel.tsx (the widget, on every session page) and app/api/site-feedback/route.ts.
// This admin view is a read of that log, mirroring app/admin/readiness-kits/page.tsx exactly:
// summary stat cards, then a table with a status dropdown per row.
const SENTIMENT_LABELS: Record<string, string> = {
  confusing: '😕 Confusing',
  fine: '🙂 Fine',
  great: '🎉 Great',
};

export default async function FeedbackAdminPage() {
  const supabase = createClient();
  const { data: feedback } = await supabase
    .from('site_feedback')
    .select('id, page_path, country_code, sentiment, message, submitted_at, status')
    .order('submitted_at', { ascending: false })
    .limit(200);

  const rows = feedback ?? [];
  const newCount = rows.filter((r) => r.status === 'new').length;
  const confusingCount = rows.filter((r) => r.sentiment === 'confusing').length;

  // Which page is generating the most complaints — the whole point of logging page_path (see the
  // migration's own comment) rather than just collecting feedback in the abstract.
  const confusingByPage = rows
    .filter((r) => r.sentiment === 'confusing')
    .reduce<Record<string, number>>((acc, r) => {
      acc[r.page_path] = (acc[r.page_path] || 0) + 1;
      return acc;
    }, {});
  const topConfusingPage = Object.entries(confusingByPage).sort((a, b) => b[1] - a[1])[0];

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-lg font-semibold">Site feedback</h1>
        <p className="text-sm text-gray-500">
          Anonymous reactions left on the checklist pages themselves — no name or email, just what
          someone said about the page they were on.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <div className="rounded-lg border border-gray-200 bg-white p-4">
          <div className="text-2xl font-bold">{rows.length}</div>
          <div className="text-sm text-gray-500">Total feedback</div>
        </div>
        <div className="rounded-lg border border-gray-200 bg-white p-4">
          <div className="text-2xl font-bold">{newCount}</div>
          <div className="text-sm text-gray-500">Not yet reviewed</div>
        </div>
        <div className="rounded-lg border border-gray-200 bg-white p-4">
          <div className="text-2xl font-bold">{confusingCount}</div>
          <div className="text-sm text-gray-500">Marked confusing</div>
        </div>
        <div className="rounded-lg border border-gray-200 bg-white p-4">
          <div className="truncate text-2xl font-bold">{topConfusingPage ? topConfusingPage[1] : 0}</div>
          <div className="truncate text-sm text-gray-500">
            {topConfusingPage ? `Top: ${topConfusingPage[0]}` : 'Top confusing page'}
          </div>
        </div>
      </div>

      <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-left text-gray-500">
            <tr>
              <th className="px-4 py-2">Page</th>
              <th className="px-4 py-2">Country</th>
              <th className="px-4 py-2">Reaction</th>
              <th className="px-4 py-2">Message</th>
              <th className="px-4 py-2">Submitted</th>
              <th className="px-4 py-2">Status</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-t border-gray-100">
                <td className="px-4 py-2 font-mono text-xs">{r.page_path}</td>
                <td className="px-4 py-2 text-gray-500">{r.country_code ?? '—'}</td>
                <td className="px-4 py-2">{r.sentiment ? SENTIMENT_LABELS[r.sentiment] ?? r.sentiment : '—'}</td>
                <td className="max-w-xs px-4 py-2 text-gray-700">{r.message || '—'}</td>
                <td className="px-4 py-2 text-gray-500">
                  {r.submitted_at ? new Date(r.submitted_at).toLocaleString() : '—'}
                </td>
                <td className="px-4 py-2">
                  <FeedbackStatusSelect id={r.id} status={r.status} />
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-6 text-center text-gray-400">
                  No feedback yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
