'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  ParsedTxn,
  SourceGroup,
  SourceGroups,
  TopConsistentSender,
  buildIncomeSourceBreakdown,
  getTopConsistentSenders,
  findUnexplainedLargeInflows,
  buildPersonalNameTallyMessage,
  SpouseSponsorDeclaration,
  computeWorkNameCheck,
  buildWorkNameCheckMessages,
  WorkNameCheckResult,
} from '@/lib/statement';

// Phase 3 of the bank-statement port (see lib/statement/index.ts for Phase 1, StatementUpload.tsx +
// extractFile.ts for Phase 2). This is the real two-tab dashboard that sits on top of the already-
// working parse/classify pipeline — an "Analysis" tab (who's paying you, grouped and ranked) and a
// "Report" tab (a plain-language readiness summary), adapted from index.html's Income sources
// breakdown / Top 10 senders / Readiness report sections.
//
// Phase 4 lifts applicant name / maiden name / name corrections up to an optional parent (via the
// on*Change callbacks below) so a page can persist them to localStorage - see
// web/app/checklist/uk/statement/page.tsx. Tab choice still resets on reload; that stays local UI
// state. Nothing here talks to the network; everything runs on the ParsedTxn[] already produced
// client-side by extractFile.ts.
//
// Follow-up selection "Narration-based employer/business name check": index.html's own
// "namesToCheck" mechanism (~line 14844-14953) — does the applicant's declared employer/business
// name actually show up as the SENDER on real credit transactions, not just somewhere in the
// document. findInflowsMatchingName/extractNarrationReason/canonicalizeNarrationReason were already
// ported (task #244); this adds the employer/business name inputs themselves (gated on
// employed/selfEmployed, read read-only from the checklist's own answers — same pattern as
// personalNameTally's spouse fields) and the synthesis/messaging in
// lib/statement/workNameCheck.ts. Rendered in the Report tab, where index.html's own later
// restructuring (task #179) already moved this kind of matched-income detail.

