'use client';

import { useState } from 'react';
import { SourceGroup, UNEXPLAINED_REASON_OPTIONS, suggestReasonForGroup } from '@/lib/statement';
import { formatAmount, formatDate, sourceTypeBadge, NAME_EDITABLE_TYPES, NO_EXPLANATION_NOTE, NarrationDecoder } from './shared';

export function SourceGroupCard({
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
  explanation,
  setExplanation,
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
  explanation: string;
  setExplanation: (v: string) => void;
}) {
  const badge = sourceTypeBadge(group.type);
  const nameEditable = NAME_EDITABLE_TYPES.has(group.type);
  const isEditingThis = editingName === group.name;
  const note = NO_EXPLANATION_NOTE[group.type];
  // Same "does this group even need an explanation" gate as the NO_EXPLANATION_NOTE text above —
  // reversals/self-transfers/interest/internal movements are the applicant's own money, not new
  // income from someone else, so asking "what was this for" would be a non-sequitur for them.
  const needsExplanation = !note;

  // Direct instruction: the reason dropdown used for flagged ₦50k+ inflows (ReasonDropdown, below)
  // only ever applied above that threshold — a small dividend/business credit like ₦143 or ₦200
  // still only got this card's plain free-text box, which read to the applicant as "the dropdown
  // disappeared" even though nothing broke (it was simply never wired up here). Every income
  // source now gets the same canonical-reason dropdown regardless of amount; "Other" still opens
  // free text for anything that doesn't fit. `explanation` stays a single persisted string either
  // way, so existing saved answers (typed before this change) round-trip as "Other" pre-filled
  // with whatever the applicant already wrote, rather than being lost.
  const matchedReasonOption = UNEXPLAINED_REASON_OPTIONS.find(
    (o) => o.value !== 'other' && o.label === explanation
  );
  const [reasonChoice, setReasonChoice] = useState<string>(() =>
    matchedReasonOption ? matchedReasonOption.value : explanation ? 'other' : ''
  );

  function handleReasonChoiceChange(value: string) {
    setReasonChoice(value);
    if (value === 'other') {
      // Only clear when switching away from a canonical pick — if the applicant lands on "Other"
      // because their existing free text didn't match any label, leave that text in place so it's
      // still visible/editable, not silently wiped.
      if (matchedReasonOption) setExplanation('');
    } else {
      const opt = UNEXPLAINED_REASON_OPTIONS.find((o) => o.value === value);
      setExplanation(opt ? opt.label : '');
    }
  }

  // Consultant-style "true or false": a suggested reason the client only has to confirm. Shown only
  // while the question is still unanswered; once answered, a small "Confirmed" tick appears if the
  // answer matches the suggestion. No new persisted state — "confirmed" simply means the saved
  // explanation equals the suggestion's label.
  const suggestion = needsExplanation ? suggestReasonForGroup(group) : null;
  const isConfirmed = !!suggestion && explanation === suggestion.label;

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
              ✏️ Edit sender name
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

      {suggestion && !explanation && (
        <div className="mt-2 rounded-lg bg-accent-wash p-2.5 text-xs text-[#12232e]">
          <p>
            <span className="font-semibold">Our suggestion: {suggestion.label}</span>{' '}
            <span className="text-[#566a76]">({suggestion.why}).</span> Is that right?
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => handleReasonChoiceChange(suggestion.value)}
              className="rounded-lg bg-accent px-3 py-1 text-xs font-semibold text-white"
            >
              ✓ Yes, that&apos;s right
            </button>
            <span className="self-center text-[#566a76]">or pick a different reason below.</span>
          </div>
        </div>
      )}

      {needsExplanation && (
        <div className="mt-2">
          <label className="mb-1 block text-xs font-medium text-[#566a76]">
            What was this for? <span className="font-normal">(optional, but a reviewer may ask)</span>
            {isConfirmed && <span className="ml-2 font-semibold text-good">✓ Confirmed</span>}
          </label>
          <select
            value={reasonChoice}
            onChange={(e) => handleReasonChoiceChange(e.target.value)}
            className="w-full rounded-lg border border-black/10 bg-white px-2 py-1.5 text-xs text-[#12232e]"
          >
            <option value="">Choose a reason…</option>
            {UNEXPLAINED_REASON_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
          {reasonChoice === 'other' && (
            <textarea
              value={explanation}
              onChange={(e) => setExplanation(e.target.value)}
              rows={2}
              placeholder="e.g. Rent I collect from my tenant, a loan repayment, a gift for my birthday…"
              className="mt-1.5 w-full rounded-lg border border-black/10 px-2 py-1.5 text-xs text-[#12232e]"
            />
          )}
        </div>
      )}

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
                {t.narration && <NarrationDecoder narration={t.narration} />}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
