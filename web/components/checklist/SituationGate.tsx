'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  SituationKind,
  RefusalRouting,
  computeRefusalRouting,
  refusalSuggestionText,
  parseRefusalDateFromText,
} from '@/lib/situation';
import { extractLetterText } from '@/lib/situation/extractLetterText';

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

  function destName() {
    return isTravelReadiness ? `${name} trip` : `${name} application`;
  }

  function selectKind(next: SituationKind) {
    setKind(next);
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
    return `Hi, I've already paid the fee and filled my ${destName()} form. I'm interested in the paid Document Review (70% off for the first 100 applicants - $4 instead of $14) before my appointment.`;
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-lg flex-col gap-5 p-6 pb-16">
      <div>
        <h1 className="text-xl font-semibold text-[#12232e]">🧭 Where are you in the process?</h1>
        <p className="mt-1 text-sm text-[#4c6270]">Just so we can point you the right way - answering doesn&apos;t change what&apos;s ahead unless you want it to.</p>
      </div>

      <div className="flex flex-col gap-2" role="radiogroup" aria-label="Where are you in the process?">
        <SituationOption
          icon="🆕"
          title="This is a fresh application"
          desc="Haven't applied for this visa before, or it's been a while"
          selected={kind === 'fresh'}
          onClick={() => selectKind('fresh')}
        />
        <SituationOption
          icon="📄"
          title="I've been refused before"
          desc="For this visa, or any other, in the last few years"
          selected={kind === 'refused'}
          onClick={() => selectKind('refused')}
        />
        <SituationOption
          icon="✅"
          title="I've already paid the fee and filled the form"
          desc="Applied already - want a second pair of eyes before your appointment"
          selected={kind === 'paid'}
          onClick={() => selectKind('paid')}
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
          {letterText && (
            <div className="mb-2 max-h-44 overflow-y-auto whitespace-pre-wrap rounded-md bg-black/5 p-2 text-xs text-[#4c6270]">
              {letterText}
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
          <p className="mb-3 text-sm text-[#4c6270]">
            We&apos;re testing a paid Document Review - a real person checks your form, passport and statements for completeness
            and quality before your appointment, from $4 (about ₦6,600) for our first 100 applicants. Message us and attach what
            you&apos;d like reviewed.
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

      {kind && (
        <Link
          href={checklistHref}
          className="w-full rounded-lg bg-accent px-4 py-3 text-center font-semibold text-white hover:opacity-90"
        >
          {kind === 'fresh' ? 'Continue to my checklist →' : 'Continue to my checklist anyway →'}
        </Link>
      )}
      <Link href="/checklist/start" className="text-center text-xs text-accent underline">
        ← Back
      </Link>
    </main>
  );
}

function SituationOption({
  icon,
  title,
  desc,
  selected,
  onClick,
}: {
  icon: string;
  title: string;
  desc: string;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      onClick={onClick}
      className={`flex items-start gap-3 rounded-lg border px-3 py-2.5 text-left text-sm transition ${
        selected ? 'border-accent bg-accent-wash' : 'border-black/10 hover:border-accent/50'
      }`}
    >
      <span aria-hidden>{icon}</span>
      <span>
        <span className="block font-medium text-[#12232e]">{title}</span>
        <span className="block text-xs text-[#566a76]">{desc}</span>
      </span>
    </button>
  );
}
