'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  ParsedTxn,
  SourceGroup,
  SourceGroups,
  buildIncomeSourceBreakdown,
  getTopConsistentSenders,
  getTopInflows,
  buildIncomeBreakdownAoa,
  findUnexplainedLargeInflows,
  buildPersonalNameTallyMessage,
  SpouseSponsorDeclaration,
  computeWorkNameCheck,
  WorkCategoryMap,
  computeMonthlyCashFlow,
  MonthlyCashFlowRow,
  computeIncomeMatch,
  computeStatementCurrency,
  buildStatementCurrencyWarning,
  groupFlaggedInflows,
  StatementSummary,
  nestFlaggedGroupsBySender,
  SenderInflowGroup,
  buildFlaggedTxnReasons,
  suggestReasonForGroup,
  reviewStatusFor,
  REVIEW_STATUS_LABEL,
} from '@/lib/statement';
import { trackEvent } from '@/lib/analytics';
// computeMonthlyCashFlow (cashFlow.ts) and computeFinancials (checklist/financial.ts) drive the
// Report tab's "Monthly cash flow" table and "Financial summary" block, using the exact same
// formulas as the Financial readiness calculator so the two stay in agreement rather than being a
// second, possibly-drifting reimplementation. Buffer-dependent rows (2x recommended funds, amount
// still needed, time to reach it) need a trip cost from the calculator page, so those link out
// there instead of showing a meaningless ₦0 when no cost has been entered.
import { computeFinancials, DEFAULT_FINANCIAL_INPUTS } from '@/lib/checklist/financial';
import { NO_EXPLANATION_NOTE } from './statement-dashboard/shared';

// The three selectable inflow floors; the first is the default and is also the hard minimum.
const INFLOW_FLOOR_OPTIONS = [50000, 100000, 200000];
import { AnalysisTab } from './statement-dashboard/AnalysisTab';
import { ReportTab } from './statement-dashboard/ReportTab';

