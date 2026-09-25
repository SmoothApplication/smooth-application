// Generic date extraction + passport-specific printed-text fallbacks, ported from index.html
// (~lines 9899-9969, 9978-10023).
//
// stripMrzLines lives in mrz.ts, which itself calls extractPrintedBirthDate/extractPrintedExpiryDate
// from this module (parseMrzFields's fallback chain). Both sides only call into the other from inside
// function bodies (never at module-init time), so this circular import is safe with ES module live
// bindings — same pattern already used between lib/statement/names.ts and lib/statement/classify.ts.
import type { ExtractDatesOptions } from './types';
import { stripMrzLines } from './mrz';

/** Generic date extractor with passport-specific OCR tolerances — matches "DD/MM/YYYY"-style,
 * "DD MON YY(YY)" (tolerant of a bilingual second-language month token and the classic "0 read as O"
 * OCR confusion in either month token), and "MON DD, YYYY" shapes anywhere in `text`. */
export function extractDates(text: string, opts?: ExtractDatesOptions): Date[] {
  const out: Date[] = [];
  const minYear = opts && opts.minYear != null ? opts.minYear : 1990;
  const maxYear = opts && opts.maxYear != null ? opts.maxYear : 2100;
  const patterns = [
    /\b(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})\b/g,
    // "DD MON YY(YY)" — tolerant of the messier real-world OCR shapes a bilingual passport date
    // comes back as. Two client photos surfaced two different variants of the same underlying
    // "English / French" printed date (e.g. "10 JUL / JUIL 34" or, once the "/" itself got
    // dropped and the two day-digits got merged/misread, "5OCT OCT 27"): the optional
    // "(?:\s*\/?\s*[a-z]{3,4}\.?)?" tolerates the second-language word whether or not a "/"
    // survives between the two, "\s*" (not "\s+") between day and month tolerates them running
    // together with no space, and "0ct" alongside "oct" tolerates a leading zero digit standing
    // in for the letter "O" (classic OCR confusion). Year accepts 2 or 4 digits too — these
    // printed passport dates are routinely just 2 digits ("34", not "2034"), which the old
    // 4-digit-only requirement silently failed to match at all, even though the date was sitting
    // right there correctly OCR'd in the text.
    // Real case, off a client's actual passport (the "06 OCT / OCT 27" expiry date sitting right
    // next to the photo/hologram — the exact spot already flagged above as prone to worse OCR):
    // the second-language month token can independently pick up the same "0 read as O" confusion
    // the FIRST month token already tolerates (via the explicit "0ct" alternative below) — but the
    // second token's own pattern used to be a generic [a-z]{3,4}, which can't match a leading "0"
    // at all, since a digit isn't in that character class. When BOTH "OCT"s got OCR'd as "0CT", the
    // whole date silently failed to match — dropping straight through every fallback (MRZ checksum,
    // label-based printed-text search) to a bare "not detected", even though the date was sitting
    // right there, just one character off. [a-z0][a-z]{2,3} tolerates the same substitution in the
    // FIRST character only (matching how the "0ct" alternative above is shaped) while still accepting
    // any 3-4 letter second-language word after that, same as before (e.g. French "JUIL" for July).
    /\b(\d{1,2})\s*(jan|feb|mar|apr|may|jun|jul|aug|sep|0ct|oct|nov|dec)[a-z]*\.?(?:\s*\/?\s*[a-z0][a-z]{2,3}\.?)?\s+(\d{2,4})\b/gi,
    /\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\s+(\d{1,2}),?\s+(\d{4})\b/gi,
  ];
  const months: Record<string, number> = {
    jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5, jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11,
  };
  patterns.forEach((re, idx) => {
    let m: RegExpExecArray | null;
    while ((m = re.exec(text)) !== null) {
      let d: Date | null;
      try {
        if (idx === 0) {
          const dd = parseInt(m[1], 10);
          const mm = parseInt(m[2], 10) - 1;
          let yy = parseInt(m[3], 10);
          if (yy < 100) yy += 2000;
          d = new Date(yy, mm, dd);
        } else if (idx === 1) {
          let yy1 = parseInt(m[3], 10);
          if (yy1 < 100) {
            // A bare 2-digit year is genuinely ambiguous (1934 vs. 2034 read the same either way).
            // Two independent signals help pick the century, and either one is enough:
            //  1) the text right before the match calls it out as an expiry (e.g. "Date of Expiry
            //     / Date d'Expiration ... 10 JUL / JUIL 34") — but real-world OCR doesn't reliably
            //     preserve that label (it garbled completely on one test run of an otherwise-clean
            //     photo), so this alone isn't something to depend on;
            //  2) reading it as 20xx lands in a plausible near-present/near-future window. Passports
            //     are valid at most ~10 years, so if 2000+yy is wildly far out (e.g. a birth year
            //     like "88" naively read as 2088, 60+ years from now) it's almost certainly actually
            //     a 19xx date instead — this is what actually caught a real bug during testing here,
            //     where a misread birth year nearly overrode the correct expiry date as "more future".
            const precedingCtx = text.slice(Math.max(0, m.index - 150), m.index).toLowerCase();
            const nowYear = new Date().getFullYear();
            const cand2000 = 2000 + yy1;
            const plausibleNearFuture = cand2000 >= nowYear - 5 && cand2000 <= nowYear + 20;
            yy1 = /expir/.test(precedingCtx) || plausibleNearFuture ? cand2000 : 1900 + yy1;
          }
          d = new Date(yy1, months[m[2].toLowerCase().replace(/^0/, 'o').slice(0, 3)], parseInt(m[1], 10));
        } else {
          d = new Date(parseInt(m[3], 10), months[m[1].toLowerCase().slice(0, 3)], parseInt(m[2], 10));
        }
      } catch {
        d = null;
      }
      if (d && !isNaN(d.getTime()) && d.getFullYear() > minYear && d.getFullYear() < maxYear) out.push(d);
    }
  });
  return out;
}

