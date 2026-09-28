// Pure, dependency-free text analysis for the refusal-letter reading aid
// (components/checklist/SituationGate.tsx). Task #415 (direct request, mid-turn message): "make it
// possible for applicant [to upload] letters of denial and the system should be able to scan
// through and read and pick words appeared often... summarize the reason why you were denied."
//
// This runs entirely on text that extractLetterText.ts has already pulled out of the applicant's
// PDF/photo on-device (see that file's own header) — nothing here makes a network call, sends
// anything anywhere, or depends on a third-party service. It's just word-counting and substring
// matching over a string already sitting in memory in the browser.
//
// Deliberately NOT a legal reading or diagnosis of the letter — see the "reading aid only" note
// above SituationGate's WHATSAPP_NUMBER/CONTACT_EMAIL constants, which this feature extends rather
// than replaces. It surfaces patterns (repeated words, matched stock phrases from known refusal
// categories) the same way a person skimming their own letter for what jumps out would; the UI that
// renders this (SituationGate.tsx) says as much, and nothing here should be presented to an
// applicant as a confirmed determination of why they were refused.

export interface WordCount {
  word: string;
  count: number;
}

export interface ReasonMatch {
  /** Human-readable category label, e.g. "Insufficient or unclear finances". */
  label: string;
  /** Which of that category's stock phrases were actually found in the letter. */
  matchedPhrases: string[];
  /** Total number of times any of this category's phrases appeared (a phrase repeated twice
   * counts twice) — used only to rank categories against each other, not shown as a raw number. */
  count: number;
}

export interface LetterAnalysis {
  /** Up to `limit` most-repeated meaningful words, most frequent first. */
  topWords: WordCount[];
  /** Every known refusal-reason category that matched at least one phrase, ranked by match count. */
  reasonMatches: ReasonMatch[];
  /** The best-supported category, or null if nothing matched. */
  primaryReason: ReasonMatch | null;
  /** True when the extracted text doesn't look like English — both topWords and reasonMatches are
   * English-only pattern matches, so callers should warn the applicant these may be unreliable
   * (or worthless) for a letter in another language, rather than silently showing nothing. */
  looksNonEnglish: boolean;
}

// General-English stopwords — common function words that would otherwise dominate any frequency
// count (the/and/of/to/...) without telling the applicant anything new. Deliberately separate from
// the bank-narration stopword list in lib/statement (different domain, different noise words), and
// also doubles as the word list looksEnglish() below checks against.
const STOPWORDS = new Set([
  'the', 'and', 'of', 'to', 'in', 'a', 'is', 'that', 'for', 'on', 'was', 'were', 'with', 'as', 'by',
  'an', 'be', 'this', 'it', 'are', 'or', 'have', 'has', 'had', 'not', 'your', 'you', 'we', 'our',
  'i', 'at', 'from', 'which', 'will', 'been', 'if', 'but', 'so', 'no', 'yes', 'their', 'they',
  'them', 'he', 'she', 'his', 'her', 'who', 'what', 'when', 'where', 'why', 'how', 'all', 'any',
  'can', 'could', 'would', 'should', 'may', 'might', 'must', 'shall', 'do', 'does', 'did', 'than',
  'then', 'there', 'here', 'also', 'about', 'into', 'out', 'up', 'down', 'over', 'under', 'again',
  'further', 'once', 'both', 'each', 'few', 'more', 'most', 'other', 'some', 'such', 'only', 'own',
  'same', 'too', 'very', 'just', 'dear', 'sincerely', 'yours', 'faithfully', 'regards',
]);

// Words that are common in refusal letters but too generic to be interesting as "words that came
// up often" (they'd otherwise crowd out anything more specific with real signal in it).
const LETTER_BOILERPLATE = new Set([
  'application', 'applicant', 'please', 'reference', 'date', 'dated', 'visa', 'entry', 'clearance',
  'officer', 'decision', 'immigration', 'rules', 'paragraph', 'united', 'kingdom',
]);

const WORD_RE = /[a-zA-Z]{3,}/g;

/** Counts meaningful (non-stopword, non-boilerplate) words in `text`, returning the `limit` most
 * frequent, ties broken alphabetically for stable output. A word that only appears once is
 * excluded — that isn't "appearing often", it's just part of normal prose. */
export function wordFrequency(text: string, limit = 8): WordCount[] {
  const counts = new Map<string, number>();
  const matches = text.match(WORD_RE) || [];
  for (const raw of matches) {
    const w = raw.toLowerCase();
    if (STOPWORDS.has(w) || LETTER_BOILERPLATE.has(w)) continue;
    counts.set(w, (counts.get(w) || 0) + 1);
  }
  return Array.from(counts.entries())
    .map(([word, count]) => ({ word, count }))
    .filter((wc) => wc.count > 1)
    .sort((a, b) => b.count - a.count || a.word.localeCompare(b.word))
    .slice(0, limit);
}

