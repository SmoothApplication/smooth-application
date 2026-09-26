// Refusal-letter auto-routing — ported from index.html's #situationGate JS (~line 16329-16427).
// Field/founder request: read an uploaded refusal letter — entirely on-device, reusing the same
// OCR pipeline as everywhere else in this app — and use it to SUGGEST a starting point, never to
// state a diagnosis. Giving automated advice tied to a specific refusal reason edges into
// OISC/RCIC-regulated "immigration advice" territory, so every suggestion is phrased as just that
// (a suggestion), and — this is the important part — the actual routing decision below is driven
// ONLY by two plain facts the APPLICANT answers themselves (when they were refused, and whether
// their own reading of the letter was mainly about finances), never by this app's own reading or
// classification of the letter's content. See web/lib/situation/extractLetterText.ts and the block
// comment above #situationRefusedUpload in index.html for the redesign that enforced this split.
//
// Routing rule (product decision, see CHANGELOG): a letter with financial wording (proof of funds,
// bank statement, sufficient funds, etc. — real UK Home Office refusal-letter boilerplate)
// suggests Income & bank statement analysis regardless of how long ago it was, since that's the
// thing to revisit either way. Otherwise, it comes down to how recent the refusal was: within the
// last RECENT_REFUSAL_MONTHS months, little has likely changed, so still straight to Income & bank
// statement analysis; older than that, enough could plausibly have changed (passport validity,
// personal circumstances) that starting fresh from the passport scan is the safer suggestion.

import { RefusalRouting } from './types';

export const RECENT_REFUSAL_MONTHS = 6;

/** refusalTextLooksFinancial is kept available for tests (and any future informational-only use)
 * even though the live routing decision no longer calls it to drive anything automatically — see
 * the block comment above. The applicant's OWN answer to "was it mainly about finances?" is what
 * actually feeds computeRefusalRouting. */
export const FINANCIAL_REFUSAL_KEYWORDS = [
  'sufficient funds',
  'insufficient funds',
  'source of funds',
  'source of income',
  'financial circumstances',
  'financial situation',
  'financial standing',
  'maintain and accommodate',
  'maintenance and accommodation',
  'bank statement',
  'bank statements',
  'genuine and available',
  'evidence of your income',
  'evidence of your savings',
  'level of funds',
  'financial history',
  'proof of funds',
  'personal financial',
  'economic situation',
  'available to you',
];

export function refusalTextLooksFinancial(text: string): boolean {
  const norm = String(text || '')
    .toLowerCase()
    .replace(/\s+/g, ' ');
  return FINANCIAL_REFUSAL_KEYWORDS.some((kw) => norm.indexOf(kw) !== -1);
}

const REFUSAL_MONTH_NAMES =
  'jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t|tember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?';
const REFUSAL_MONTH_MAP: Record<string, number> = {
  jan: 0,
  feb: 1,
  mar: 2,
  apr: 3,
  may: 4,
  jun: 5,
  jul: 6,
  aug: 7,
  sep: 8,
  oct: 9,
  nov: 10,
  dec: 11,
};

function refusalMonthIndexFromName(name: string): number {
  const key = String(name || '').slice(0, 3).toLowerCase();
  return Object.prototype.hasOwnProperty.call(REFUSAL_MONTH_MAP, key) ? REFUSAL_MONTH_MAP[key] : -1;
}

/** Tries "14 September 2026" / "14 Sep 2026" style first (most common on UK Home Office letters),
 * then the US "September 14, 2026" order, then plain numeric DD/MM/YYYY — stops at the first
 * match rather than trying to reconcile several, same "trust the first clean read" approach used
 * for passport dates elsewhere in this app. */
function findDateInRefusalText(text: string): Date | null {
  const reWordy = new RegExp('\\b(\\d{1,2})(?:st|nd|rd|th)?\\s+(' + REFUSAL_MONTH_NAMES + ')\\.?,?\\s+(\\d{4})\\b', 'i');
  const m = text.match(reWordy);
  if (m) {
    const mi = refusalMonthIndexFromName(m[2]);
    if (mi !== -1) {
      const d = new Date(Number(m[3]), mi, Number(m[1]));
      if (!Number.isNaN(d.getTime())) return d;
    }
  }
  const reWordyUS = new RegExp('\\b(' + REFUSAL_MONTH_NAMES + ')\\.?\\s+(\\d{1,2})(?:st|nd|rd|th)?,?\\s+(\\d{4})\\b', 'i');
  const m2 = text.match(reWordyUS);
  if (m2) {
    const mi2 = refusalMonthIndexFromName(m2[1]);
    if (mi2 !== -1) {
      const d2 = new Date(Number(m2[3]), mi2, Number(m2[2]));
      if (!Number.isNaN(d2.getTime())) return d2;
    }
  }
  const reNumeric = /\b(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})\b/;
  const m3 = text.match(reNumeric);
  if (m3) {
    const day = Number(m3[1]);
    const mon = Number(m3[2]) - 1;
    const yr = Number(m3[3]);
    if (mon >= 0 && mon <= 11 && day >= 1 && day <= 31) {
      const d3 = new Date(yr, mon, day);
      if (!Number.isNaN(d3.getTime())) return d3;
    }
  }
  return null;
}

/** Biased toward the top of the letter, where a decision date normally sits (letterhead/reference
 * block) — falls back to scanning the whole document if nothing turns up there, rather than never
 * matching a letter whose date happens to sit lower on the page. */
export function parseRefusalDateFromText(text: string): Date | null {
  const norm = String(text || '').replace(/\r/g, '');
  const head = norm.slice(0, 1200);
  return findDateInRefusalText(head) || findDateInRefusalText(norm);
}

export function refusalMonthsBetween(date: Date, now: Date): number {
  let months = (now.getFullYear() - date.getFullYear()) * 12 + (now.getMonth() - date.getMonth());
  if (now.getDate() < date.getDate()) months -= 1;
  return months;
}

/** `now` defaults to the real current time — overridable so tests aren't at the mercy of when
 * they happen to run. `dateObj` may be null (see RefusalRouting's own doc comment). */
export function computeRefusalRouting(
  dateObj: Date | null,
  isFinancial: boolean,
  now: Date = new Date()
): RefusalRouting {
  const months = dateObj ? refusalMonthsBetween(dateObj, now) : null;
  if (!isFinancial && months !== null && months > RECENT_REFUSAL_MONTHS) {
    return { target: 'restart', months };
  }
  return { target: 'finance2', months };
}

/** Returns an HTML string (matches index.html's own innerHTML use for the `<b>` emphasis) — safe
 * to render since nothing here is ever built from user/letter input, only this fixed wording. */
export function refusalSuggestionText(routing: RefusalRouting, isFinancial: boolean): string {
  if (routing.target === 'finance2') {
    return isFinancial
      ? 'Letters like this often come down to your finances - you may want to start with <b>Income &amp; bank statement analysis</b>. You can still look at your full checklist any time.'
      : "That was recent enough that little has likely changed - <b>Income &amp; bank statement analysis</b> is probably the best place to pick up. You can still look at your full checklist any time.";
  }
  return "It's been a while since then, so a few things may have changed - starting fresh from your <b>passport scan</b> is probably the safer bet. You can still look at your full checklist any time.";
}