// A birth date's own MRZ check digit sometimes can't be trusted back to a single answer — a handful
// of OCR-confusable digit pairs (like "3"/"8") are mathematically indistinguishable to the check-digit
// maths once a field contains more than one of them (see the note above where this is used). Most
// passport bio pages also print "Date of birth" in plain text, in a different, usually larger font, on
// a different part of the page — an independent second OCR read this can fall back to. Deliberately
// scoped to a plausible human age range (0-120 years) rather than extractDates' default near-present/
// near-future window, which exists for expiry dates and would incorrectly reject a real birth date.
export const BIRTH_DATE_LABEL_RE =
  /(date\s*of\s*birth|birth\s*date|d\.?\s*o\.?\s*b\.?|date\s*de\s*naissance|n[ée]e?\s+le)/i;
export function extractPrintedBirthDate(text: string): Date | null {
  if (!text) return null;
  const vizText = stripMrzLines(text);
  const m = BIRTH_DATE_LABEL_RE.exec(vizText);
  if (!m) return null;
  const windowText = vizText.slice(m.index, m.index + m[0].length + 60);
  const nowYear = new Date().getFullYear();
  const found = extractDates(windowText, { minYear: nowYear - 120, maxYear: nowYear });
  return found.length ? found[0] : null;
}

// Same fallback as extractPrintedBirthDate just above, for the expiry date. Real case this fixes:
// a passport scan where OCR noise landed a non-digit character inside the MRZ's expiry field
// (positions 22-27 of line 2) — unlike a simple confusable-digit swap (e.g. "8" read as "3", which
// findMrzFieldCorrectionCandidates in validateMrz() already fixes), a genuinely non-digit character
// there can't be checksum-corrected at all, so both the checksum AND the parsed date came back
// null ("Expires: not detected") even though the birth date field, hit by the same kind of misread,
// had this same printed-text fallback to catch it. Scoped to a plausible near-future window (most
// passports are valid 5-10 years), not extractPrintedBirthDate's near-past-only window.
export const EXPIRY_DATE_LABEL_RE =
  /(date\s*of\s*expir|expir\w*\s*date|exp\.?\s*date|date\s*d[’']?expiration)/i;
// Real user report, even after fixMrzDateLetters above: the label match itself still came back empty
// on one real scan — the "Date of Expiry / Date d'Expiration" label sits close to the photo and
// security hologram on most bio pages, an area that tends to OCR worse than the plain label/value
// text elsewhere on the page, so the full "date ... expir..." phrase sometimes doesn't survive
// intact even when a shorter fragment of it does. Tried only as a second, looser pass — after the
// more specific pattern above has already failed to find anything — since a bare "expir" is common
// enough in unrelated prose (e.g. a "may result in expiry of your status" disclaimer) that using it
// as the FIRST attempt would risk anchoring on the wrong part of the page.
export const EXPIRY_BARE_LABEL_RE = /expir\w*/i;
export function extractPrintedExpiryDate(text: string): Date | null {
  if (!text) return null;
  const vizText = stripMrzLines(text);
  const nowYear = new Date().getFullYear();
  const tryLabel = (re: RegExp): Date | null => {
    const m = re.exec(vizText);
    if (!m) return null;
    // Looks a little before the label too, not just after — a real bio page's two-column layout
    // (issue date + authority side by side) doesn't always put the value strictly after its label
    // the way extractPrintedBirthDate's simpler, single-column layout usually does.
    const start = Math.max(0, m.index - 30);
    const windowText = vizText.slice(start, m.index + m[0].length + 60);
    const found = extractDates(windowText, { minYear: nowYear - 1, maxYear: nowYear + 15 });
    return found.length ? found[0] : null;
  };
  return tryLabel(EXPIRY_DATE_LABEL_RE) || tryLabel(EXPIRY_BARE_LABEL_RE);
}
