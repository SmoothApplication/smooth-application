'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  SituationKind,
  RefusalRouting,
  computeRefusalRouting,
  refusalSuggestionText,
  parseRefusalDateFromText,
  analyzeLetter,
  LetterAnalysis,
} from '@/lib/situation';
import { extractLetterText } from '@/lib/situation/extractLetterText';
import { translateToEnglish, TranslationError } from '@/lib/situation/translateLetter';
import {
  extractMoneyFigures,
  summarizeStatementTxns,
  checkDeclaredFundsFit,
  MoneyFigure,
  StatementSummary,
  FinanceFitResult,
} from '@/lib/situation/paidFinanceCheck';
import { getLinesFromFile } from '@/lib/statement/extractFile';
import { parseStatementLinesWithFallback, ParsedTxn } from '@/lib/statement';
import { fmtN } from '@/lib/checklist/financial';
import { trackEvent } from '@/lib/analytics';

// Port of index.html's "Where are you in the process?" gate (#situationGate, ~line 1806) — shown
// after the country/consent pick, before the checklist itself. Field/founder idea: an applicant
// who already has a refusal, or who's already paid the fee and filled the form, needs a different
// conversation than a fresh applicant. Every path — including both follow-ups — still has a
// "Continue to my checklist anyway" escape hatch, since needing help with a refusal or a review
// doesn't mean someone doesn't also want the checklist.
//
// Deliberately lightweight: no agent backend, no automated diagnosis. The one careful exception is
// the refusal-letter reading aid below, and even that is scoped narrowly — see its own comments.
//
// Same real contact details used throughout the original app (footer, Document Review offer,
// resume reminders): a real person reads what comes through and replies personally, nothing
// automated, nothing stored anywhere but the applicant's own draft/chat until THEY choose to send.
const WHATSAPP_NUMBER = '2349081389969';
const CONTACT_EMAIL = 'lalasionline@gmail.com';

export type SituationGateProps = {
  name: string;
  /** Whether this country doesn't require a visa at all (Ghana/Kenya/Morocco's "travel readiness"
   * countries) — changes "visa application" to "trip" in the contact messages below, same as
   * index.html's destName(). */
  isTravelReadiness?: boolean;
  /** The actual checklist page — where "Continue to my checklist" and "See my full checklist
   * instead" land. */
  checklistHref: string;
  /** The bank-statement analysis page — index.html calls this session "finance2" and it's the
   * refusal-routing target for a financial letter, or a recent non-financial one. */
  statementHref: string;
  /** The passport-scan page — the refusal-routing target for an older non-financial letter. */
  passportHref: string;
};