// Two-tab bank-statement dashboard sitting on top of the parse/classify pipeline (lib/statement):
// an "Analysis" tab (who's paying you, grouped and ranked) and a "Report" tab (a plain-language
// readiness summary). Applicant name/maiden name/name corrections are lifted to an optional parent
// via the on*Change callbacks below so a page can persist them (see
// app/checklist/uk/statement/page.tsx); tab choice itself stays local UI state. Nothing here talks
// to the network — everything runs on the ParsedTxn[] already produced client-side by extractFile.ts.
//
// The employer/business name-match check (findInflowsMatchingName/workNameCheck.ts) verifies the
// applicant's declared employer/business name actually appears as the SENDER on real credit
// transactions, not just somewhere in the document; rendered in the Report tab alongside other
// matched-income detail.
//
// decodeNarration()/BANK_NARRATION_GLOSSARY (names.ts) power the <NarrationDecoder> "What does this
// narration mean?" expandable, reused on every transaction line (SourceGroupCard's expanded list and
// WorkNameFields' matched-payments list). detectWorkPaymentCategory/WORK_PAYMENT_REASON_CATEGORIES
// (classify.ts) power the category <select> next to each matched payment in WorkNameFields,
// pre-selected from that payment's narration (workNameCheck.ts's inflowCategoryHints) but editable
// and persisted per employer/business (workNameCheck.ts's WorkCategoryMap) — two separate maps since
// an applicant can be both employed and self-employed with different payments for each.

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
  /** Restores the original GitHub Pages site's free-text "Your explanation" column per income
   * source (confirmed missing in a live parity check against the original) — keyed by the same RAW
   * extracted name as nameCorrections, uncontrolled-seed-plus-callback like everything else here. */
  explanations?: Record<string, string>;
  onExplanationsChange?: (explanations: Record<string, string>) => void;
  /** Restores the interactive half of the original's duplicate-sender prompt — this port only ever
   * surfaced the passive "N pair(s) of similar names were found" warning, with no way to actually
   * answer it (see getTopConsistentSenders's own comment). Keyed by senderPairKey(nameA, nameB),
   * same uncontrolled-seed-plus-callback pattern as everything else here. */
  senderDuplicateDecisions?: Record<string, 'merge' | 'separate'>;
  onSenderDuplicateDecisionsChange?: (decisions: Record<string, 'merge' | 'separate'>) => void;
  /** Direct instruction (see lib/statement/flaggedReasons.ts): the applicant's "same purpose" /
   * "different purposes" choice, canonical reason-dropdown pick, and any typed "Other" detail, for
   * each unexplained-inflow sender card. Same uncontrolled-seed-plus-callback pattern as everything
   * else in this props list. */
  flaggedReasonMode?: Record<string, 'same' | 'different'>;
  onFlaggedReasonModeChange?: (mode: Record<string, 'same' | 'different'>) => void;
  flaggedReasonChoice?: Record<string, string>;
  onFlaggedReasonChoiceChange?: (choice: Record<string, string>) => void;
  flaggedReasonOther?: Record<string, string>;
  onFlaggedReasonOtherChange?: (other: Record<string, string>) => void;
  /** The account-holder name detected on this statement's own header at scan time (owned/persisted
   * by StatementCheck.tsx, read-only here) and the applicant's declared marital/spouse-sponsor
   * status (read-only from the checklist's own answers) — together drive the name-tally check. See
   * lib/statement/personalNameTally.ts. Both optional so the standalone dev page keeps working. */
  detectedHolderName?: string | null;
  /** Fix 3 (technical-co-founder review, no AI/LLM per direct instruction): true when this
   * statement's lines came from on-device OCR (a scanned/photographed statement) rather than a
   * real digital text layer or spreadsheet export — a known fact about how it was read, not a
   * guess about accuracy. Drives a plain "please double-check this" banner rather than pretending
   * to grade the parse. See extractFile.ts's getLinesFromFileWithMeta. */
  ocrUsed?: boolean;
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
  /** The applicant's own confirmed/corrected category per matched employer/business payment (see
   * workNameCheck.ts's WorkCategoryMap) - owned/persisted by the parent page, same uncontrolled-
   * seed-plus-callback pattern as everything else in this props list. */
  employerCategoryChoices?: WorkCategoryMap;
  businessCategoryChoices?: WorkCategoryMap;
  onEmployerCategoryChoicesChange?: (choices: WorkCategoryMap) => void;
  onBusinessCategoryChoicesChange?: (choices: WorkCategoryMap) => void;
  /** Declared-vs-actual income mismatch check (lib/statement/incomeMatch.ts) — the applicant's own
   * typed monthly income claim for each of employer/business, compared against what actually lands
   * from that name in this statement. 0 means "not entered yet" (check stays dormant). Same
   * uncontrolled-seed-plus-callback pattern as employerName/businessName above. */
  employerDeclaredMonthlyIncome?: number;
  onEmployerDeclaredMonthlyIncomeChange?: (v: number) => void;
  businessDeclaredMonthlyIncome?: number;
  onBusinessDeclaredMonthlyIncomeChange?: (v: number) => void;
  /** Link to the Report tab's "Financial readiness calculator" cross-reference (see ReportTab
   * below). Defaults to the UK's route so the standalone /checklist/statement-test dev page
   * (StatementUpload.tsx, which doesn't pass this) keeps working unchanged; every real checklist
   * route passes its own country's href via StatementCheck.tsx. */
  financialHref?: string;
  /** Direct instruction: "read the balance on the dollar account and read the balance on the other
   * account... I did it to see before it even under financial readiness" — the OTHER uploaded
   * statement's summary (from StatementCheck.tsx's two-slot setup), surfaced as an informational row
   * inside THIS statement's Financial readiness table. Not scored/added into this statement's own
   * closing-balance status - shown so the applicant (and a reviewer reading the report) can see the
   * fuller picture without leaving this card. Null/undefined when no second statement is uploaded. */
  otherStatementSummary?: StatementSummary | null;
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
  explanations: initialExplanations,
  onExplanationsChange,
  senderDuplicateDecisions: initialSenderDuplicateDecisions,
  onSenderDuplicateDecisionsChange,
  flaggedReasonMode: initialFlaggedReasonMode,
  onFlaggedReasonModeChange,
  flaggedReasonChoice: initialFlaggedReasonChoice,
  onFlaggedReasonChoiceChange,
  flaggedReasonOther: initialFlaggedReasonOther,
  onFlaggedReasonOtherChange,
  detectedHolderName = null,
  ocrUsed = false,
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
  employerCategoryChoices: initialEmployerCategoryChoices,
  businessCategoryChoices: initialBusinessCategoryChoices,
  onEmployerCategoryChoicesChange,
  onBusinessCategoryChoicesChange,
  employerDeclaredMonthlyIncome: initialEmployerDeclaredMonthlyIncome = 0,
  onEmployerDeclaredMonthlyIncomeChange,
  businessDeclaredMonthlyIncome: initialBusinessDeclaredMonthlyIncome = 0,
  onBusinessDeclaredMonthlyIncomeChange,
  financialHref = '/checklist/uk/financial',
  otherStatementSummary = null,
}: StatementDashboardProps) {
  const [applicantName, setApplicantName] = useState(initialApplicantName);
  const [maidenName, setMaidenName] = useState(initialMaidenName);
  const [employerName, setEmployerName] = useState(initialEmployerName);
  const [employerAltName, setEmployerAltName] = useState(initialEmployerAltName);
  const [businessName, setBusinessName] = useState(initialBusinessName);
  const [businessAltName, setBusinessAltName] = useState(initialBusinessAltName);
  const [employerCategoryChoices, setEmployerCategoryChoices] = useState<WorkCategoryMap>(
    initialEmployerCategoryChoices || {}
  );
  const [businessCategoryChoices, setBusinessCategoryChoices] = useState<WorkCategoryMap>(
    initialBusinessCategoryChoices || {}
  );
  const [employerDeclaredMonthlyIncome, setEmployerDeclaredMonthlyIncome] = useState(
    initialEmployerDeclaredMonthlyIncome
  );
  const [businessDeclaredMonthlyIncome, setBusinessDeclaredMonthlyIncome] = useState(
    initialBusinessDeclaredMonthlyIncome
  );
  // Direct user report: "when you put in your bank statement, the first thing it shows is a
  // report" - the Report tab (plain-language readiness summary) was meant to be what an applicant
  // sees first after uploading, matching the original GitHub Pages app's own flow, not the
  // Analysis tab's raw per-sender breakdown. Still just a UI default - switching tabs afterward
  // works exactly the same either way.
  const [tab, setTab] = useState<'analysis' | 'report'>('report');

  // Task follow-up: "it is not extracting name from bank statement" -- detectedHolderName was
  // already being computed (extractAccountHolderName in lib/statement/names.ts) but only ever fed
  // into buildPersonalNameTallyMessage as a cross-check against a manually-typed name; a
  // successful detection was silently discarded instead of ever reaching the applicant's own
  // "Full name" field. This seeds the field from the detected name the first time one becomes
  // available, but only while the field is still empty -- never overwrites something the
  // applicant already typed (including a typed name that was there before analysis ran), and
  // still leaves the tally-check logic in buildPersonalNameTallyMessage untouched below.
  useEffect(() => {
    if (detectedHolderName && !applicantName.trim()) {
      setApplicantName(detectedHolderName);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [detectedHolderName]);

  // Keyed by the RAW extracted name (same key buildIncomeSourceBreakdown and getTopConsistentSenders
  // both produce via senderSideCandidates -> toTitleCase -> mergeNameVariants), so one correction
  // shows up consistently in both the source cards and the Top 10 senders table - same approach as
  // index.html's senderNameCorrections (~line 14156). Phase 4 lifts this to the parent page for
  // persistence via onNameCorrectionsChange; seeded here from the initial value on first render.
  const [nameCorrections, setNameCorrections] = useState<Record<string, string>>(
    initialNameCorrections || {}
  );
  const [explanations, setExplanations] = useState<Record<string, string>>(initialExplanations || {});
  const [senderDuplicateDecisions, setSenderDuplicateDecisions] = useState<Record<string, 'merge' | 'separate'>>(
    initialSenderDuplicateDecisions || {}
  );
  const [flaggedReasonMode, setFlaggedReasonMode] = useState<Record<string, 'same' | 'different'>>(
    initialFlaggedReasonMode || {}
  );
  const [flaggedReasonChoice, setFlaggedReasonChoice] = useState<Record<string, string>>(
    initialFlaggedReasonChoice || {}
  );
  const [flaggedReasonOther, setFlaggedReasonOther] = useState<Record<string, string>>(
    initialFlaggedReasonOther || {}
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
    onExplanationsChange?.(explanations);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [explanations]);
  useEffect(() => {
    onSenderDuplicateDecisionsChange?.(senderDuplicateDecisions);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [senderDuplicateDecisions]);
  useEffect(() => {
    onFlaggedReasonModeChange?.(flaggedReasonMode);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [flaggedReasonMode]);
  useEffect(() => {
    onFlaggedReasonChoiceChange?.(flaggedReasonChoice);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [flaggedReasonChoice]);
  useEffect(() => {
    onFlaggedReasonOtherChange?.(flaggedReasonOther);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [flaggedReasonOther]);

  function setFlaggedMode(key: string, value: 'same' | 'different') {
    setFlaggedReasonMode((prev) => ({ ...prev, [key]: value }));
  }
  function setFlaggedChoice(key: string, value: string) {
    setFlaggedReasonChoice((prev) => {
      const next = { ...prev };
      if (value) next[key] = value;
      else delete next[key];
      return next;
    });
  }
  function setFlaggedOther(key: string, value: string) {
    setFlaggedReasonOther((prev) => {
      const next = { ...prev };
      if (value.trim()) next[key] = value;
      else delete next[key];
      return next;
    });
  }

  function resolveSenderDuplicate(key: string, decision: 'merge' | 'separate') {
    setSenderDuplicateDecisions((prev) => ({ ...prev, [key]: decision }));
  }

  function setExplanation(rawName: string, value: string) {
    setExplanations((prev) => {
      const next = { ...prev };
      if (value.trim()) next[rawName] = value;
      else delete next[rawName];
      return next;
    });
  }
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
  useEffect(() => {
    onEmployerCategoryChoicesChange?.(employerCategoryChoices);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [employerCategoryChoices]);
  useEffect(() => {
    onBusinessCategoryChoicesChange?.(businessCategoryChoices);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [businessCategoryChoices]);
  useEffect(() => {
    onEmployerDeclaredMonthlyIncomeChange?.(employerDeclaredMonthlyIncome);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [employerDeclaredMonthlyIncome]);
  useEffect(() => {
    onBusinessDeclaredMonthlyIncomeChange?.(businessDeclaredMonthlyIncome);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [businessDeclaredMonthlyIncome]);
  const [editingName, setEditingName] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');

  // Collapsed/expanded per source-group card, keyed by group name. A group starts collapsed once it
  // has more than 3 transactions (set lazily below, on first render of that group).
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({});

  // User request: a selectable inflow floor (₦50,000 / ₦100,000 / ₦200,000) so the statement can be read
  // at different levels of "significant", and everything below ₦50,000 is strictly ignored. Reversals
  // are dropped from this report entirely ("not inflows needed by the consular"). The cash-flow table
  // and financial summary below keep using every transaction on purpose: they describe the account's
  // real money movement, not which individual senders to explain.
  const [minInflow, setMinInflow] = useState<number>(INFLOW_FLOOR_OPTIONS[0]);
  const qualifyingTxns = useMemo(
    () => txns.filter((t) => !t.credit || t.credit >= minInflow),
    [txns, minInflow]
  );

  const groups: SourceGroups = useMemo(
    () =>
      buildIncomeSourceBreakdown(txns, applicantName || null, maidenName || null, undefined, {
        minInflow,
        dropReversals: true,
      }),
    [txns, applicantName, maidenName, minInflow]
  );

  const topSenders = useMemo(
    () => getTopConsistentSenders(qualifyingTxns, 10, applicantName || null, senderDuplicateDecisions),
    [qualifyingTxns, applicantName, senderDuplicateDecisions]
  );

  // Task #430/#431 (found via a live audit against the original GitHub Pages site's "Advanced
  // details" dropdown): "Top 10 inflows" — the biggest single transactions by amount — was never
  // carried over in this port, distinct from topSenders above (ranked by consistency, not size).
  const topInflows = useMemo(() => getTopInflows(txns, 10), [txns]);

  // Task #432 built this as an instant, entirely client-side download. Direct instruction on the
  // live Analysis tab: "make sure you request for email once the applicant clicks 'download
  // breakdown as spreadsheet'" (earlier framed as "before they download it they must send an
  // email and it will be sent to their email"). The spreadsheet is still BUILT entirely in-browser
  // (same 'xlsx' library, same buildIncomeBreakdownAoa as before — nothing about the data leaves
  // the device until the applicant deliberately chooses to email it), but the button now opens an
  // inline email prompt instead of triggering XLSX.writeFile() straight away; submitting that
  // prompt base64-encodes the already-built workbook and POSTs just that attachment (plus the
  // email address) to app/api/email-income-breakdown/route.ts, which relays it via Resend. This
  // matches the same "processed in your browser... nothing leaves your device unless you choose to
  // email yourself a copy" disclosure already on this page for the full PDF report.
  const [breakdownEmailOpen, setBreakdownEmailOpen] = useState(false);
  const [breakdownEmail, setBreakdownEmail] = useState('');
  const [sendingBreakdownEmail, setSendingBreakdownEmail] = useState(false);
  const [breakdownEmailError, setBreakdownEmailError] = useState<string | null>(null);
  const [breakdownEmailSent, setBreakdownEmailSent] = useState(false);
  // Direct instruction: warn before sending rather than silently emailing a spreadsheet with blank
  // "What was this for?" answers still in it — a reviewer reading the breakdown later shouldn't be
  // the first one to notice a gap the applicant could have filled in right here. The warning only
  // blocks the FIRST click after it fires; a second click on "Send to my email" goes through, so an
  // applicant who genuinely has nothing more to add isn't stuck unable to send at all. Reset
  // whenever the prompt is reopened, so revisiting this page and finding a new gap warns again.
  const [breakdownReasonsWarned, setBreakdownReasonsWarned] = useState(false);

  function openBreakdownEmailPrompt() {
    if (!groups.length) return;
    setBreakdownEmailSent(false);
    setBreakdownEmailError(null);
    setBreakdownReasonsWarned(false);
    setBreakdownEmailOpen(true);
  }

  async function handleSendBreakdownEmail() {
    const email = breakdownEmail.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setBreakdownEmailError('Enter a valid email address.');
      return;
    }
    // Same needsExplanation gate SourceGroupCard uses to decide whether to show the reason field at
    // all (reversals/self-transfers/interest/internal movements are the applicant's own money and
    // never asked for a reason, so they don't count towards "unfinished").
    const unfinishedCount = groups.filter(
      (g) => !NO_EXPLANATION_NOTE[g.type] && !(explanations[g.name] || '').trim()
    ).length;
    if (unfinishedCount > 0 && !breakdownReasonsWarned) {
      setBreakdownReasonsWarned(true);
      setBreakdownEmailError(
        `You haven't finished filling in "What was this for?" for ${unfinishedCount} income source${
          unfinishedCount === 1 ? '' : 's'
        } above — it's optional, but worth answering before you send this off, since a reviewer may ask the same question. Click "Send to my email" again to send it as-is.`
      );
      return;
    }
    setBreakdownEmailError(null);
    setSendingBreakdownEmail(true);
    try {
      const XLSX = await import('xlsx');
      const aoa = buildIncomeBreakdownAoa(groups, displayName, explanations, flaggedTxnReasonsForExport, (g) => {
        const s = suggestReasonForGroup(g);
        return {
          suggested: s ? s.label : '',
          status: REVIEW_STATUS_LABEL[reviewStatusFor(s, explanations[g.name] || '')],
        };
      });
      const ws = XLSX.utils.aoa_to_sheet(aoa);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Income Breakdown');
      const base64 = XLSX.write(wb, { type: 'base64', bookType: 'xlsx' });
      const res = await fetch('/api/email-income-breakdown', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, base64 }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setBreakdownEmailError(data?.error || 'Could not send the email — please try again.');
        return;
      }
      setBreakdownEmailSent(true);
      // Same privacy model as trackEvent() everywhere else in this file: an anonymous, aggregate
      // "this happened" tally — never the email address or the file's contents.
      trackEvent('spreadsheet_emailed');
    } catch {
      setBreakdownEmailError('Could not send the email — please try again.');
    } finally {
      setSendingBreakdownEmail(false);
    }
  }

  const unexplainedInflows = useMemo(() => findUnexplainedLargeInflows(txns, minInflow), [txns, minInflow]);

  // Same nesting ReportTab uses to render the "Inflows that need an explanation" cards, recomputed
  // here purely so the Download-spreadsheet flow (above) can build the per-transaction reason map
  // the export needs — see flaggedReasons.ts's own comment for why this is a pure re-shape, not a
  // second source of truth for the flagging logic itself.
  const senderInflowGroupsForExport: SenderInflowGroup[] = useMemo(
    () => nestFlaggedGroupsBySender(groupFlaggedInflows(unexplainedInflows, applicantName || undefined)),
    [unexplainedInflows, applicantName]
  );
  const flaggedTxnReasonsForExport = useMemo(
    () => buildFlaggedTxnReasons(senderInflowGroupsForExport, flaggedReasonMode, flaggedReasonChoice, flaggedReasonOther),
    [senderInflowGroupsForExport, flaggedReasonMode, flaggedReasonChoice, flaggedReasonOther]
  );

  // Report-tab "Monthly cash flow" + "Financial summary" — same computeMonthlyCashFlow already
  // driving the Financial readiness calculator's auto-fill (lib/statement/cashFlow.ts), so these
  // numbers can never drift from what that page shows for the same statement.
  const cashFlowRows: MonthlyCashFlowRow[] = useMemo(() => computeMonthlyCashFlow(txns, 6), [txns]);

  // Direct instruction: warn (never block) when this isn't a genuine, current 6-month statement —
  // stale (most recent transaction too old) or too short a span. Still processed/scored regardless.
  const statementCurrencyResult = useMemo(() => computeStatementCurrency(txns), [txns]);
  const statementCurrencyWarning = useMemo(
    () => buildStatementCurrencyWarning(statementCurrencyResult),
    [statementCurrencyResult]
  );
  const financialSummary = useMemo(
    () => computeFinancials({ ...DEFAULT_FINANCIAL_INPUTS, cashFlow: cashFlowRows }),
    [cashFlowRows]
  );

  // Recomputed reactively so typing/correcting the applicant's name after the scan (the normal
  // order of operations here) still triggers the comparison — same idea as the business ledger's
  // own name-tally check, just with the personal-statement wording/spouse-sponsor exception.
  const nameTallyMessage = useMemo(
    () => buildPersonalNameTallyMessage(applicantName, detectedHolderName, spouse),
    [applicantName, detectedHolderName, spouse]
  );

  // Direct user report ("I still cannot view workplace income"): this card was gated on
  // employed/selfEmployed, read from the "Your responsibilities" session's answers - but that
  // session comes AFTER this one (Income & bank statement analysis is Session 1; Your
  // responsibilities is Session 4, see lib/checklist/sessions.ts's reordering). On a first pass
  // through Session 1, those flags are never yet true, so this card could never show no matter
  // what the applicant uploaded. Un-gated here: computed purely from whether the applicant has
  // typed a name into the field on THIS page, independent of what they have or haven't answered
  // elsewhere yet.
  const employerCheck = useMemo(
    () =>
      employerName.trim()
        ? computeWorkNameCheck({ label: 'employer', name: employerName, altName: employerAltName }, txns)
        : null,
    [employerName, employerAltName, txns]
  );
  const businessCheck = useMemo(
    () =>
      businessName.trim()
        ? computeWorkNameCheck({ label: 'business', name: businessName, altName: businessAltName }, txns)
        : null,
    [businessName, businessAltName, txns]
  );

  // Follow-up to workNameCheck (which only confirms the NAME shows up as a sender): does the
  // AMOUNT actually landing match what the applicant says that employer/business pays them.
  const employerIncomeMatch = useMemo(
    () =>
      employerCheck
        ? computeIncomeMatch('employer', employerDeclaredMonthlyIncome, employerCheck)
        : null,
    [employerCheck, employerDeclaredMonthlyIncome]
  );
  const businessIncomeMatch = useMemo(
    () =>
      businessCheck
        ? computeIncomeMatch('business', businessDeclaredMonthlyIncome, businessCheck)
        : null,
    [businessCheck, businessDeclaredMonthlyIncome]
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

      {ocrUsed && (
        <div className="rounded-lg bg-warn-wash p-3 text-sm text-warn-text" role="status">
          ⚠️ This statement was read by scanning the image/photo (on-device text recognition),
          not from a direct digital export — it&apos;s more likely to misread a name, date, or
          amount than a PDF or Excel export straight from your bank. Please double-check the
          figures below against your real statement, and if something looks wrong, try uploading
          your bank&apos;s own PDF or Excel export instead.
        </div>
      )}

      {statementCurrencyWarning && (
        <div className="rounded-lg bg-warn-wash p-3 text-sm text-warn-text" role="status">
          ⚠️ {statementCurrencyWarning}
        </div>
      )}

      <div className="rounded-xl border border-black/10 bg-white p-3">
        <p className="text-xs font-semibold text-[#12232e]">Show inflows of</p>
        <div className="mt-2 flex flex-wrap gap-2">
          {INFLOW_FLOOR_OPTIONS.map((amt) => (
            <button
              key={amt}
              type="button"
              onClick={() => setMinInflow(amt)}
              aria-pressed={minInflow === amt}
              className={`rounded-full border px-3 py-1.5 text-xs font-semibold ${
                minInflow === amt ? 'border-accent bg-accent-wash text-accent' : 'border-black/10 text-[#566a76]'
              }`}
            >
              ₦{amt.toLocaleString('en-NG')} and above
            </button>
          ))}
        </div>
        <p className="mt-2 text-xs text-[#566a76]">
          Anything under ₦50,000 is always left out, and reversals (money returned to you) are ignored.
          Switch between these to see how your statement looks at different levels.
        </p>
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
          topInflows={topInflows}
          cashFlowRows={cashFlowRows}
          breakdownEmailOpen={breakdownEmailOpen}
          onOpenBreakdownEmail={openBreakdownEmailPrompt}
          breakdownEmail={breakdownEmail}
          setBreakdownEmail={setBreakdownEmail}
          onSendBreakdownEmail={handleSendBreakdownEmail}
          sendingBreakdownEmail={sendingBreakdownEmail}
          breakdownEmailError={breakdownEmailError}
          breakdownEmailSent={breakdownEmailSent}
          displayName={displayName}
          editingName={editingName}
          editValue={editValue}
          setEditValue={setEditValue}
          startEditingName={startEditingName}
          saveNameCorrection={saveNameCorrection}
          cancelEditingName={() => setEditingName(null)}
          isExpanded={isExpanded}
          toggleExpanded={toggleExpanded}
          explanations={explanations}
          setExplanation={setExplanation}
          resolveSenderDuplicate={resolveSenderDuplicate}
        />
      ) : (
        <ReportTab
          groups={groups}
          topSenders={topSenders}
          totalIncomeIdentified={totalIncomeIdentified}
          incomeSourceCount={incomeSourceCount}
          unexplainedInflows={unexplainedInflows}
          flaggedReasonMode={flaggedReasonMode}
          setFlaggedMode={setFlaggedMode}
          flaggedReasonChoice={flaggedReasonChoice}
          setFlaggedChoice={setFlaggedChoice}
          flaggedReasonOther={flaggedReasonOther}
          setFlaggedOther={setFlaggedOther}
          cashFlowRows={cashFlowRows}
          financialSummary={financialSummary}
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
          employerCategoryChoices={employerCategoryChoices}
          setEmployerCategoryChoices={setEmployerCategoryChoices}
          businessCategoryChoices={businessCategoryChoices}
          setBusinessCategoryChoices={setBusinessCategoryChoices}
          employerDeclaredMonthlyIncome={employerDeclaredMonthlyIncome}
          setEmployerDeclaredMonthlyIncome={setEmployerDeclaredMonthlyIncome}
          businessDeclaredMonthlyIncome={businessDeclaredMonthlyIncome}
          setBusinessDeclaredMonthlyIncome={setBusinessDeclaredMonthlyIncome}
          employerIncomeMatch={employerIncomeMatch}
          businessIncomeMatch={businessIncomeMatch}
          applicantName={applicantName}
          explanations={explanations}
          setExplanation={setExplanation}
          otherStatementSummary={otherStatementSummary}
          statementCurrencyIssues={statementCurrencyResult.issues}
        />
      )}
    </div>
  );
}
