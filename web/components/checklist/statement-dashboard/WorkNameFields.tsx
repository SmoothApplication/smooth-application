'use client';

import {
  buildWorkNameCheckMessages,
  WorkNameCheckResult,
  inflowKey,
  WORK_PAYMENT_REASON_CATEGORIES,
  WorkCategoryMap,
  resolveWorkCategoryChoice,
  workPaymentCategoryLabel,
  buildIncomeMatchMessage,
  IncomeMatchResult,
} from '@/lib/statement';
import { formatAmount, formatDate, NarrationDecoder } from './shared';

export function WorkNameFields({
  label,
  name,
  setName,
  altName,
  setAltName,
  check,
  categoryChoices,
  setCategoryChoices,
  declaredMonthlyIncome,
  setDeclaredMonthlyIncome,
  incomeMatch,
}: {
  label: string;
  name: string;
  setName: (v: string) => void;
  altName: string;
  setAltName: (v: string) => void;
  check: WorkNameCheckResult | null;
  categoryChoices: WorkCategoryMap;
  setCategoryChoices: (updater: (prev: WorkCategoryMap) => WorkCategoryMap) => void;
  declaredMonthlyIncome: number;
  setDeclaredMonthlyIncome: (v: number) => void;
  incomeMatch: IncomeMatchResult | null;
}) {
  const idBase = `statement-${label.toLowerCase()}-name`;
  const messages = check ? buildWorkNameCheckMessages(check) : [];
  const incomeMatchMessage = incomeMatch ? buildIncomeMatchMessage(incomeMatch) : null;

  function setCategory(key: string, category: string) {
    setCategoryChoices((prev) => ({ ...prev, [key]: { ...prev[key], category } }));
  }
  function setCategoryDetail(key: string, detail: string) {
    setCategoryChoices((prev) => ({ ...prev, [key]: { category: prev[key]?.category || 'others', detail } }));
  }
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
        <div>
          <label className="mb-1 block text-xs font-medium text-[#566a76]" htmlFor={`${idBase}-declared-income`}>
            What you say this {label.toLowerCase()} pays you/month{' '}
            <span className="font-normal">(optional — ₦/month)</span>
          </label>
          <input
            id={`${idBase}-declared-income`}
            type="number"
            min={0}
            inputMode="numeric"
            value={declaredMonthlyIncome || ''}
            onChange={(e) => setDeclaredMonthlyIncome(Math.max(0, Number(e.target.value) || 0))}
            placeholder="e.g. 500000"
            className="w-full rounded-lg border border-black/10 px-3 py-2 text-sm text-[#12232e]"
          />
          <p className="mt-1 text-xs text-[#566a76]">
            We&apos;ll compare this against what actually lands from &quot;{name || `your ${label.toLowerCase()}`}&quot;
            in this statement.
          </p>
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

      {incomeMatchMessage && (
        <div
          className={`mt-2 rounded-lg p-3 text-sm ${
            incomeMatchMessage.status === 'ok' ? 'bg-good-wash text-good' : 'bg-warn-wash text-warn-text'
          }`}
        >
          {incomeMatchMessage.status === 'ok' ? '✅ ' : '⚠️ '}
          {incomeMatchMessage.message}
        </div>
      )}

      {check && check.inflowMatches.length > 0 && (
        <div className="mt-2">
          <p className="mb-1 text-xs font-medium text-[#12232e]">
            Matched payment{check.inflowMatches.length === 1 ? '' : 's'} ({check.inflowMatches.length}) — confirm
            or correct what each one was for:
          </p>
          <ul className="flex flex-col gap-2">
            {check.inflowMatches.map((t, i) => {
              const key = inflowKey(t);
              const hint = check.inflowCategoryHints[i];
              const choice = resolveWorkCategoryChoice(t, hint, categoryChoices);
              return (
                <li key={key} className="rounded-lg border border-black/10 p-2 text-xs text-[#4c6270]">
                  <div>
                    {formatDate(t.date)} — {formatAmount(t.credit)}
                    {t.narration ? ` ("${t.narration}")` : ' (no narration)'}
                  </div>
                  {t.narration && <NarrationDecoder narration={t.narration} />}
                  <div className="mt-1 flex flex-wrap items-center gap-2">
                    <select
                      value={choice.category}
                      onChange={(e) => setCategory(key, e.target.value)}
                      className="rounded-lg border border-black/10 px-2 py-1 text-xs text-[#12232e]"
                    >
                      <option value="">Choose a reason…</option>
                      {WORK_PAYMENT_REASON_CATEGORIES.map((c) => (
                        <option key={c.value} value={c.value}>
                          {c.label}
                        </option>
                      ))}
                    </select>
                    {!choice.category && hint && (
                      <span className="text-[10px] text-[#566a76]">
                        (looks like it might be &quot;{workPaymentCategoryLabel(hint)}&quot;, from the narration)
                      </span>
                    )}
                  </div>
                  {choice.category === 'others' && (
                    <input
                      type="text"
                      value={choice.detail || ''}
                      onChange={(e) => setCategoryDetail(key, e.target.value)}
                      placeholder="What was this payment for?"
                      className="mt-1 w-full rounded-lg border border-black/10 px-2 py-1 text-xs text-[#12232e]"
                    />
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}