function formatAmount(n: number): string {
  if (!n) return '₦0.00';
  return '₦' + n.toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatDate(d: Date): string {
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

function sourceTypeBadge(type: string) {
  return SOURCE_TYPE_BADGE[type] || SOURCE_TYPE_BADGE.other;
}

// Same idea as index.html's sourceNameIsEditable() (~line 14157) — only a genuinely-extracted sender
// name can be corrected; "Salary", "Other / one-off inflows…" etc. are synthetic labels, not names.
const NAME_EDITABLE_TYPES = new Set(['personal', 'company', 'family']);

// Explanatory copy per non-income type, same wording/spirit as index.html's noteBlock (~line 14328) —
// tells the applicant WHY a group needs no explanation, rather than leaving it unexplained-looking.
const NO_EXPLANATION_NOTE: Record<string, string> = {
  reversal:
    'Detected from "RVSL"/"reversal" in the narration, or a credit that matches an earlier failed payment - this is your own money coming back, not new income, so it needs no explanation.',
  self: 'The sender name on these payments matches your own name/account - this looks like money moving between your own accounts, not new income from someone else.',
  interest:
    'Detected from "Interest Earned" in the narration - this is interest your bank/wallet paid on your own savings, not income from a person or company.',
  internal:
    'Detected as a transfer between your own wallet and its savings sub-balance (e.g. OWealth/Targets/SafeBox) - this is your own money moving around, not new income.',
};

interface StatementDashboardProps {
  txns: ParsedTxn[];
  /** Initial values only (uncontrolled) - this component owns the live state internally and
   * reports changes back up via the on*Change callbacks below, so a parent page can persist them
   * (see web/app/checklist/uk/statement/page.tsx, Phase 4) without this component needing to know
   * anything about localStorage itself. */
  applicantName?: string;
  maidenName?: string;
  /** Initial "Fix name" corrections map (see nameCorrections below) - same deal, uncontrolled seed
   * value only. */
  nameCorrections?: Record<string, string>;
  onApplicantNameChange?: (name: string) => void;
  onMaidenNameChange?: (name: string) => void;
  onNameCorrectionsChange?: (corrections: Record<string, string>) => void;
  /** The account-holder name detected on this statement's own header at scan time (owned/persisted
   * by StatementCheck.tsx, read-only here) and the applicant's declared marital/spouse-sponsor
   * status (read-only from the checklist's own answers) — together drive the name-tally check. See
   * lib/statement/personalNameTally.ts. Both optional so the standalone dev page keeps working. */
  detectedHolderName?: string | null;
  spouse?: SpouseSponsorDeclaration;
  /** Whether the applicant declared themselves employed/self-employed (read-only from the
   * checklist's own answers) — gates whether the employer/business name input is shown at all,
   * same as index.html's own namesToCheck construction. */
  employed?: boolean;
  selfEmployed?: boolean;
  employerName?: string;
  employerAltName?: string;
  businessName?: string;
  businessAltName?: string;
  onEmployerNameChange?: (name: string) => void;
  onEmployerAltNameChange?: (name: string) => void;
  onBusinessNameChange?: (name: string) => void;
  onBusinessAltNameChange?: (name: string) => void;
  /** Link to the Report tab's "Financial readiness calculator" cross-reference (see ReportTab
   * below). Defaults to the UK's route so the standalone /checklist/statement-test dev page
   * (StatementUpload.tsx, which doesn't pass this) keeps working unchanged; every real checklist
   * route passes its own country's href via StatementCheck.tsx. */
  financialHref?: string;
}

const DEFAULT_SPOUSE: SpouseSponsorDeclaration = { married: false, spouseSponsoring: false, spouseName: '' };

export default function StatementDashboard({
  txns,
  applicantName: initialApplicantName = '',
  maidenName: initialMaidenName = '',
  nameCorrections: initialNameCorrections,
  onApplicantNameChange,
  onMaidenNameChange,
  onNameCorrectionsChange,
  detectedHolderName = null,
  spouse = DEFAULT_SPOUSE,
  employed = false,
  selfEmployed = false,
  employerName: initialEmployerName = '',
  employerAltName: initialEmployerAltName = '',
  businessName: initialBusinessName = '',
  businessAltName: initialBusinessAltName = '',
  onEmployerNameChange,
  onEmployerAltNameChange,
  onBusinessNameChange,
  onBusinessAltNameChange,
  financialHref = '/checklist/uk/financial',
}: StatementDashboardProps) {
  const [applicantName, setApplicantName] = useState(initialApplicantName);
  const [maidenName, setMaidenName] = useState(initialMaidenName);
  const [employerName, setEmployerName] = useState(initialEmployerName);
  const [employerAltName, setEmployerAltName] = useState(initialEmployerAltName);
  const [businessName, setBusinessName] = useState(initialBusinessName);
  const [businessAltName, setBusinessAltName] = useState(initialBusinessAltName);
  const [tab, setTab] = useState<'analysis' | 'report'>('analysis');

  // Keyed by the RAW extracted name (same key buildIncomeSourceBreakdown and getTopConsistentSenders
  // both produce via senderSideCandidates -> toTitleCase -> mergeNameVariants), so one correction
  // shows up consistently in both the source cards and the Top 10 senders table - same approach as
  // index.html's senderNameCorrections (~line 14156). Phase 4 lifts this to the parent page for
  // persistence via onNameCorrectionsChange; seeded here from the initial value on first render.
  const [nameCorrections, setNameCorrections] = useState<Record<string, string>>(
    initialNameCorrections || {}
  );

  // Report state changes up to the parent for persistence (Phase 4). Deliberately not merged into
  // the setters above - StatementUpload (the standalone test page) passes none of these callbacks,
  // so this is a no-op there, exactly like before.
  useEffect(() => {
    onApplicantNameChange?.(applicantName);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [applicantName]);
  useEffect(() => {
    onMaidenNameChange?.(maidenName);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [maidenName]);
  useEffect(() => {
    onNameCorrectionsChange?.(nameCorrections);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nameCorrections]);
  useEffect(() => {
    onEmployerNameChange?.(employerName);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [employerName]);
  useEffect(() => {
    onEmployerAltNameChange?.(employerAltName);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [employerAltName]);
  useEffect(() => {
    onBusinessNameChange?.(businessName);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [businessName]);
  useEffect(() => {
    onBusinessAltNameChange?.(businessAltName);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [businessAltName]);
  const [editingName, setEditingName] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');

  // Collapsed/expanded per source-group card, keyed by group name. A group starts collapsed once it
  // has more than 3 transactions (set lazily below, on first render of that group).
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({});

  const groups: SourceGroups = useMemo(
    () => buildIncomeSourceBreakdown(txns, applicantName || null, maidenName || null),
    [txns, applicantName, maidenName]
  );

  const topSenders = useMemo(
    () => getTopConsistentSenders(txns, 10, applicantName || null),
    [txns, applicantName]
  );

  const unexplainedInflows = useMemo(() => findUnexplainedLargeInflows(txns), [txns]);

  // Recomputed reactively so typing/correcting the applicant's name after the scan (the normal
  // order of operations here) still triggers the comparison — same idea as the business ledger's
  // own name-tally check, just with the personal-statement wording/spouse-sponsor exception.
  const nameTallyMessage = useMemo(
    () => buildPersonalNameTallyMessage(applicantName, detectedHolderName, spouse),
    [applicantName, detectedHolderName, spouse]
  );

  const employerCheck = useMemo(
    () =>
      employed && employerName.trim()
        ? computeWorkNameCheck({ label: 'employer', name: employerName, altName: employerAltName }, txns)
        : null,
    [employed, employerName, employerAltName, txns]
  );
  const businessCheck = useMemo(
    () =>
      selfEmployed && businessName.trim()
        ? computeWorkNameCheck({ label: 'business', name: businessName, altName: businessAltName }, txns)
        : null,
    [selfEmployed, businessName, businessAltName, txns]
  );

  function displayName(rawName: string): string {
    const corrected = nameCorrections[rawName];
    return corrected && corrected.trim() ? corrected.trim() : rawName;
  }

  function startEditingName(rawName: string) {
    setEditingName(rawName);
    setEditValue(displayName(rawName));
  }

  function saveNameCorrection(rawName: string) {
    setNameCorrections((prev) => {
      const trimmed = editValue.trim();
      const next = { ...prev };
      if (trimmed && trimmed !== rawName) next[rawName] = trimmed;
      else delete next[rawName];
      return next;
    });
    setEditingName(null);
  }

  function isExpanded(g: SourceGroup): boolean {
    const stored = expandedGroups[g.name];
    if (stored !== undefined) return stored;
    return g.txns.length <= 3; // default collapsed only once there's more than 3 to hide
  }

  function toggleExpanded(g: SourceGroup) {
    setExpandedGroups((prev) => ({ ...prev, [g.name]: !isExpanded(g) }));
  }

  // "Total income identified" excludes the buckets that are never real income from someone else:
  // reversals (money bouncing back), self-transfers, interest earned on the applicant's own savings,
  // and internal wallet movements. Everything else - including "Other / one-off inflows" with no
  // clear sender - is still money that came in, so it still counts toward the total.
  const NON_INCOME_TYPES = new Set(['reversal', 'self', 'interest', 'internal']);
  const totalIncomeIdentified = groups
    .filter((g) => !NON_INCOME_TYPES.has(g.type))
    .reduce((sum, g) => sum + g.total, 0);
  const incomeSourceCount = groups.filter((g) => !NON_INCOME_TYPES.has(g.type) && g.type !== 'other').length;

  return (
    <div className="flex flex-col gap-5">
      <div className="grid grid-cols-1 gap-3 rounded-2xl border border-black/10 bg-white p-4 sm:grid-cols-2">
        <div>
          <label className="mb-1 block text-xs font-medium text-[#566a76]" htmlFor="statement-applicant-name">
            Applicant&apos;s full name
          </label>
          <input
            id="statement-applicant-name"
            type="text"
            value={applicantName}
            onChange={(e) => setApplicantName(e.target.value)}
            placeholder="As it appears on the bank account"
            className="w-full rounded-lg border border-black/10 px-3 py-2 text-sm text-[#12232e]"
          />
          <p className="mt-1 text-xs text-[#566a76]">
            Used to tell your own name apart from senders.
          </p>
          {nameTallyMessage && (
            <div
              className={`mt-2 rounded-lg p-3 text-sm ${
                nameTallyMessage.status === 'ok' ? 'bg-good-wash text-good' : 'bg-warn-wash text-warn-text'
              }`}
            >
              {nameTallyMessage.status === 'ok' ? '✅ ' : '⚠️ '}
              {nameTallyMessage.message}
            </div>
          )}
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-[#566a76]" htmlFor="statement-maiden-name">
            Maiden name <span className="font-normal">(optional)</span>
          </label>
          <input
            id="statement-maiden-name"
            type="text"
            value={maidenName}
            onChange={(e) => setMaidenName(e.target.value)}
            placeholder="If the account was opened under a different name"
            className="w-full rounded-lg border border-black/10 px-3 py-2 text-sm text-[#12232e]"
          />
        </div>
      </div>

      <div className="flex gap-1 border-b border-black/10">
        {(
          [
            ['analysis', 'Analysis'],
            ['report', 'Report'],
          ] as const
        ).map(([key, label]) => (
          <button
            key={key}
            type="button"
            onClick={() => setTab(key)}
            className={`-mb-px rounded-t-lg border-b-2 px-4 py-2 text-sm font-medium transition ${
              tab === key
                ? 'border-accent text-accent'
                : 'border-transparent text-[#566a76] hover:text-[#12232e]'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === 'analysis' ? (
        <AnalysisTab
          groups={groups}
          topSenders={topSenders}
          displayName={displayName}
          editingName={editingName}
          editValue={editValue}
          setEditValue={setEditValue}
          startEditingName={startEditingName}
          saveNameCorrection={saveNameCorrection}
          cancelEditingName={() => setEditingName(null)}
          isExpanded={isExpanded}
          toggleExpanded={toggleExpanded}
        />
      ) : (
        <ReportTab
          totalIncomeIdentified={totalIncomeIdentified}
          incomeSourceCount={incomeSourceCount}
          unexplainedInflows={unexplainedInflows}
          financialHref={financialHref}
          employed={employed}
          selfEmployed={selfEmployed}
          employerName={employerName}
          setEmployerName={setEmployerName}
          employerAltName={employerAltName}
          setEmployerAltName={setEmployerAltName}
          businessName={businessName}
          setBusinessName={setBusinessName}
          businessAltName={businessAltName}
          setBusinessAltName={setBusinessAltName}
          employerCheck={employerCheck}
          businessCheck={businessCheck}
        />
      )}
    </div>
  );
}

function AnalysisTab({
  groups,
  topSenders,
  displayName,
  editingName,
  editValue,
  setEditValue,
  startEditingName,
  saveNameCorrection,
  cancelEditingName,
  isExpanded,
  toggleExpanded,
}: {
  groups: SourceGroups;
  topSenders: { list: TopConsistentSender[]; pendingDuplicates: { nameA: string; nameB: string }[] };
  displayName: (rawName: string) => string;
  editingName: string | null;
  editValue: string;
  setEditValue: (v: string) => void;
  startEditingName: (rawName: string) => void;
  saveNameCorrection: (rawName: string) => void;
  cancelEditingName: () => void;
  isExpanded: (g: SourceGroup) => boolean;
  toggleExpanded: (g: SourceGroup) => void;
}) {
  return (
    <div className="flex flex-col gap-5">
      {groups.missingSalaryMonths && groups.missingSalaryMonths.length > 0 && (
        <div className="rounded-lg bg-warn-wash p-3 text-sm text-warn-text">
          Salary looks recurring, but no payment was found for: <b>{groups.missingSalaryMonths.join(', ')}</b>.
          Worth double-checking those months, or explaining the gap.
        </div>
      )}

      <div className="rounded-2xl border border-black/10 bg-white p-6 shadow-sm">
        <h2 className="mb-1 text-sm font-semibold text-[#12232e]">Income sources</h2>
        <p className="mb-4 text-xs text-[#566a76]">
          Every credit on this statement, grouped by who (or what) it came from.
        </p>
        {groups.length === 0 ? (
          <p className="text-sm text-[#566a76]">No credits were found on this statement.</p>
        ) : (
          <div className="flex flex-col gap-3">
            {groups.map((g) => (
              <SourceGroupCard
                key={g.name}
                group={g}
                displayName={displayName}
                editingName={editingName}
                editValue={editValue}
                setEditValue={setEditValue}
                startEditingName={startEditingName}
                saveNameCorrection={saveNameCorrection}
                cancelEditingName={cancelEditingName}
                expanded={isExpanded(g)}
                onToggle={() => toggleExpanded(g)}
              />
            ))}
          </div>
        )}
      </div>

      <div className="rounded-2xl border border-black/10 bg-white p-6 shadow-sm">
        <h2 className="mb-1 text-sm font-semibold text-[#12232e]">Top 10 senders</h2>
        <p className="mb-4 text-xs text-[#566a76]">
          Whoever pays you most consistently - ranked by how many different months they&apos;ve sent
          money in, not just the total amount.
        </p>
        {topSenders.pendingDuplicates.length > 0 && (
          <div className="mb-3 rounded-lg bg-warn-wash p-3 text-sm text-warn-text">
            {topSenders.pendingDuplicates.length} pair(s) of similar names were found (e.g. a bank
            narration that shortens or reorders the same sender&apos;s name) - worth checking by eye
            whether any of these are actually the same person.
          </div>
        )}
        {topSenders.list.length === 0 ? (
          <p className="text-sm text-[#566a76]">No named senders were found on this statement.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-black/10 text-xs uppercase tracking-wide text-[#566a76]">
                  <th className="py-2 pr-2">#</th>
                  <th className="py-2 pr-2">Sender</th>
                  <th className="py-2 pr-2 text-right">Distinct months</th>
                  <th className="py-2 pr-2 text-right">Payment(s)</th>
                  <th className="py-2 text-right">Total</th>
                </tr>
              </thead>
              <tbody>
                {topSenders.list.map((s, i) => (
                  <tr key={s.name} className="border-b border-black/5">
                    <td className="py-2 pr-2 text-[#566a76]">{i + 1}</td>
                    <td className="py-2 pr-2 font-medium text-[#12232e]">{displayName(s.name)}</td>
                    <td className="py-2 pr-2 text-right text-[#12232e]">{s.monthCount}</td>
                    <td className="py-2 pr-2 text-right text-[#12232e]">{s.count}</td>
                    <td className="py-2 text-right text-[#12232e]">{formatAmount(s.total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

function SourceGroupCard({
  group,
  displayName,
  editingName,
  editValue,
  setEditValue,
  startEditingName,
  saveNameCorrection,
  cancelEditingName,
  expanded,
  onToggle,
}: {
  group: SourceGroup;
  displayName: (rawName: string) => string;
  editingName: string | null;
  editValue: string;
  setEditValue: (v: string) => void;
  startEditingName: (rawName: string) => void;
  saveNameCorrection: (rawName: string) => void;
  cancelEditingName: () => void;
  expanded: boolean;
  onToggle: () => void;
}) {
  const badge = sourceTypeBadge(group.type);
  const nameEditable = NAME_EDITABLE_TYPES.has(group.type);
  const isEditingThis = editingName === group.name;
  const note = NO_EXPLANATION_NOTE[group.type];

  return (
    <div className="rounded-xl border border-black/10 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-semibold text-[#12232e]">{displayName(group.name)}</span>
          <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${badge.className}`}>
            {badge.label}
          </span>
          {nameEditable && !isEditingThis && (
            <button
              type="button"
              onClick={() => startEditingName(group.name)}
              className="text-[10px] font-medium text-accent hover:underline"
            >
              ✏️ Fix name
            </button>
          )}
        </div>
        <span className="text-xs text-[#566a76]">
          {group.count} payment{group.count === 1 ? '' : 's'} · {formatAmount(group.total)} ·{' '}
          {formatDate(group.firstDate)} – {formatDate(group.lastDate)}
        </span>
      </div>

      {isEditingThis && (
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <input
            type="text"
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            autoFocus
            className="max-w-xs rounded-lg border border-black/10 px-2 py-1 text-sm text-[#12232e]"
          />
          <button
            type="button"
            onClick={() => saveNameCorrection(group.name)}
            className="rounded-lg bg-accent px-3 py-1 text-xs font-medium text-white"
          >
            Save
          </button>
          <button type="button" onClick={cancelEditingName} className="text-xs text-[#566a76] hover:underline">
            Cancel
          </button>
          <p className="w-full text-xs text-[#566a76]">
            If the bank narration was misread - extra letters or reference codes glued onto the real
            name - correct it here. This only changes what&apos;s displayed; it won&apos;t change which
            payments belong to this sender.
          </p>
        </div>
      )}

      {note && <p className="mt-2 text-xs text-[#566a76]">{note}</p>}

      <div className="mt-2">
        <button type="button" onClick={onToggle} className="text-xs font-medium text-accent hover:underline">
          {expanded ? 'Hide' : 'Show'} individual payment{group.count === 1 ? '' : 's'} ({group.count})
        </button>
        {expanded && (
          <ul className="mt-2 flex flex-col gap-1">
            {group.txns.map((t, i) => (
              <li key={i} className="text-xs text-[#4c6270]">
                {formatDate(t.date)} — {formatAmount(t.credit)}
                {t.narration ? ` ("${t.narration}")` : ' (no narration)'}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

// Simplified adaptation of index.html's readinessStatusMeta/computeReadinessReportRows/
// renderReadinessReport (~lines 13489-13632). The original cross-checked employer/business name
// declarations and a cash-flow calculator's closing-balance verdict - the closing-balance side is a
// separate existing feature at /checklist/uk/financial, not reproduced here; the employer/business
// name cross-check (the "namesToCheck" mechanism, ~14844-14953) is now wired in below (follow-up
// selection "Narration-based employer/business name check") via WorkNameCard.
function statusPill(status: 'good' | 'warn' | 'neutral', label: string) {
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

function ReportTab({
  totalIncomeIdentified,
  incomeSourceCount,
  unexplainedInflows,
  financialHref,
  employed,
  selfEmployed,
  employerName,
  setEmployerName,
  employerAltName,
  setEmployerAltName,
  businessName,
  setBusinessName,
  businessAltName,
  setBusinessAltName,
  employerCheck,
  businessCheck,
}: {
  totalIncomeIdentified: number;
  incomeSourceCount: number;
  unexplainedInflows: ParsedTxn[];
  financialHref: string;
  employed: boolean;
  selfEmployed: boolean;
  employerName: string;
  setEmployerName: (v: string) => void;
  employerAltName: string;
  setEmployerAltName: (v: string) => void;
  businessName: string;
  setBusinessName: (v: string) => void;
  businessAltName: string;
  setBusinessAltName: (v: string) => void;
  employerCheck: WorkNameCheckResult | null;
  businessCheck: WorkNameCheckResult | null;
}) {
  const unexplainedTotal = unexplainedInflows.reduce((s, t) => s + t.credit, 0);
  const incomeStatus: 'good' | 'warn' = unexplainedInflows.length === 0 ? 'good' : 'warn';
  const incomeDetail =
    unexplainedInflows.length === 0
      ? 'No large inflows were flagged as unclear - nice, that\'s one less thing a reviewer could question.'
      : `${unexplainedInflows.length} large inflow${unexplainedInflows.length === 1 ? '' : 's'} (totaling ${formatAmount(
          unexplainedTotal
        )}) still ${unexplainedInflows.length === 1 ? 'has' : 'have'} no clear description - worth explaining in a covering letter, or a reviewer will likely ask.`;

  return (
    <div className="flex flex-col gap-5">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-2xl border border-black/10 bg-white p-4">
          <p className="text-xs text-[#566a76]">Total income identified</p>
          <p className="mt-1 text-lg font-semibold text-[#12232e]">{formatAmount(totalIncomeIdentified)}</p>
        </div>
        <div className="rounded-2xl border border-black/10 bg-white p-4">
          <p className="text-xs text-[#566a76]">Income sources found</p>
          <p className="mt-1 text-lg font-semibold text-[#12232e]">{incomeSourceCount}</p>
        </div>
        <div className="rounded-2xl border border-black/10 bg-white p-4">
          <p className="text-xs text-[#566a76]">Unexplained/unclear inflows</p>
          <p className="mt-1 text-lg font-semibold text-[#12232e]">
            {unexplainedInflows.length}{' '}
            <span className="text-sm font-normal text-[#566a76]">({formatAmount(unexplainedTotal)})</span>
          </p>
        </div>
      </div>

      <div className="rounded-2xl border border-black/10 bg-white p-6 shadow-sm">
        <h2 className="mb-3 text-sm font-semibold text-[#12232e]">Readiness at a glance</h2>
        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-black/10 p-3">
            <div>
              <p className="text-sm font-medium text-[#12232e]">Income status</p>
              <p className="mt-1 text-xs text-[#566a76]">{incomeDetail}</p>
            </div>
            {statusPill(incomeStatus, incomeStatus === 'good' ? 'Looks complete' : 'Needs review')}
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-black/10 p-3">
            <div>
              <p className="text-sm font-medium text-[#12232e]">Balance status</p>
              <p className="mt-1 text-xs text-[#566a76]">
                Closing balance check happens in the{' '}
                <a href={financialHref} className="text-accent hover:underline">
                  Financial readiness calculator
                </a>
                .
              </p>
            </div>
            {statusPill('neutral', 'Not assessed here')}
          </div>
        </div>
      </div>

      {(employed || selfEmployed) && (
        <div className="rounded-2xl border border-black/10 bg-white p-6 shadow-sm">
          <h2 className="mb-1 text-sm font-semibold text-[#12232e]">Employer/business income match</h2>
          <p className="mb-4 text-xs text-[#566a76]">
            Does the employer/business you declared under &quot;Work status&quot; actually show up as the
            sender on real credits in this statement - stronger evidence than its name just appearing
            somewhere on the page.
          </p>
          <div className="flex flex-col gap-4">
            {employed && (
              <WorkNameFields
                label="Employer"
                name={employerName}
                setName={setEmployerName}
                altName={employerAltName}
                setAltName={setEmployerAltName}
                check={employerCheck}
              />
            )}
            {selfEmployed && (
              <WorkNameFields
                label="Business"
                name={businessName}
                setName={setBusinessName}
                altName={businessAltName}
                setAltName={setBusinessAltName}
                check={businessCheck}
              />
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function WorkNameFields({
  label,
  name,
  setName,
  altName,
  setAltName,
  check,
}: {
  label: string;
  name: string;
  setName: (v: string) => void;
  altName: string;
  setAltName: (v: string) => void;
  check: WorkNameCheckResult | null;
}) {
  const idBase = `statement-${label.toLowerCase()}-name`;
  const messages = check ? buildWorkNameCheckMessages(check) : [];
  return (
    <div className="rounded-xl border border-black/10 p-4">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div>
          <label className="mb-1 block text-xs font-medium text-[#566a76]" htmlFor={idBase}>
            {label} name
          </label>
          <input
            id={idBase}
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={`As you entered under "Work status"`}
            className="w-full rounded-lg border border-black/10 px-3 py-2 text-sm text-[#12232e]"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-[#566a76]" htmlFor={`${idBase}-alt`}>
            Also known as <span className="font-normal">(optional)</span>
          </label>
          <input
            id={`${idBase}-alt`}
            type="text"
            value={altName}
            onChange={(e) => setAltName(e.target.value)}
            placeholder="A shorter name/acronym the bank might use instead"
            className="w-full rounded-lg border border-black/10 px-3 py-2 text-sm text-[#12232e]"
          />
        </div>
      </div>

      {messages.map((m, i) => (
        <div
          key={i}
          className={`mt-2 rounded-lg p-3 text-sm ${
            m.status === 'ok'
              ? 'bg-good-wash text-good'
              : m.status === 'warn'
              ? 'bg-warn-wash text-warn-text'
              : 'bg-red-50 text-red-800'
          }`}
        >
          {m.status === 'ok' ? '✅ ' : m.status === 'warn' ? '⚠️ ' : '❌ '}
          {m.message}
        </div>
      ))}

      {check && check.inflowMatches.length > 0 && (
        <div className="mt-2">
          <p className="mb-1 text-xs font-medium text-[#12232e]">
            Matched payment{check.inflowMatches.length === 1 ? '' : 's'} ({check.inflowMatches.length})
          </p>
          <ul className="flex flex-col gap-1">
            {check.inflowMatches.map((t, i) => (
              <li key={i} className="text-xs text-[#4c6270]">
                {formatDate(t.date)} — {formatAmount(t.credit)}
                {t.narration ? ` ("${t.narration}")` : ' (no narration)'}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
