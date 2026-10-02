// Small presentational helpers shared across the statement-dashboard sub-components
// (AnalysisTab, SourceGroupCard, SenderInflowCard, ReportTab, WorkNameFields) — split out of the
// single 2300+ line StatementDashboard.tsx so each sub-component is independently readable.
import { decodeNarration } from '@/lib/statement';

export function formatAmount(n: number): string {
  if (!n) return '₦0.00';
  return '₦' + n.toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function formatDate(d: Date): string {
  if (!d || Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

// Mirrors index.html's sourceTypeBadge() (~line 14185) — same categories, same intent (a quick visual
// read of what kind of inflow this is), translated to Tailwind pill classes using the app's existing
// accent/good/warn palette instead of bespoke CSS classes.
const SOURCE_TYPE_BADGE: Record<string, { label: string; className: string }> = {
  salary: { label: 'Salary', className: 'bg-accent-wash text-accent' },
  company: { label: 'Business', className: 'bg-good-wash text-good' },
  family: { label: 'Family', className: 'bg-warn-wash text-warn-text' },
  personal: { label: 'Personal', className: 'bg-black/5 text-[#4c6270]' },
  reversal: { label: 'Reversal', className: 'bg-black/5 text-[#4c6270]' },
  self: { label: 'Self', className: 'bg-black/5 text-[#4c6270]' },
  interest: { label: 'Interest', className: 'bg-good-wash text-good' },
  internal: { label: 'Internal transfer', className: 'bg-good-wash text-good' },
  other: { label: 'Unclear sender', className: 'bg-warn-wash text-warn-text' },
};

export function sourceTypeBadge(type: string) {
  return SOURCE_TYPE_BADGE[type] || SOURCE_TYPE_BADGE.other;
}

// Small reusable expandable "what does this mean" detail for one transaction's narration — ported
// UI treatment from index.html's renderNarrationDecodeHtml (~11699-11705), reused wherever this file
// lists individual transactions. Renders nothing when decodeNarration finds nothing worth explaining
// (e.g. a blank or already-plain-English narration), same as the original.
export function NarrationDecoder({ narration }: { narration: string }) {
  const parts = decodeNarration(narration);
  if (!parts.length) return null;
  return (
    <details className="mt-0.5">
      <summary className="cursor-pointer text-[11px] font-medium text-accent">
        🔍 What does this narration mean?
      </summary>
      <table className="mt-1 w-full border-collapse text-left text-[11px]">
        <tbody>
          {parts.map((p, i) => (
            <tr key={i} className="align-top">
              <td className="whitespace-nowrap py-0.5 pr-2 font-mono text-[#12232e]">{p.part}</td>
              <td className="py-0.5 text-[#566a76]">{p.meaning}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </details>
  );
}

// Same idea as index.html's sourceNameIsEditable() (~line 14157) — only a genuinely-extracted sender
// name can be corrected; "Salary", "Other / one-off inflows…" etc. are synthetic labels, not names.
export const NAME_EDITABLE_TYPES = new Set(['personal', 'company', 'family']);

// Explanatory copy per non-income type, same wording/spirit as index.html's noteBlock (~line 14328) —
// tells the applicant WHY a group needs no explanation, rather than leaving it unexplained-looking.
export const NO_EXPLANATION_NOTE: Record<string, string> = {
  reversal:
    'Detected from "RVSL"/"reversal" in the narration, or a credit that matches an earlier failed payment - this is your own money coming back, not new income, so it needs no explanation.',
  self: 'The sender name on these payments matches your own name/account - this looks like money moving between your own accounts, not new income from someone else.',
  interest:
    'Detected from "Interest Earned" in the narration - this is interest your bank/wallet paid on your own savings, not income from a person or company.',
  internal:
    'Detected as a transfer between your own wallet and its savings sub-balance (e.g. OWealth/Targets/SafeBox) - this is your own money moving around, not new income.',
};

export function statusPill(status: 'good' | 'warn' | 'neutral', label: string) {
  const cls =
    status === 'good'
      ? 'bg-good-wash text-good'
      : status === 'warn'
      ? 'bg-warn-wash text-warn-text'
      : 'bg-black/5 text-[#566a76]';
  const icon = status === 'good' ? '✅' : status === 'warn' ? '⚠️' : '➖';
  return (
    <span className={`inline-flex w-fit items-center gap-1 rounded-full px-3 py-1 text-xs font-medium ${cls}`}>
      {icon} {label}
    </span>
  );
}