// Known refusal-reason categories, keyed by the stock phrasing UK Home Office refusal notices and
// Schengen refusal-notice checkboxes commonly use (the same publicly documented wording already
// reflected in this app's own refusal-routing copy — see lib/situation/routing.ts and
// components/checklist/SituationGate.tsx's refusal dropdown options — not invented fresh here).
// Kept as lowercase substrings so both a full sentence quote and a shorter paraphrase can match.
const REASON_CATEGORIES: { label: string; phrases: string[] }[] = [
  {
    label: 'Insufficient or unclear finances',
    phrases: [
      'insufficient funds',
      'insufficient evidence of funds',
      'financial circumstances',
      'unable to determine your financial',
      'source of your funds',
      'genuine and available funds',
      'level of funds',
      'personal bank statement',
      'bank statements you have provided',
      'maintain and accommodate yourself',
    ],
  },
  {
    label: 'Not satisfied you are a genuine visitor who will leave after your visit',
    phrases: [
      'genuine visitor',
      'genuinely seeking entry',
      'intend to leave',
      'leave the uk',
      'return to your country',
      'ties to your home country',
      'ties to nigeria',
      'circumstances in your home country',
      'compelling reason for you to leave',
      'genuine intention',
    ],
  },
  {
    label: 'Documents inconsistent, missing, or not considered credible',
    phrases: [
      'not satisfied that the documents',
      'documents you have provided are not',
      'inconsistent with',
      'discrepancies',
      'not a true reflection',
      'unable to verify',
      'not provided sufficient evidence',
      'credibility of your',
      'not satisfied that this evidence is reliable',
    ],
  },
  {
    label: 'Employment or income not adequately shown',
    phrases: [
      'employment circumstances',
      'evidence of your employment',
      'proof of income',
      'nature of your employment',
      'your salary',
      'self-employed',
      'employment status',
    ],
  },
  {
    label: 'Accommodation, sponsor, or travel plans unclear',
    phrases: [
      'accommodation in the uk',
      'itinerary',
      'purpose of your visit',
      'invitation letter',
      'relationship with your sponsor',
      'host in the uk',
      'details of your intended',
    ],
  },
  {
    label: 'Previous immigration history counted against you',
    phrases: [
      'previous refusal',
      'previously refused',
      'immigration history',
      'overstayed',
      'breach of immigration',
      'previous visa',
      'previously breached',
    ],
  },
];

/** Counts occurrences of each REASON_CATEGORIES phrase inside `text`, returning only the
 * categories that matched at least once, ranked highest-count first. */
export function matchReasonCategories(text: string): ReasonMatch[] {
  const lower = text.toLowerCase();
  const matches: ReasonMatch[] = [];
  for (const cat of REASON_CATEGORIES) {
    const matchedPhrases: string[] = [];
    let count = 0;
    for (const phrase of cat.phrases) {
      const occurrences = lower.split(phrase).length - 1;
      if (occurrences > 0) {
        matchedPhrases.push(phrase);
        count += occurrences;
      }
    }
    if (matchedPhrases.length > 0) {
      matches.push({ label: cat.label, matchedPhrases, count });
    }
  }
  return matches.sort((a, b) => b.count - a.count);
}

/** Rough heuristic: what fraction of the text's alphabetic "words" are common English function
 * words (the STOPWORDS list above — almost every English paragraph is full of them, and almost no
 * French/German/Spanish/etc. paragraph is, since those languages' function words look different).
 * A real language-ID model would be overkill for a yes/no "does this look like English" check, and
 * this keeps the module dependency-free. Short extracts (under 20 words) are given the benefit of
 * the doubt rather than flagged, since there isn't enough text to judge either way. */
export function looksEnglish(text: string): boolean {
  const words = (text.match(/[a-zA-Z]{2,}/g) || []).map((w) => w.toLowerCase());
  if (words.length < 20) return true;
  const stopwordHits = words.filter((w) => STOPWORDS.has(w)).length;
  return stopwordHits / words.length > 0.08;
}

/** Runs the full reading-aid analysis over already-extracted letter text: top repeated words,
 * matched refusal-reason categories, and an English-language sanity check. */
export function analyzeLetter(text: string): LetterAnalysis {
  const topWords = wordFrequency(text);
  const reasonMatches = matchReasonCategories(text);
  return {
    topWords,
    reasonMatches,
    primaryReason: reasonMatches[0] ?? null,
    looksNonEnglish: !looksEnglish(text),
  };
}