export default function SituationGate({
  name,
  isTravelReadiness,
  checklistHref,
  statementHref,
  passportHref,
}: SituationGateProps) {
  const router = useRouter();
  const [kind, setKind] = useState<SituationKind | null>(null);

  // ---- Refused follow-up: optional letter upload (reading aid only) ----
  const [letterFile, setLetterFile] = useState<File | null>(null);
  const [scanStatus, setScanStatus] = useState<'idle' | 'busy' | 'ok' | 'info' | 'err'>('idle');
  const [scanMessage, setScanMessage] = useState('');
  const [letterText, setLetterText] = useState<string | null>(null);
  // Task #415 (direct request, mid-turn message): "scan through and read and pick words appeared
  // often... summarize the reason why you were denied" — computed alongside letterText from the
  // same on-device extracted text, see lib/situation/letterAnalysis.ts for the actual logic.
  const [letterAnalysis, setLetterAnalysis] = useState<LetterAnalysis | null>(null);
  // Task #415 follow-up (direct request): "translate them and tell the applicant the reason" — see
  // lib/situation/translateLetter.ts's header for why this is the one part of the reading aid that
  // sends text to a third-party service (MyMemory) rather than staying fully on-device.
  const [translateStatus, setTranslateStatus] = useState<'idle' | 'busy' | 'ok' | 'err'>('idle');
  const [translateMessage, setTranslateMessage] = useState('');
  const [translatedText, setTranslatedText] = useState<string | null>(null);
  const [showManual, setShowManual] = useState(false);
  const [manualDate, setManualDate] = useState('');
  const [manualFinancial, setManualFinancial] = useState<'' | 'yes' | 'no'>('');
  const [routing, setRouting] = useState<RefusalRouting | null>(null);
  const [suggestionVisible, setSuggestionVisible] = useState(false);

  // ---- Refused follow-up: quick-context fields for the WhatsApp/email message ----
  const [refCountry, setRefCountry] = useState('');
  const [refCount, setRefCount] = useState('');
  const [refReason, setRefReason] = useState('');
  const [refBalance, setRefBalance] = useState('');

  // ---- Task #416 (direct request, screenshot): "Already paid & filled" follow-up — upload the
  // filled UK form + bank statement(s), cross-check what was declared against what the statement
  // actually shows. Same on-device-only privacy promise as everything else on this page: the form
  // is read via extractLetterText (the same OCR/PDF pipeline as the refusal-letter reading aid) and
  // the statement(s) via lib/statement's existing parse engine (same as the standalone statement
  // checker) — nothing here is ever uploaded anywhere. See lib/situation/paidFinanceCheck.ts for
  // the actual money-figure extraction / balance-comparison logic and why it only auto-suggests
  // figures rather than trusting OCR to pick "the" declared amount. ----
  const [paidFormFile, setPaidFormFile] = useState<File | null>(null);
  const [paidFormScanStatus, setPaidFormScanStatus] = useState<'idle' | 'busy' | 'ok' | 'err'>('idle');
  const [paidFormScanMessage, setPaidFormScanMessage] = useState('');
  const [paidFormText, setPaidFormText] = useState<string | null>(null);
  const [paidMoneyFigures, setPaidMoneyFigures] = useState<MoneyFigure[]>([]);
  const [paidDeclaredAmount, setPaidDeclaredAmount] = useState('');

  const [paidStatementFiles, setPaidStatementFiles] = useState<File[]>([]);
  const [paidStatementStatus, setPaidStatementStatus] = useState<'idle' | 'busy' | 'ok' | 'err'>('idle');
  const [paidStatementMessage, setPaidStatementMessage] = useState('');
  const [paidStatementSummary, setPaidStatementSummary] = useState<StatementSummary | null>(null);

  // ---- Task #410 (direct request): "Re-Applying" follow-up — a returning applicant's history
  // with this visa, gathered the same lightweight, ephemeral way as the "refused" fields above
  // (component state only, not persisted or sent anywhere automatically — this gate isn't part of
  // the persisted Answers, see SessionGate's own header comment). ----
  const [reappLastVisaDate, setReappLastVisaDate] = useState(''); // <input type="month">, e.g. "2022-06"
  const [reappValidityValue, setReappValidityValue] = useState('');
  const [reappValidityUnit, setReappValidityUnit] = useState<'months' | 'years'>('years');
  const [reappTimesUsed, setReappTimesUsed] = useState('');
  const [reappLastTravelDate, setReappLastTravelDate] = useState('');
  // One days-spent entry per trip — resized below to match reappTimesUsed, keeping whatever the
  // applicant already typed for the trips that still exist.
  const [reappTripDays, setReappTripDays] = useState<string[]>([]);

  useEffect(() => {
    const n = parseInt(reappTimesUsed, 10);
    if (!Number.isFinite(n) || n < 0) return;
    const capped = Math.min(n, 30); // sanity cap — matches the "up to 20 years" style caps used elsewhere (e.g. TravelHistory's YEARS list)
    setReappTripDays((prev) => {
      if (prev.length === capped) return prev;
      const next = prev.slice(0, capped);
      while (next.length < capped) next.push('');
      return next;
    });
  }, [reappTimesUsed]);

  function updateReappTripDay(i: number, value: string) {
    setReappTripDays((rows) => rows.map((r, idx) => (idx === i ? value : r)));
  }

  // Task #412 (direct request): both <input type="month"> fields below defaulted their native
  // picker to opening on the CURRENT month with no `min`, so getting to a visa issued years ago
  // meant clicking the picker's back arrow one month at a time — for a visa from a decade back,
  // that's 120+ clicks. Browsers that show a year selector in the month picker only offer it once
  // a `min` is set, so this range lets someone jump straight to, say, 2016 instead of stepping
  // back through it. 20 years covers even a long-since-expired multi-entry visa; `max` is today's
  // month since neither "when issued" nor "when last travelled" can be in the future.
  const monthInputRange = useMemo(() => {
    const now = new Date();
    const pad = (n: number) => String(n).padStart(2, '0');
    const max = `${now.getFullYear()}-${pad(now.getMonth() + 1)}`;
    const min = `${now.getFullYear() - 20}-${pad(now.getMonth() + 1)}`;
    return { min, max };
  }, []);

  function destName() {
    return isTravelReadiness ? `${name} trip` : `${name} application`;
  }

  function selectKind(next: SituationKind) {
    setKind(next);
    trackEvent('situation_selected:' + next);
  }

  async function handleScanLetter() {
    if (!letterFile) return;
    if (letterFile.size > 20 * 1024 * 1024) {
      setScanStatus('err');
      setScanMessage('File is larger than 20MB - please pick a smaller copy, or use "Just tell us directly" below.');
      return;
    }
    setScanStatus('busy');
    setScanMessage('Reading your letter… this can take up to 30 seconds (nothing leaves your browser).');
    setLetterAnalysis(null); // clear any previous scan's analysis before this one finishes
    setTranslatedText(null);
    setTranslateStatus('idle');
    setTranslateMessage('');
    try {
      const text = await extractLetterText(letterFile);
      if (!text || !text.trim()) {
        setScanStatus('info');
        setScanMessage("Couldn't read that clearly - try a clearer photo, or just tell us directly below.");
        setShowManual(true);
        return;
      }
      // Show the applicant their own letter's text, and pre-fill only the date (a plain fact) —
      // never decide the financial question for them. See the block comment above this component.
      setLetterText(text);
      setLetterAnalysis(analyzeLetter(text));
      const parsedDate = parseRefusalDateFromText(text);
      if (parsedDate) {
        const y = parsedDate.getFullYear();
        const m = String(parsedDate.getMonth() + 1).padStart(2, '0');
        const d = String(parsedDate.getDate()).padStart(2, '0');
        setManualDate(`${y}-${m}-${d}`);
      }
      setScanStatus('ok');
      setScanMessage("Got it - here's what your letter says. Take a look below, then answer the two questions to see a suggestion.");
      setShowManual(true);
    } catch (err) {
      setScanStatus('err');
      setScanMessage((err instanceof Error ? err.message : "Couldn't read this file automatically.") + ' You can still just tell us directly below.');
      setShowManual(true);
    }
  }

  // Task #415 follow-up (direct request): "translate them and tell the applicant the reason." Only
  // callable once letterAnalysis.detectedLanguage is set (see the render block below), so
  // sourceLang is always a real guessed code, never invented here.
  async function handleTranslateLetter(sourceLang: string) {
    if (!letterText) return;
    setTranslateStatus('busy');
    setTranslateMessage('Translating… this sends your letter’s text to a translation service (not just processed on your device, unlike the rest of this page).');
    try {
      const translated = await translateToEnglish(letterText, sourceLang);
      setTranslatedText(translated);
      // Re-run the same word/reason analysis on the translated text so the summary above now
      // reflects the letter's actual content instead of untranslated foreign-language noise.
      setLetterAnalysis(analyzeLetter(translated));
      setTranslateStatus('ok');
      setTranslateMessage('Translated below - this is a machine translation and may not be perfectly accurate.');
    } catch (err) {
      setTranslateStatus('err');
      setTranslateMessage(
        err instanceof TranslationError
          ? err.message
          : "Couldn't translate this automatically - the original text is still shown below."
      );
    }
  }

  // Task #416 follow-up: OCR the filled form purely as a reading aid — see the state block above
  // and paidFinanceCheck.ts's header for why this never auto-picks "the" declared figure, only
  // surfaces candidates for the applicant to confirm below.
  async function handleScanPaidForm() {
    if (!paidFormFile) return;
    if (paidFormFile.size > 20 * 1024 * 1024) {
      setPaidFormScanStatus('err');
      setPaidFormScanMessage('File is larger than 20MB - please pick a smaller copy.');
      return;
    }
    setPaidFormScanStatus('busy');
    setPaidFormScanMessage('Reading your form… this can take up to 30 seconds (nothing leaves your browser).');
    setPaidFormText(null);
    setPaidMoneyFigures([]);
    try {
      const text = await extractLetterText(paidFormFile);
      if (!text || !text.trim()) {
        setPaidFormScanStatus('err');
        setPaidFormScanMessage("Couldn't read that clearly - try a clearer photo/scan, or just type the amount you declared below.");
        return;
      }
      setPaidFormText(text);
      const figures = extractMoneyFigures(text);
      setPaidMoneyFigures(figures);
      setPaidFormScanStatus('ok');
      setPaidFormScanMessage(
        figures.length
          ? "Got it - here's what we could find. Tap the right amount below, or type it in yourself."
          : "Got it, but we couldn't spot a clear Naira amount in there automatically - type the amount you declared below."
      );
    } catch (err) {
      setPaidFormScanStatus('err');
      setPaidFormScanMessage((err instanceof Error ? err.message : "Couldn't read this file automatically.") + ' You can still type the amount you declared below.');
    }
  }

  // Task #416 follow-up: run the uploaded statement(s) through the same parse engine the standalone
  // statement checker uses (lib/statement), then reduce to just the couple of numbers this
  // cross-check needs (see paidFinanceCheck.ts's summarizeStatementTxns). Each file is parsed
  // separately and the results concatenated, rather than merging raw lines across files, so page-
  // boundary narration-wrap logic never has to reason about two unrelated documents as one.
  async function handleAnalyzePaidStatements() {
    if (!paidStatementFiles.length) return;
    setPaidStatementStatus('busy');
    setPaidStatementMessage('Reading your statement(s)… this can take a few minutes for a scanned or photographed copy (nothing leaves your browser).');
    setPaidStatementSummary(null);
    try {
      const allTxns: ParsedTxn[] = [];
      for (const file of paidStatementFiles) {
        const lines = await getLinesFromFile(file);
        if (!lines.length) continue;
        allTxns.push(...parseStatementLinesWithFallback(lines));
      }
      if (!allTxns.length) {
        setPaidStatementStatus('err');
        setPaidStatementMessage("We couldn't make out any transactions in that file. Double-check it's a bank statement export, or try a clearer copy.");
        return;
      }
      setPaidStatementSummary(summarizeStatementTxns(allTxns));
      setPaidStatementStatus('ok');
      setPaidStatementMessage(`Read ${allTxns.length} transaction${allTxns.length === 1 ? '' : 's'} from your statement.`);
    } catch (err) {
      setPaidStatementStatus('err');
      setPaidStatementMessage(err instanceof Error ? err.message : "Something went wrong reading that file - try a different PDF, spreadsheet, or clearer photo.");
    }
  }

  const paidFitResult: FinanceFitResult | null =
    paidStatementSummary && Number(paidDeclaredAmount) > 0
      ? checkDeclaredFundsFit(Number(paidDeclaredAmount), paidStatementSummary)
      : null;

  function handleApplyManual() {
    if (!manualDate) return;
    const [y, m, d] = manualDate.split('-').map(Number);
    const dateObj = new Date(y, m - 1, d);
    const result = computeRefusalRouting(dateObj, manualFinancial === 'yes');
    setRouting(result);
    setSuggestionVisible(true);
  }

  function handleTakeMeThere() {
    if (routing?.target === 'finance2') router.push(statementHref);
    else if (routing?.target === 'restart') router.push(passportHref);
    else router.push(checklistHref);
  }

  function refusedMessage() {
    const lines = [`Hi, I've been refused a visa before and I'm now preparing a ${destName()}.`];
    if (refCountry) lines.push(`Refused by: ${refCountry}`);
    if (refCount) lines.push(`Number of times refused: ${refCount}`);
    if (refReason.trim()) lines.push(`Reason given: ${refReason.trim()}`);
    if (refBalance.trim()) lines.push(`Current balance: ${refBalance.trim()}`);
    lines.push('Can you help me understand what I should do differently this time?');
    return lines.join('\n');
  }

  function paidMessage() {
    return `Hi, I've already paid the fee and filled my ${destName()} form. I'm interested in the paid Document Review (₦35,000) before my appointment.`;
  }

  // Task #416 follow-up: prefilled with the actual numbers when the self-check below turns up a
  // mismatch, so whoever replies already has the context instead of asking the applicant to
  // re-explain it.
  function paidFinanceMismatchMessage() {
    const lines = [`Hi, I've already paid the fee and filled my ${destName()} form.`];
    if (paidFitResult) {
      lines.push(
        `I declared about ${fmtN(paidFitResult.declaredAmount)}, but my bank statement's latest balance shows about ${fmtN(paidFitResult.latestBalance)}.`
      );
    }
    lines.push("Can you help me understand what to do about this before my appointment?");
    return lines.join('\n');
  }

  return (
    // Task #409 (direct request, screenshot): "make it the same size with the homepage" — widened
    // from `max-w-lg` (512px) to `max-w-3xl` (768px), matching the homepage's own container
    // (app/page.tsx) and the country picker's (app/checklist/start/page.tsx, task #406) exactly.
    // Task #411 (direct request, screenshot): "make the size like the homepage, reduce the white
    // spaces under" — dropped `min-h-screen` from this page's single <main> so the page's height
    // would follow its (short) content instead of always padding out to full-screen.
    // Task #413 (direct request, annotated screenshot): on a taller/desktop browser window, that
    // fix just moved the same problem below the *document* instead of below the *content* — the
    // page ended at ~635px, but a ~965px-tall window still shows ~330px of plain blank canvas
    // under it, which reads exactly like the "lots of white space beneath" complaint this was
    // meant to fix. This page only has 4 boxes + one button (much less content than the homepage's
    // two stat grids + CTA + sources line), so no realistic amount of margin/padding makes its
    // *content* as tall as the homepage's — the fix isn't to inflate the boxes, it's to stop
    // treating the leftover space as something to eliminate and instead use it deliberately, the
    // same way this app already handles every other short-content screen: /checklist/start (task
    // #406) and the quiz intro/result screens (app/quiz/page.tsx) both center their card with
    // `flex min-h-screen items-center justify-center` rather than pinning it to the top. Applying
    // that same pattern here: restored `min-h-screen`, added `items-center justify-center`, so the
    // leftover space splits evenly above and below instead of collecting in one block underneath —
    // still no forced scrollbar for short content, but the whole viewport is now the styled
    // `bg-cream` canvas (matching the homepage's own background) instead of ending partway
    // down into a plain white gap.
    <main className="flex min-h-screen items-center justify-center bg-cream px-4 py-10">
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-5">
        <div>
          <h1 className="font-serif text-xl font-semibold text-[#12232e]">🧭 Where are you in the process?</h1>
          <p className="mt-1 text-sm text-[#4c6270]">Just so we can point you the right way - answering doesn&apos;t change what&apos;s ahead unless you want it to.</p>
        </div>

      {/* Task #408 (direct request, screenshot): "following the same principle of the home page
          design, turn the 3 bars into boxes make the 4th box 'Re-Applying'" — the 3 stacked
          full-width bars became a 2x2 box grid using the same language as the homepage
          (app/page.tsx) and the country picker (app/checklist/start/page.tsx, tasks #405-#407):
          top row white/`card-surface`/text-good, bottom row dark navy/text-warn, both bold
          headline + smaller caption underneath. A 4th box, "Re-Applying", was added to fill out
          the grid evenly — see lib/situation/types.ts for why it's a distinct option rather than
          folded into "fresh". */}
      <div className="grid gap-3 sm:grid-cols-2" role="radiogroup" aria-label="Where are you in the process?">
        <SituationOption
          tone="good"
          icon="🆕"
          title="Fresh application"
          desc="Haven't applied for this visa before, or it's been a while"
          selected={kind === 'fresh'}
          onClick={() => selectKind('fresh')}
        />
        <SituationOption
          tone="good"
          icon="📄"
          title="Refused before"
          desc="For this visa, or any other, in the last few years"
          selected={kind === 'refused'}
          onClick={() => selectKind('refused')}
        />
        <SituationOption
          tone="warn"
          icon="✅"
          title="Already paid & filled"
          desc="Applied already - want a second pair of eyes before your appointment"
          selected={kind === 'paid'}
          onClick={() => selectKind('paid')}
        />
        <SituationOption
          tone="warn"
          icon="🔁"
          title="Re-Applying"
          desc="Successfully held this visa (or a similar one) before - now renewing or applying again"
          selected={kind === 'reapplying'}
          onClick={() => selectKind('reapplying')}
        />
      </div>

      {kind === 'refused' && (
        <div className="rounded-lg border border-black/10 bg-white p-4">
          <label className="mb-1 block text-sm font-medium text-[#12232e]">📄 Have your refusal letter handy? (optional)</label>
          <p className="mb-2 text-xs text-[#4c6270]">
            Upload a photo or PDF and we&apos;ll show you what it says, right here, so you don&apos;t have to retype anything - read
            entirely on your device, nothing uploaded anywhere. Prefer not to?{' '}
            <button type="button" onClick={() => setShowManual(true)} className="text-accent underline">
              Just tell us directly
            </button>
            , or skip straight to the quick details below.
          </p>
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <input
              type="file"
              accept="image/*,application/pdf"
              onChange={(e) => setLetterFile(e.target.files?.[0] ?? null)}
              className="max-w-[220px] text-sm"
            />
            <button
              type="button"
              disabled={!letterFile || scanStatus === 'busy'}
              onClick={handleScanLetter}
              className="rounded-md bg-accent px-3 py-1.5 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-40"
            >
              📎 Read my letter
            </button>
          </div>
          {scanStatus !== 'idle' && (
            <p
              className={`mb-2 rounded-md p-2 text-xs ${
                scanStatus === 'err'
                  ? 'bg-warn-wash text-warn-text'
                  : scanStatus === 'ok'
                  ? 'bg-accent-wash text-accent'
                  : 'bg-black/5 text-[#4c6270]'
              }`}
            >
              {scanMessage}
            </p>
          )}
          {/* Task #415 (direct request, mid-turn message): "the system should be able to scan
              through and read and pick words appeared often... and summarize the reason why you
              were denied" — see lib/situation/letterAnalysis.ts for the actual word-counting and
              phrase-matching logic (entirely on-device, no network call). Framed as a reading aid,
              not a verdict — same disclaimer tone as the rest of this panel — with a "use this"
              button rather than auto-filling refReason, since a category guess is an inference,
              not a fact the way the parsed refusal date above is. */}
          {letterAnalysis && (
            <div className="mb-2 rounded-md bg-accent-wash p-3 text-xs text-[#12232e]">
              {letterAnalysis.looksNonEnglish && !translatedText && (
                <div className="mb-2 rounded-md bg-warn-wash p-2 text-warn-text">
                  <p className="mb-2">
                    This doesn&apos;t look like it&apos;s written in English
                    {letterAnalysis.detectedLanguage ? ` - possibly ${letterAnalysis.detectedLanguage.name}` : ''},
                    so the word/reason patterns above are unreliable - they only understand English text.
                  </p>
                  {letterAnalysis.detectedLanguage ? (
                    <>
                      <button
                        type="button"
                        disabled={translateStatus === 'busy'}
                        onClick={() => handleTranslateLetter(letterAnalysis.detectedLanguage!.code)}
                        className="rounded-md bg-white px-2 py-1 text-[11px] font-medium text-warn-text hover:bg-white/80 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {translateStatus === 'busy' ? 'Translating…' : `Translate from ${letterAnalysis.detectedLanguage.name} to English`}
                      </button>
                      <p className="mt-1 text-[10px]">
                        Unlike everything else on this page, translating sends your letter&apos;s
                        text to a free translation service (translated.net) rather than keeping it
                        only on your device.
                      </p>
                    </>
                  ) : (
                    <p className="text-[10px]">
                      Read the full text below yourself, or see the note under &quot;Just tell us
                      directly&quot; for what to do with a letter in another language.
                    </p>
                  )}
                  {translateStatus === 'err' && <p className="mt-1 text-[10px]">{translateMessage}</p>}
                </div>
              )}
              {letterAnalysis.topWords.length > 0 && (
                <div className="mb-2">
                  <p className="mb-1 font-medium">Words that came up often in your letter:</p>
                  <div className="flex flex-wrap gap-1.5">
                    {letterAnalysis.topWords.map((wc) => (
                      <span
                        key={wc.word}
                        className="rounded-full bg-white px-2 py-0.5 text-[11px] font-medium text-[#12232e]"
                      >
                        {wc.word} × {wc.count}
                      </span>
                    ))}
                  </div>
                </div>
              )}
              {letterAnalysis.primaryReason ? (
                <div>
                  <p className="mb-1">
                    Based on the wording, this reads most like:{' '}
                    <strong>{letterAnalysis.primaryReason.label}</strong>
                  </p>
                  <p className="mb-2 text-[11px] text-[#4c6270]">
                    Matched phrases: &quot;{letterAnalysis.primaryReason.matchedPhrases.join('", "')}&quot;
                  </p>
                  <button
                    type="button"
                    onClick={() => setRefReason(letterAnalysis.primaryReason!.label)}
                    className="rounded-md border border-black/10 bg-white px-2 py-1 text-[11px] font-medium text-[#12232e] hover:bg-black/5"
                  >
                    Use this as my reason below
                  </button>
                </div>
              ) : (
                <p className="text-[11px] text-[#4c6270]">
                  Couldn&apos;t match this to one of the common refusal reasons automatically - read
                  the highlighted words above and the full text below, then fill in the reason
                  yourself.
                </p>
              )}
              <p className="mt-2 text-[10px] text-[#8a99a3]">
                This is just pattern-matching over the words in your own letter, not a legal
                reading of it - it can be wrong or miss something important. Always go with what
                your letter actually says.
              </p>
            </div>
          )}

          {translateStatus === 'ok' && translatedText && (
            <div className="mb-2 rounded-md bg-good-wash p-2 text-xs text-good">{translateMessage}</div>
          )}

          {translatedText && (
            <div className="mb-2">
              <p className="mb-1 text-xs font-medium text-[#12232e]">Translated to English (machine translation):</p>
              <div className="max-h-44 overflow-y-auto whitespace-pre-wrap rounded-md bg-black/5 p-2 text-xs text-[#4c6270]">
                {translatedText}
              </div>
            </div>
          )}

          {letterText && (
            <div className="mb-2">
              {translatedText && <p className="mb-1 text-xs font-medium text-[#12232e]">Original text:</p>}
              <div className="max-h-44 overflow-y-auto whitespace-pre-wrap rounded-md bg-black/5 p-2 text-xs text-[#4c6270]">
                {letterText}
              </div>
            </div>
          )}

          {showManual && (
            <div className="mt-2 border-t border-black/10 pt-3">
              <div className="mb-2 flex flex-col gap-3 sm:flex-row">
                <div className="flex-1">
                  <label className="mb-1 block text-xs font-medium text-[#12232e]" htmlFor="situationRefusedManualDate">
                    When were you refused? (roughly is fine)
                  </label>
                  <input
                    id="situationRefusedManualDate"
                    type="date"
                    value={manualDate}
                    onChange={(e) => setManualDate(e.target.value)}
                    className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                  />
                </div>
                <div className="flex-1">
                  <label className="mb-1 block text-xs font-medium text-[#12232e]" htmlFor="situationRefusedManualFinancial">
                    Reading your letter yourself: was it mainly about your finances (funds/bank statement)?
                  </label>
                  <select
                    id="situationRefusedManualFinancial"
                    value={manualFinancial}
                    onChange={(e) => setManualFinancial(e.target.value as '' | 'yes' | 'no')}
                    className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                  >
                    <option value="">Not sure</option>
                    <option value="yes">Yes</option>
                    <option value="no">No / something else</option>
                  </select>
                </div>
              </div>
              <p className="mb-2 text-xs text-[#4c6270]">
                This isn&apos;t professional advice, and this app doesn&apos;t try to read or judge your case for you - it just helps
                you get your own first look. For an actual assessment, an OISC-registered (UK) or RCIC-registered (Canada) adviser
                can properly review your refusal.
              </p>
              <button
                type="button"
                onClick={handleApplyManual}
                disabled={!manualDate}
                className="rounded-md border border-black/10 px-3 py-1.5 text-sm font-medium text-[#12232e] hover:bg-black/5 disabled:cursor-not-allowed disabled:opacity-40"
              >
                Use this
              </button>
            </div>
          )}

          {suggestionVisible && routing && (
            <div className="mt-3 rounded-md bg-accent-wash p-3 text-sm text-[#12232e]">
              <p dangerouslySetInnerHTML={{ __html: refusalSuggestionText(routing, manualFinancial === 'yes') }} />
              <div className="mt-2 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={handleTakeMeThere}
                  className="rounded-md bg-accent px-3 py-1.5 text-sm font-semibold text-white hover:opacity-90"
                >
                  Take me there →
                </button>
                <Link href={checklistHref} className="rounded-md border border-black/10 px-3 py-1.5 text-sm font-medium text-[#12232e] hover:bg-black/5">
                  See my full checklist instead
                </Link>
              </div>
            </div>
          )}

          <div className="mt-4 border-t border-black/10 pt-3">
            <div className="mb-2 flex flex-col gap-3 sm:flex-row">
              <div className="flex-1">
                <label className="mb-1 block text-xs font-medium text-[#12232e]">Which country refused you?</label>
                <select
                  value={refCountry}
                  onChange={(e) => setRefCountry(e.target.value)}
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                >
                  <option value="">Select…</option>
                  <option value="United Kingdom">United Kingdom</option>
                  <option value="Canada">Canada</option>
                  <option value="United States">United States</option>
                  <option value="Schengen">Schengen / Europe</option>
                  <option value="South Africa">South Africa</option>
                  <option value="Other">Other</option>
                </select>
              </div>
              <div className="flex-1">
                <label className="mb-1 block text-xs font-medium text-[#12232e]">How many times?</label>
                <select
                  value={refCount}
                  onChange={(e) => setRefCount(e.target.value)}
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                >
                  <option value="">Select…</option>
                  <option value="Once">Once</option>
                  <option value="Twice">Twice</option>
                  <option value="3 or more times">3 or more times</option>
                </select>
              </div>
            </div>
            <label className="mb-1 block text-xs font-medium text-[#12232e]">What reason were you given, if any? (optional)</label>
            <textarea
              value={refReason}
              onChange={(e) => setRefReason(e.target.value)}
              rows={2}
              placeholder="e.g. Not satisfied you were a genuine visitor / insufficient funds shown"
              className="mb-2 w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
            />
            <label className="mb-1 block text-xs font-medium text-[#12232e]">Roughly what&apos;s your current account balance? (optional)</label>
            <input
              type="text"
              value={refBalance}
              onChange={(e) => setRefBalance(e.target.value)}
              placeholder="e.g. ₦450,000"
              className="mb-2 w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
            />
            <p className="mb-3 text-xs text-[#4c6270]">
              Nothing above is sent anywhere unless you tap one of the buttons below - it&apos;s only used to fill in the message
              they open. You can attach your actual refusal letter yourself once your WhatsApp or email is open, if you&apos;d like a
              closer look at it.
            </p>
            <div className="flex flex-wrap gap-2">
              <a
                href={`https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(refusedMessage())}`}
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-md bg-accent px-4 py-2 text-sm font-semibold text-white hover:opacity-90"
              >
                💬 Message us about my refusal
              </a>
              <a
                href={`mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent('Help with a previous visa refusal')}&body=${encodeURIComponent(refusedMessage())}`}
                className="rounded-md border border-black/10 px-4 py-2 text-sm font-medium text-[#12232e] hover:bg-black/5"
              >
                ✉️ Email instead
              </a>
            </div>
          </div>
        </div>
      )}

      {kind === 'paid' && (
        <div className="rounded-lg border border-black/10 bg-white p-4">
          {/* Task #416 (direct request, screenshot): "ask applicants to upload their filled UK form
              and their bank statements... runs your bank statement through the income analysis
              check and checks it with what you filled in your finances of you filled UK form...
              confirm if your filled form fits your finances." A quick self-check, entirely
              on-device, before the paid human review below. */}
          <div className="mb-4 border-b border-black/10 pb-4">
            <p className="mb-1 text-sm font-medium text-[#12232e]">🔍 Quick self-check: does your form match your finances?</p>
            <p className="mb-3 text-xs text-[#4c6270]">
              Upload your filled form and your bank statement, and we&apos;ll compare the funds figure you declared against what
              your statement actually shows - both read entirely on your device, nothing uploaded anywhere.
            </p>

            <div className="mb-4">
              <label className="mb-1 block text-xs font-medium text-[#12232e]">1. Your filled UK form</label>
              <div className="mb-2 flex flex-wrap items-center gap-2">
                <input
                  type="file"
                  accept="image/*,application/pdf"
                  onChange={(e) => setPaidFormFile(e.target.files?.[0] ?? null)}
                  className="max-w-[220px] text-sm"
                />
                <button
                  type="button"
                  disabled={!paidFormFile || paidFormScanStatus === 'busy'}
                  onClick={handleScanPaidForm}
                  className="rounded-md bg-accent px-3 py-1.5 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-40"
                >
                  📎 Read my form
                </button>
              </div>
              {paidFormScanStatus !== 'idle' && (
                <p
                  className={`mb-2 rounded-md p-2 text-xs ${
                    paidFormScanStatus === 'err' ? 'bg-warn-wash text-warn-text' : paidFormScanStatus === 'ok' ? 'bg-accent-wash text-accent' : 'bg-black/5 text-[#4c6270]'
                  }`}
                >
                  {paidFormScanMessage}
                </p>
              )}
              {paidMoneyFigures.length > 0 && (
                <div className="mb-2 flex flex-wrap gap-1.5">
                  {paidMoneyFigures.map((f) => (
                    <button
                      key={f.value}
                      type="button"
                      onClick={() => setPaidDeclaredAmount(String(f.value))}
                      className="rounded-full border border-black/10 bg-cream-soft px-2.5 py-1 text-xs font-medium text-[#12232e] hover:bg-black/5"
                    >
                      {f.raw}
                    </button>
                  ))}
                </div>
              )}
              <label className="mb-1 block text-xs font-medium text-[#12232e]" htmlFor="paid-declared-amount">
                Amount you declared as your available funds (₦)
              </label>
              <input
                id="paid-declared-amount"
                type="number"
                min={0}
                inputMode="numeric"
                value={paidDeclaredAmount}
                onChange={(e) => setPaidDeclaredAmount(e.target.value)}
                placeholder="e.g. 500000"
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
              />
              <p className="mt-1 text-[10px] text-[#8a99a3]">
                Tap one of the amounts above once your form&apos;s read, or type it in yourself. If your form states a different
                currency, roughly convert it to Naira first - this check only compares Naira figures.
              </p>
            </div>

            <div className="mb-3">
              <label className="mb-1 block text-xs font-medium text-[#12232e]">2. Your bank statement(s)</label>
              <div className="mb-2 flex flex-wrap items-center gap-2">
                <input
                  type="file"
                  accept=".pdf,.xlsx,.xls,image/*"
                  multiple
                  onChange={(e) => setPaidStatementFiles(e.target.files ? Array.from(e.target.files) : [])}
                  className="max-w-[260px] text-sm"
                />
                <button
                  type="button"
                  disabled={!paidStatementFiles.length || paidStatementStatus === 'busy'}
                  onClick={handleAnalyzePaidStatements}
                  className="rounded-md bg-accent px-3 py-1.5 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-40"
                >
                  🔍 Check my statement
                </button>
              </div>
              {paidStatementStatus !== 'idle' && (
                <p
                  className={`mb-2 rounded-md p-2 text-xs ${
                    paidStatementStatus === 'err' ? 'bg-warn-wash text-warn-text' : paidStatementStatus === 'ok' ? 'bg-accent-wash text-accent' : 'bg-black/5 text-[#4c6270]'
                  }`}
                >
                  {paidStatementMessage}
                </p>
              )}
              {paidStatementSummary && (
                <p className="rounded-md bg-black/5 p-2 text-xs text-[#4c6270]">
                  Your statement&apos;s latest balance: <strong className="text-[#12232e]">{fmtN(paidStatementSummary.latestBalance)}</strong>
                  {' · '}Total money in over the period: <strong className="text-[#12232e]">{fmtN(paidStatementSummary.totalCredits)}</strong>
                </p>
              )}
            </div>

            {paidFitResult && (
              <div className={`rounded-md p-3 text-sm ${paidFitResult.fits ? 'bg-good-wash text-good' : 'bg-warn-wash text-warn-text'}`}>
                {paidFitResult.fits ? (
                  <p>
                    ✅ To the best of our knowledge, your statement supports what you declared - you look good to go for your
                    appointment. This is a rough automatic check, not a guarantee, so it&apos;s still worth a last look yourself
                    before you go.
                  </p>
                ) : (
                  <>
                    <p className="mb-2">
                      ⚠️ This doesn&apos;t clearly match - you declared about {fmtN(paidFitResult.declaredAmount)}, but your
                      statement&apos;s latest balance shows about {fmtN(paidFitResult.latestBalance)}. This doesn&apos;t
                      necessarily mean anything is wrong (statements move around, and forms sometimes ask for a different kind of
                      figure), but it&apos;s worth having a second pair of eyes on it before your appointment.
                    </p>
                    <div className="flex flex-wrap gap-2">
                      <a
                        href={`https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(paidFinanceMismatchMessage())}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="rounded-md bg-accent px-3 py-1.5 text-sm font-semibold text-white hover:opacity-90"
                      >
                        💬 Contact us about this
                      </a>
                      <a
                        href={`mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent('My form and bank statement don’t match')}&body=${encodeURIComponent(paidFinanceMismatchMessage())}`}
                        className="rounded-md border border-black/10 px-3 py-1.5 text-sm font-medium text-[#12232e] hover:bg-black/5"
                      >
                        ✉️ Email instead
                      </a>
                    </div>
                  </>
                )}
              </div>
            )}
          </div>

          <p className="mb-3 text-sm text-[#4c6270]">
            A paid Document Review is also available - a person with twenty years&apos; experience checks your form, passport
            and statements for completeness and quality before your appointment, for ₦35,000 (about $22), delivered within 3
            working days. Message us and attach what you&apos;d like reviewed.
          </p>
          <div className="flex flex-wrap gap-2">
            <a
              href={`https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(paidMessage())}`}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-md bg-accent px-4 py-2 text-sm font-semibold text-white hover:opacity-90"
            >
              💬 Message us for a review
            </a>
            <a
              href={`mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent('Document Review - already applied')}&body=${encodeURIComponent(paidMessage())}`}
              className="rounded-md border border-black/10 px-4 py-2 text-sm font-medium text-[#12232e] hover:bg-black/5"
            >
              ✉️ Email instead
            </a>
          </div>
        </div>
      )}

      {/* Task #410 (direct request): "Re-Applying" follow-up — a short history of the applicant's
          time with this visa. Built as a `card-surface` box (the same white rounded-2xl card the
          homepage's stat boxes and the country picker's grid use — app/page.tsx,
          app/checklist/start/page.tsx), with a text-warn heading matching this box's own tone from
          the grid above, rather than the plainer `rounded-lg border` boxes the refused/paid panels
          above use — this is the newest addition, so it gets the fuller "same principle as the
          home page" treatment the user asked for by name.
          Five fields, in the order given: (1) when the last visa was issued, (2) how long that
          visa was valid for (value + unit, since "months or years" wasn't a fixed choice), (3) how
          many times it was actually used, (4) the most recent trip taken on it, and (5) a
          per-trip "how many days did you spend" list — sized automatically to match (3) via the
          effect above, so ticking "3" grows exactly 3 day-boxes without the applicant having to
          add rows by hand. Each trip gets its own small box (bg-cream-soft card) inside a
          responsive grid — the literal "make it in a box" instruction — rather than one plain
          list, so a single long list of numbers doesn't blur together. Ephemeral component state
          only, same as the refused-follow-up fields above — nothing is sent or saved until the
          applicant chooses to use it themselves later (this data isn't wired into a message or
          the checklist yet, since none was requested). */}
      {kind === 'reapplying' && (
        <div className="card-surface flex flex-col gap-4 p-4">
          <p className="text-base font-extrabold leading-snug text-warn">🔁 Your history with this visa</p>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-medium text-[#12232e]" htmlFor="reapp-last-visa-date">
                When did you last get this visa?
              </label>
              <input
                id="reapp-last-visa-date"
                type="month"
                min={monthInputRange.min}
                max={monthInputRange.max}
                value={reappLastVisaDate}
                onChange={(e) => setReappLastVisaDate(e.target.value)}
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
              />
            </div>

            <div>
              <label className="mb-1 block text-xs font-medium text-[#12232e]">How long was that visa valid for?</label>
              <div className="flex gap-2">
                <input
                  type="number"
                  min={0}
                  inputMode="numeric"
                  value={reappValidityValue}
                  onChange={(e) => setReappValidityValue(e.target.value)}
                  placeholder="e.g. 5"
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                />
                <select
                  value={reappValidityUnit}
                  onChange={(e) => setReappValidityUnit(e.target.value as 'months' | 'years')}
                  className="rounded-md border border-gray-300 px-2 py-2 text-sm"
                >
                  <option value="months">Months</option>
                  <option value="years">Years</option>
                </select>
              </div>
            </div>

            <div>
              <label className="mb-1 block text-xs font-medium text-[#12232e]" htmlFor="reapp-times-used">
                How many times did you use this visa?
              </label>
              <input
                id="reapp-times-used"
                type="number"
                min={0}
                inputMode="numeric"
                value={reappTimesUsed}
                onChange={(e) => setReappTimesUsed(e.target.value)}
                placeholder="e.g. 3"
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
              />
            </div>

            <div>
              <label className="mb-1 block text-xs font-medium text-[#12232e]" htmlFor="reapp-last-travel-date">
                When was the last time you travelled with this visa?
              </label>
              <input
                id="reapp-last-travel-date"
                type="month"
                min={monthInputRange.min}
                max={monthInputRange.max}
                value={reappLastTravelDate}
                onChange={(e) => setReappLastTravelDate(e.target.value)}
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
              />
            </div>
          </div>

          {reappTripDays.length > 0 && (
            <div>
              <p className="mb-2 text-xs font-medium text-[#12232e]">
                For each of those {reappTripDays.length} trip{reappTripDays.length === 1 ? '' : 's'}, how many days did you spend?
              </p>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {reappTripDays.map((days, i) => (
                  <div key={i} className="rounded-lg border border-black/10 bg-cream-soft p-2">
                    <label className="mb-1 block text-[11px] font-medium text-[#566a76]" htmlFor={`reapp-trip-days-${i}`}>
                      Trip {i + 1}
                    </label>
                    <div className="flex items-center gap-1">
                      <input
                        id={`reapp-trip-days-${i}`}
                        type="number"
                        min={0}
                        inputMode="numeric"
                        value={days}
                        onChange={(e) => updateReappTripDay(i, e.target.value)}
                        placeholder="Days"
                        className="w-full rounded-md border border-gray-300 bg-white px-2 py-1.5 text-sm"
                      />
                      <span className="text-xs text-[#8a99a3]">days</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Follow-up selection "Fix the docs-gate drop-off": the funnel recheck found this app has no
          direct equivalent of index.html's old docs-gate step, but this gate plays the same
          structural role — a required screen between the country/consent pick and the real
          checklist that every applicant must pass through. It previously rendered NO continue
          affordance at all until one of the three options above was picked, with nothing telling
          the applicant that picking one is what unlocks it — a silent dead end for anyone who
          didn't realize the cards above were clickable requirements, not just descriptive text.
          Now it always renders (matching /checklist/start's own disabled-button-plus-hint pattern
          just one screen earlier in this same flow), so there's always a visible next step. */}
      {kind ? (
        <Link
          href={checklistHref}
          onClick={() => trackEvent('situation_continue')}
          className="w-full rounded-lg bg-accent px-4 py-3 text-center font-semibold text-white hover:opacity-90"
        >
          {kind === 'fresh' || kind === 'reapplying' ? 'Continue to my checklist →' : 'Continue to my checklist anyway →'}
        </Link>
      ) : (
        <div>
          <button
            type="button"
            disabled
            className="w-full cursor-not-allowed rounded-lg bg-accent px-4 py-3 text-center font-semibold text-white opacity-40"
          >
            Continue to my checklist →
          </button>
          <p className="mt-2 text-center text-xs text-[#566a76]">Pick one of the options above to continue.</p>
        </div>
      )}
      <Link href="/checklist/start" className="text-center text-xs text-accent underline">
        ← Back
      </Link>
      </div>
    </main>
  );
}

function SituationOption({
  tone,
  icon,
  title,
  desc,
  selected,
  onClick,
}: {
  tone: 'good' | 'warn';
  icon: string;
  title: string;
  desc: string;
  selected: boolean;
  onClick: () => void;
}) {
  const isGood = tone === 'good';
  return (
    // Task #414 (direct request, two side-by-side screenshots comparing the homepage's stat boxes
    // to these): the homepage's boxes use `p-6` padding, a `text-xl` headline and `text-sm`
    // description (app/page.tsx) — these boxes had shrunk that down to `p-4`/`text-base`/`text-xs`
    // along the way, making them visibly smaller/denser than their homepage counterparts despite
    // using the same card-surface/dark-navy box language. Bumped all three to match the homepage
    // exactly, plus `gap-2` (homepage's headline-to-caption spacing is `mt-2`, ~8px, vs. the
    // `gap-1` here being only 4px).
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      onClick={onClick}
      className={
        isGood
          ? `card-surface flex flex-col gap-2 p-6 text-left transition ${
              selected ? 'ring-2 ring-good' : 'hover:bg-black/5'
            }`
          : `flex flex-col gap-2 rounded-2xl bg-[#12232e] p-6 text-left text-white transition ${
              selected ? 'ring-2 ring-warn' : 'hover:bg-white/5'
            }`
      }
    >
      <p className={`text-xl font-extrabold leading-snug ${isGood ? 'text-good' : 'text-warn'}`}>
        <span aria-hidden>{icon}</span> {title}
      </p>
      <p className={`text-sm ${isGood ? 'text-[#4c6270]' : 'text-white/70'}`}>{desc}</p>
    </button>
  );
}
