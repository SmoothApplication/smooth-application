// MRZ (machine-readable zone) checksum validator + structured TD3 field decoder — ICAO Doc 9303,
// ported from index.html (~lines 9311-9321, 9337-9375, 9389-9487, 9488-9557, 9564-9642, 9648-9676).
//
// IMPORTANT: this is a FORMAT/CHECKSUM check only. A pass means the two-line strip at the bottom of the
// photo page is internally consistent — it does NOT confirm the document is genuine, unaltered, or
// unrevoked. A forged document can carry mathematically valid checksums (the algorithm is public), and a
// genuine passport can fail this check simply from a poor-quality photo or OCR misread. Real authenticity
// checks require the government/border systems used at a Visa Application Centre or port of entry — there
// is no publicly available API that verifies passport authenticity, and this module does not claim to.
import type {
  MrzChecks,
  MrzLinesWithIndex,
  MrzValidationResult,
  ParsedPassportFields,
} from './types';
// extractPrintedBirthDate/extractPrintedExpiryDate live in dates.ts, which itself imports
// stripMrzLines from this module (for its own fallback window text). Both sides only call into the
// other from inside function bodies (never at module-init time), so this circular import is safe with
// ES module live bindings — same pattern already used between lib/statement/names.ts and classify.ts.
import { extractPrintedBirthDate, extractPrintedExpiryDate } from './dates';

export function mrzCharValue(c: string): number {
  if (c >= '0' && c <= '9') return c.charCodeAt(0) - 48;
  if (c === '<') return 0;
  if (c >= 'A' && c <= 'Z') return c.charCodeAt(0) - 65 + 10;
  return 0;
}
export function mrzCheckDigit(str: string): number {
  const weights = [7, 3, 1];
  let sum = 0;
  for (let i = 0; i < str.length; i++) sum += mrzCharValue(str[i]) * weights[i % 3];
  return sum % 10;
}

// Real user report: a passport whose expiry field OCR'd with a letter in place of a digit (e.g. an
// "O" instead of "0") came back "Expires: not detected" — nothing wrong with the passport, but a
// genuinely non-digit character in a date field can't be checksum-corrected by the confusable-DIGIT
// swap below at all (a letter has no entry in MRZ_CONFUSABLE_DIGITS), so both the checksum test and
// mrzDateToDate's own `/^\d{6}$/` guard failed outright before that machinery ever got a chance to
// run — and the same misread letter, sitting close to the photo/security-hologram area of the page,
// meant the plain-text "Date of Expiry" fallback below sometimes doesn't find a usable date either.
// The MRZ date fields are digits-only by spec (ICAO 9303) — a letter can ONLY ever be a look-alike
// OCR misread of a digit here, never a genuine value, so unlike the swap-correction below (which
// must stay conservative because a field like the passport number legitimately mixes letters and
// digits) this is safe to apply unconditionally, the same reasoning MRZ_NAME_DIGIT_FIX already uses
// in the other direction for the (letters-only) name field. Applied BEFORE the checksum/swap
// machinery runs, so a field that's otherwise clean just has its one bad character normalized back
// to a real digit and validates immediately; genuinely wrong digits still fall through to the
// swap-correction and, failing that, the printed-text fallback exactly as before.
export const MRZ_DATE_LETTER_FIX: Record<string, string> = {
  O: '0', Q: '0', D: '0', I: '1', L: '1', Z: '2', S: '5', G: '6', B: '8',
};
export function fixMrzDateLetters(str: string): string {
  return (str || '').replace(/[A-Z]/g, (c) => MRZ_DATE_LETTER_FIX[c] || c);
}

// Real-world report: a passport's date of birth read as "3/9/1938" instead of the true "3/9/1988" —
// an "8" OCR'd as a "3", the same kind of look-alike-glyph misread already handled for letters in the
// name field (see MRZ_NAME_DIGIT_FIX above), but this time inside a field that legitimately contains
// digits, so it can't just be blindly "corrected" on sight. Instead this uses the MRZ's own check
// digit as a mathematical witness: only a handful of digit pairs commonly get confused by OCR, so
// trying a swap at each position — for confusable pairs only, not all 10 digits — and requiring the
// swap to be the ONE AND ONLY one that both restores a passing checksum and (for a date) still lands
// on a real calendar day, is strong enough evidence to trust. If two or more different swaps would
// each also pass, or none would, this deliberately backs off and leaves the field exactly as read.
export const MRZ_CONFUSABLE_DIGITS: Record<string, string[]> = {
  '0': ['8', '6'], '1': ['7'], '2': ['7'], '3': ['8'], '5': ['6', '8'],
  '6': ['5', '8', '0'], '7': ['1', '2'], '8': ['0', '3', '5', '6', '9'], '9': ['8'],
};
export function mrzDateDigitsPlausible(raw: string): boolean {
  if (!/^\d{6}$/.test(raw || '')) return false;
  const mm = parseInt(raw.slice(2, 4), 10);
  const dd = parseInt(raw.slice(4, 6), 10);
  return mm >= 1 && mm <= 12 && dd >= 1 && dd <= 31;
}

// Returns EVERY confusable-swap candidate that restores a passing checksum (and, where given, passes
// `validator` too) — not just a unique one. A single field's own check digit alone sometimes isn't
// selective enough on its own (swapping either of the two year digits can each coincidentally produce
// a still-plausible date whose checksum happens to also pass), so validateMrz() below uses the MRZ's
// separate composite check digit as a second, independent witness to break that kind of tie before
// deciding whether a correction is trustworthy enough to apply.
export function findMrzFieldCorrectionCandidates(
  raw: string,
  checkDigit: string,
  validator?: (candidate: string) => boolean,
): string[] {
  if (!/^\d$/.test(checkDigit || '') || mrzCheckDigit(raw) === +checkDigit) return [];
  const candidates: string[] = [];
  for (let i = 0; i < raw.length; i++) {
    const alts = MRZ_CONFUSABLE_DIGITS[raw[i]] || [];
    for (let j = 0; j < alts.length; j++) {
      const corrected = raw.slice(0, i) + alts[j] + raw.slice(i + 1);
      if (
        mrzCheckDigit(corrected) === +checkDigit &&
        (!validator || validator(corrected)) &&
        candidates.indexOf(corrected) === -1
      ) {
        candidates.push(corrected);
      }
    }
  }
  return candidates;
}

// Pads/truncates a near-enough-length OCR line to exactly `targetLen` characters and swaps any
// character outside the MRZ alphabet (A-Z, 0-9, <) for the filler character "<" — real-world OCR very
// commonly mangles the run of "<" padding at the end of an MRZ line (misreading both which characters
// are there AND how many of them there are), and that padding is meaningless filler anyway. Returns
// null if the line is too far off in length or has too many non-MRZ characters to trust.
//
// User report, off a real passport photographed on a low-end phone: the padding tail read as
// "K<<« «44K" instead of clean "<" filler — 9 characters short of 44 (some padding characters were
// dropped entirely, not just misread), well outside the old ±6 tolerance, so the whole line — and
// with it, the auto-filled name — was silently dropped even though the name/surname portion earlier
// in the same line read perfectly. Widened to ±10: still comfortably rejects the "Holder's Signature"
// false-positive documented below (30 chars, 14 short of 44 — stays well outside even this wider
// tolerance), while accepting this real, otherwise-clean read.
export function normalizeMrzLine(l: string, targetLen: number): string | null {
  if (l.length < targetLen - 10 || l.length > targetLen + 10) return null;
  if (l.length < targetLen) l = l + new Array(targetLen - l.length + 1).join('<');
  else if (l.length > targetLen) l = l.slice(0, targetLen);
  const badCount = (l.match(/[^A-Z0-9<]/g) || []).length;
  if (badCount > 6) return null;
  return l.replace(/[^A-Z0-9<]/g, '<');
}

// Real-data finding, off a real Nigerian passport photo: Tesseract inserted a single stray non-MRZ
// character (a ":" ) into the middle of an otherwise well-read 44-character line 2 — right after the
// 3-letter nationality field, where a passport photo's MRZ has no separator at all between fields.
// That one extra character shifts every field after it (birth date, sex, expiry date, personal
// number) one position to the right, so a fixed-width slice at the "correct" TD3 offsets reads
// garbage for all of them — even though nothing else about the line was misread. The only OCR defense
// that already existed (normalizeMrzLine) only handles a line being the WRONG LENGTH by padding or
// truncating at the very END; it has no way to recover from a single wrong character having been
// inserted somewhere in the MIDDLE, since simply removing a character from the end doesn't undo that.
//
// This tries removing each non-MRZ-alphabet character found in an over-length raw line (one at a
// time, and pairs of two, since a badly-scanned line can have more than one), and — critically — only
// prefers a reflowed candidate over the naive left-as-is reading when it demonstrably fixes MORE
// checksums than the original, never just because it produces "a" 44-character string. A line with no
// stray junk characters at all (the common case) never enters this path, since there's nothing to try
// removing — this only ever fires on a line that's already over-length AND contains characters outside
// A-Z0-9<, which a clean read never does.
function findJunkCharPositions(raw: string): number[] {
  const positions: number[] = [];
  for (let i = 0; i < raw.length; i++) {
    if (!/[A-Z0-9<]/.test(raw[i])) positions.push(i);
  }
  return positions;
}
function removeCharsAt(raw: string, positions: number[]): string {
  const set = new Set(positions);
  let out = '';
  for (let i = 0; i < raw.length; i++) if (!set.has(i)) out += raw[i];
  return out;
}
/** How many of line 2's own checksums a candidate 44-char string satisfies — used only to SCORE
 * candidate reflows against each other (see reflowLine2Candidates below), never surfaced directly;
 * validateMrz() is the real, full checksum check applied once a line has actually been chosen. */
function scoreLine2Checksums(line2: string): number {
  if (line2.length !== 44) return -1;
  const passportNum = line2.slice(0, 9);
  const pnCheck = line2[9];
  const birth = line2.slice(13, 19);
  const birthCheck = line2[19];
  const expiry = line2.slice(21, 27);
  const expiryCheck = line2[27];
  let score = 0;
  if (/^\d$/.test(pnCheck) && mrzCheckDigit(passportNum) === +pnCheck) score++;
  if (/^\d$/.test(birthCheck) && mrzDateDigitsPlausible(birth) && mrzCheckDigit(birth) === +birthCheck) score++;
  if (/^\d$/.test(expiryCheck) && mrzDateDigitsPlausible(expiry) && mrzCheckDigit(expiry) === +expiryCheck) score++;
  return score;
}
/** Returns candidate 44-char normalizations of `raw` with 1 or 2 stray junk characters removed
 * (rather than converted to "<" and trimmed off the end, which is what normalizeMrzLine alone does),
 * each paired with how many checksums it satisfies — sorted best-first. Capped at removing 2 of the
 * (at most 4, to bound the search) junk positions found, since a real OCR misread inserting 3+ stray
 * characters into one line is vanishingly unlikely and not worth the combinatorial cost of trying.
 */
function reflowLine2Candidates(raw: string): { line: string; score: number }[] {
  const junk = findJunkCharPositions(raw).slice(0, 4);
  if (!junk.length) return [];
  const tried = new Set<string>();
  const out: { line: string; score: number }[] = [];
  function tryRemoval(positions: number[]) {
    const candidate = removeCharsAt(raw, positions);
    if (tried.has(candidate)) return;
    tried.add(candidate);
    const normalized = normalizeMrzLine(candidate, 44);
    if (!normalized) return;
    out.push({ line: normalized, score: scoreLine2Checksums(normalized) });
  }
  for (const p of junk) tryRemoval([p]);
  for (let i = 0; i < junk.length; i++) {
    for (let j = i + 1; j < junk.length; j++) tryRemoval([junk[i], junk[j]]);
  }
  return out.sort((a, b) => b.score - a.score);
}

// Finds the two-line MRZ block, returning both the normalized lines AND which original text-line
// indices they came from (so other callers — see stripMrzLines below — can exclude exactly those lines
// without re-implementing the same detection logic). Line 1 (names) is located by its distinctive "P" +
// country-code prefix rather than requiring an exact 44-character match — that trailing padding OCR
// noise was silently rejecting otherwise-clean reads (a real passport, correctly read almost everywhere
// else, would show "Couldn't read enough of this page automatically"). Line 2 (checksum line) is then
// taken as whichever MRZ-shaped line immediately follows it. The "P<XXX" prefix is specific enough that
// it won't false-match unrelated prose, and only the line directly below it is even considered.
export function findMrzLinesWithIndex(text: string): MrzLinesWithIndex | null {
  const rawLines = text.split('\n').map((l) => l.replace(/\s+/g, '').toUpperCase());
  // Tries EVERY candidate line on the page, not just the first/last one that happens to match —
  // real OCR text can contain more than one line starting with something that looks like "P<XXX"
  // (an unrelated garbled line from elsewhere on the page can coincidentally match too), and can
  // also drop a stray leading character right before the real MRZ's "P" (a misread border rule, a
  // stray "|", etc. — the ".{0,2}?" below tolerates up to 2 such junk characters). Both failure
  // modes were seen on real client passport photos: one where an unrelated "Holder's Signature"
  // OCR line spuriously matched the strict pattern, and one where a leading "|" made an otherwise
  // perfectly-read MRZ line fail a strict ^P anchor. normalizeMrzLine's length check is what
  // actually tells a real MRZ line apart from a coincidental one — a real line is always close to
  // 44 characters; the "Holder's Signature" garbage line above was only 30, well outside the
  // tolerance, so it's naturally skipped in favor of trying the next candidate instead of being
  // trusted just because it matched first.
  // The lookahead requires a genuine run of 15+ clean MRZ-alphabet characters RIGHT AFTER the "P"
  // + country-code prefix — that's where the actual name data lives, which reads reliably even on a
  // rough OCR pass — but everything from there to the end of line is then captured as-is (any
  // character), not restricted to the MRZ alphabet. First attempt at this fix captured the tail with
  // a plain [A-Z0-9<]-restricted run all the way to end of line, same as before, which was too
  // strict: it rejected an otherwise-good read outright the moment a single stray OCR character
  // showed up in the padding tail, before normalizeMrzLine (see above) ever got the chance to apply
  // its own, more forgiving bad-character cleanup. But dropping that restriction entirely (tried
  // second) went too far the other way and broke two existing passport fixtures: an ordinary printed
  // "Passport No./No du passeport A87654321" label line now satisfied the prefix pattern too and got
  // treated as a candidate MRZ line ahead of the real one, reintroducing the exact "unrelated line
  // spuriously matches" false-positive this function's length check was already built to guard
  // against. The lookahead is what a plain label line fails that a real (even corrupted) MRZ line
  // passes: a label line hits a "/" or "." within the first few characters, well short of 15 clean
  // ones in a row.
  const re = /^.{0,2}?(P[A-Z<][A-Z]{3}(?=[A-Z0-9<]{15,}).{20,})$/;
  for (let i = 0; i < rawLines.length; i++) {
    const m = re.exec(rawLines[i]);
    if (!m) continue;
    const line1 = normalizeMrzLine(m[1], 44);
    if (!line1) continue;
    for (let j = i + 1; j < Math.min(i + 4, rawLines.length); j++) {
      if (rawLines[j].length < 30) continue; // skip a stray short/blank OCR line between the two
      const naive = normalizeMrzLine(rawLines[j], 44);
      if (!naive) continue;
      // Only reach for the stray-junk-character reflow when the naive reading actually contains junk
      // AND the line was over-length (both signs something got inserted, not just badly OCR'd in
      // place) — a normal clean read never triggers this extra work. See reflowLine2Candidates above.
      const hadJunk = /[^A-Z0-9<]/.test(rawLines[j].slice(0, 44));
      if (hadJunk && rawLines[j].length > 44) {
        const naiveScore = scoreLine2Checksums(naive);
        const reflowed = reflowLine2Candidates(rawLines[j]);
        if (reflowed.length && reflowed[0].score > naiveScore) {
          return { lines: [line1, reflowed[0].line], indices: [i, j] };
        }
      }
      return { lines: [line1, naive], indices: [i, j] };
    }
  }
  return null;
}
export function findMrzLines(text: string): [string, string] | null {
  const found = findMrzLinesWithIndex(text);
  return found ? found.lines : null;
}

// Real-world case: a passport photo where line 1 (the name line — small, dense text, and often sitting
// right over a background security pattern) OCR'd as pure garbage ("eA CHE SLATE RTOS SRERESE"), while
// line 2 (mostly digits, generally easier for OCR to read cleanly) came back a perfect, checksum-valid
// 44-character MRZ line. Because the old detection required finding a valid line 1 FIRST and only then
// looked at whatever followed it, a bad read of line 1 alone threw away a perfectly good line 2 — and
// with it, the entire checksum check ("MRZ checksum: not detected") even though nothing was actually
// wrong with the document or, really, with line 2's own read.
//
// The checksum check (unlike the applicant's name) only ever needs line 2, so this searches for a
// standalone, structurally line-2-shaped line anywhere on the page and — critically — requires its OWN
// check digits to actually corroborate that shape before trusting it, exactly the same math validateMrz
// uses below. That second gate is what keeps this from false-triggering on some unrelated numeric-heavy
// OCR line that happens to be 44 characters of digits and letters in roughly the right places.
export const MRZ_LINE2_SHAPE_RE =
  /^[A-Z0-9<]{9}\d[A-Z<]{3}\d{6}\d[MFX<]\d{6}\d[A-Z0-9<]{14}[\d<]\d$/;
export function findMrzLine2Standalone(text: string): string | null {
  const rawLines = text.split('\n').map((l) => l.replace(/\s+/g, '').toUpperCase());
  for (let i = 0; i < rawLines.length; i++) {
    if (rawLines[i].length < 34) continue; // cheap skip before the heavier normalize/regex work below
    let norm = normalizeMrzLine(rawLines[i], 44);
    if (!norm) continue;
    // Same letter-for-digit OCR fix validateMrz() applies below (see fixMrzDateLetters above) —
    // done before the shape regex test, since a stray letter in either date field would otherwise
    // fail that strict \d{6} shape check outright and this candidate line would never even be tried.
    norm =
      norm.slice(0, 13) +
      fixMrzDateLetters(norm.slice(13, 19)) +
      norm.slice(19, 21) +
      fixMrzDateLetters(norm.slice(21, 27)) +
      norm.slice(27);
    if (!MRZ_LINE2_SHAPE_RE.test(norm)) continue;
    const passportNum = norm.slice(0, 9);
    const pnCheck = norm[9];
    const birth = norm.slice(13, 19);
    const birthCheck = norm[19];
    const expiry = norm.slice(21, 27);
    const expiryCheck = norm[27];
    let okCount = 0;
    let checkable = 0;
    if (/^\d$/.test(pnCheck)) {
      checkable++;
      if (mrzCheckDigit(passportNum) === +pnCheck) okCount++;
    }
    if (/^\d$/.test(birthCheck)) {
      checkable++;
      if (mrzCheckDigit(birth) === +birthCheck) okCount++;
    }
    if (/^\d$/.test(expiryCheck)) {
      checkable++;
      if (mrzCheckDigit(expiry) === +expiryCheck) okCount++;
    }
    if (checkable >= 2 && okCount >= 2) return norm;
  }
  return null;
}

export function validateMrz(text: string): MrzValidationResult | null {
  const found = findMrzLines(text);
  let line2: string | null;
  if (found) {
    line2 = found[1];
    if (line2.length !== 44 || !/^P/.test(found[0])) return null;
  } else {
    line2 = findMrzLine2Standalone(text);
    if (!line2) return null;
  }

  const passportNum = line2.slice(0, 9);
  const pnCheck = line2[9];
  // fixMrzDateLetters here, not on passportNum below — the date fields are digits-only by spec, so a
  // letter there can only be OCR noise (see the comment above the function); the passport number
  // field legitimately mixes letters and digits, so it's left exactly as read. Tracked against the
  // raw (pre-fix) slice so a genuine letter-for-digit fix is disclosed as an "Auto-corrected" row
  // below, same as the digit-swap correction already is — never silently shown as if the MRZ had
  // simply read cleanly in the first place.
  const birthRawSlice = line2.slice(13, 19);
  const birthCheck = line2[19];
  const expiryRawSlice = line2.slice(21, 27);
  const expiryCheck = line2[27];
  let birth = fixMrzDateLetters(birthRawSlice);
  const birthLetterFixed = birth !== birthRawSlice;
  let expiry = fixMrzDateLetters(expiryRawSlice);
  const expiryLetterFixed = expiry !== expiryRawSlice;
  const personalNum = line2.slice(28, 42);
  const personalCheck = line2[42];
  const compositeCheck = line2[43];

  // Attempt a checksum-verified single-digit OCR correction on the two purely-numeric date fields
  // before computing the checks below — see findMrzFieldCorrectionCandidates above. Not attempted on
  // the passport number, since that field can legitimately contain letters as well as digits and this
  // confusable-swap approach is scoped to digit-only fields. When a field's own check digit leaves
  // more than one plausible candidate (e.g. either year digit could each independently restore a
  // passing checksum), the composite check digit — which is itself computed from this same field —
  // is used as a second, independent witness to narrow it down to one before trusting it.
  function compositeCheckPasses(b: string, e: string): boolean {
    return (
      /^\d$/.test(compositeCheck) &&
      mrzCheckDigit(passportNum + pnCheck + b + birthCheck + e + expiryCheck + personalNum + personalCheck) ===
        +compositeCheck
    );
  }
  const birthCandidates = findMrzFieldCorrectionCandidates(birth, birthCheck, mrzDateDigitsPlausible);
  const birthCorrected =
    birthCandidates.length === 1
      ? birthCandidates[0]
      : birthCandidates.length > 1
        ? (() => {
            const f = birthCandidates.filter((b) => compositeCheckPasses(b, expiry));
            return f.length === 1 ? f[0] : null;
          })()
        : null;
  if (birthCorrected) birth = birthCorrected;
  const expiryCandidates = findMrzFieldCorrectionCandidates(expiry, expiryCheck, mrzDateDigitsPlausible);
  const expiryCorrected =
    expiryCandidates.length === 1
      ? expiryCandidates[0]
      : expiryCandidates.length > 1
        ? (() => {
            const f = expiryCandidates.filter((e) => compositeCheckPasses(birth, e));
            return f.length === 1 ? f[0] : null;
          })()
        : null;
  if (expiryCorrected) expiry = expiryCorrected;

  const compositeInput = passportNum + pnCheck + birth + birthCheck + expiry + expiryCheck + personalNum + personalCheck;

  const checks: MrzChecks = {
    passportNumber: /^\d$/.test(pnCheck) ? mrzCheckDigit(passportNum) === +pnCheck : null,
    birthDate: /^\d$/.test(birthCheck) ? mrzCheckDigit(birth) === +birthCheck : null,
    expiryDate: /^\d$/.test(expiryCheck) ? mrzCheckDigit(expiry) === +expiryCheck : null,
    composite: /^\d$/.test(compositeCheck) ? mrzCheckDigit(compositeInput) === +compositeCheck : null,
  };
  const relevant = (Object.keys(checks) as (keyof MrzChecks)[]).filter((k) => checks[k] !== null);
  const passed = relevant.filter((k) => checks[k]);
  return {
    checks,
    passedCount: passed.length,
    totalCount: relevant.length,
    birth,
    expiry,
    corrections: { birthDate: !!birthCorrected || birthLetterFixed, expiryDate: !!expiryCorrected || expiryLetterFixed },
  };
}

// Full structured read of the TD3 (passport) MRZ — document type, issuing country, name, passport number,
// nationality, DOB, expiry — on top of the checksum validation above. Still a best-effort text/format read,
// not a genuineness check: no public API exists to verify passport authenticity, and this module never claims
// to. Field positions per ICAO Doc 9303 TD3.
export function mrzDateToDate(raw: string, isExpiry: boolean): Date | null {
  if (!/^\d{6}$/.test(raw || '')) return null;
  const yy = parseInt(raw.slice(0, 2), 10);
  const mm = parseInt(raw.slice(2, 4), 10) - 1;
  const dd = parseInt(raw.slice(4, 6), 10);
  const century = isExpiry ? 2000 : yy > new Date().getFullYear() % 100 ? 1900 : 2000;
  const d = new Date(century + yy, mm, dd);
  return isNaN(d.getTime()) ? null : d;
}

// ICAO Doc 9303's MRZ alphabet technically includes digits 0-9, but the NAME portion of line 1 is
// letters-and-"<" filler only — a real passport holder's name is never spelled with digits. Reported
// real-world case: a name's "O" OCR'd as digit "0". Any digit found here is therefore always an OCR
// misread of a similar-looking letter, never a genuine value — safe to "correct" on sight.
// Deliberately NOT applied anywhere else (passport number, dates, etc. are real digits and must be
// left alone).
export const MRZ_NAME_DIGIT_FIX: Record<string, string> = { '0': 'O', '1': 'I', '2': 'Z', '5': 'S', '6': 'G', '8': 'B' };
export function fixMrzNameDigits(str: string): string {
  return str.replace(/[0-9]/g, (d) => MRZ_NAME_DIGIT_FIX[d] || d);
}

// Same reasoning as MRZ_NAME_DIGIT_FIX above, applied to the two 3-letter country-code fields
// (issuing country on line 1, nationality on line 2) — both are letters-and-"<" filler only per
// ICAO 9303, so any digit found there is always an OCR misread of a similar-looking letter, never a
// genuine value. Real-data finding, off a real Nigerian passport: "NGA" OCR'd as "NG4" — a misread
// this map alone doesn't already cover (name fields don't commonly need a 4->A fix; a country code
// does, since "NGA"'s own "A" is exactly the letter this misread hits). Kept as its own map rather
// than folded into MRZ_NAME_DIGIT_FIX so that map's existing, already-verified behavior for names
// stays untouched.
export const MRZ_COUNTRY_DIGIT_FIX: Record<string, string> = { ...MRZ_NAME_DIGIT_FIX, '4': 'A' };
export function fixMrzCountryDigits(str: string): string {
  return str.replace(/[0-9]/g, (d) => MRZ_COUNTRY_DIGIT_FIX[d] || d);
}

export function parseMrzFields(text: string): ParsedPassportFields | null {
  const lines = findMrzLines(text);
  if (!lines) return null;
  const line1 = lines[0];
  const line2 = lines[1];
  if (line1.length < 44 || line2.length !== 44 || !/^P/.test(line1)) return null;

  const namePart = fixMrzNameDigits(line1.slice(5));
  const segments = namePart.split('<<');
  const surname = (segments[0] || '').replace(/</g, ' ').trim();
  let given = (segments[1] || '').replace(/</g, ' ').trim();
  // Same low-end-phone issue as normalizeMrzLine above: stray characters surviving in what should
  // have been pure "<" padding land in the given-name field as meaningless noise tokens, since a
  // row of visually-identical "<" chevrons tends to get OCR'd as visually-identical letters too.
  // Originally this only stripped a single bare trailing letter (e.g. "ADAEZE CHIOMA K" ->
  // "ADAEZE CHIOMA"), but a real passport scan produced TWO such tokens mid-string — one bare
  // letter and one long run of a repeated letter: "FAITH FOLASADE K KLLLLLLLLLL BELLO" instead
  // of "FAITH FOLASADE". Generalized to catch both patterns anywhere in the field, not just a
  // single one at the very end: a genuine given-name word is never just one bare letter, and never
  // 3+ of the same letter repeated in a row (optionally after one different leading character, from
  // the odd chevron that partially resembles a different letter) — real names don't look like that,
  // but misread filler reliably does. The applicant can still edit the auto-filled name afterward
  // either way (see pv_name's two-way sync with f_name above), same as any other auto-fill here.
  given = given
    .split(/\s+/)
    .filter((word) => {
      if (!word) return false;
      if (word.length === 1) return false; // a lone letter is never a genuine given-name word
      return !/^[A-Z]?([A-Z])\1{2,}$/.test(word); // optional odd leading char + 3+ repeats of one letter
    })
    .join(' ');

  // validateMrz() applies the same checksum-verified digit correction described above to the birth/
  // expiry date fields — reuse its (possibly corrected) values here rather than the raw, uncorrected
  // slice, so a misread digit fixed there is reflected in the actual date shown to the applicant too.
  const mrz = validateMrz(text);
  const birthRaw = mrz && mrz.birth ? mrz.birth : line2.slice(13, 19);
  const expiryRaw = mrz && mrz.expiry ? mrz.expiry : line2.slice(21, 27);
  let birthDate = mrzDateToDate(birthRaw, false);
  let birthDateSource: 'mrz' | 'printed' = 'mrz';

  // The MRZ check digit alone can't always tell which digit was misread (see findMrzFieldCorrectionCandidates
  // above — some confusable pairs, like "3"/"8", are mathematically indistinguishable once a field has
  // more than one of them). When the birth-date check digit still doesn't match after that attempt, fall
  // back to the plain printed "Date of birth" text most bio pages also carry — a second, independent OCR
  // read of a different part of the page. Real case this fixes: DOB misread as "3/9/1938" instead of the
  // true "3/9/1988".
  if (mrz && mrz.checks && mrz.checks.birthDate === false) {
    const printedBirth = extractPrintedBirthDate(text);
    if (printedBirth) {
      birthDate = printedBirth;
      birthDateSource = 'printed';
    }
  }

  let expiryDate = mrzDateToDate(expiryRaw, true);
  let expiryDateSource: 'mrz' | 'printed' = 'mrz';
  // Falls back whenever the MRZ read came back unusable at all (expiryRaw wasn't even 6 clean
  // digits — mrzDateToDate returns null), not just on a checksum mismatch — a non-digit OCR
  // misread breaks parsing outright, it doesn't leave a wrong-but-parseable date the checksum
  // could catch. Still also covers the checksum-mismatch case (a wrong-but-parseable date), same
  // trigger as the birth-date fallback above, for the same reason.
  if (!expiryDate || (mrz && mrz.checks && mrz.checks.expiryDate === false)) {
    const printedExpiry = extractPrintedExpiryDate(text);
    if (printedExpiry) {
      expiryDate = printedExpiry;
      expiryDateSource = 'printed';
    }
  }

  return {
    docType: line1[0],
    issuingCountry: fixMrzCountryDigits(line1.slice(2, 5)).replace(/</g, ''),
    surname,
    given,
    fullName: (given ? given + ' ' : '') + surname,
    passportNumber: line2.slice(0, 9).replace(/</g, ''),
    nationality: fixMrzCountryDigits(line2.slice(10, 13)).replace(/</g, ''),
    birthDate,
    birthDateSource,
    sex: line2[20],
    expiryDate,
    expiryDateSource,
    mrz,
  };
}

// ---- Extra free, on-device passport checks (no third-party verification API) ----
// Turns a partial MRZ checksum failure from a vague "2/4 matched" into a pointer at exactly which
// field's check digit didn't match, so the applicant knows whether to just re-scan more clearly
// (a single field, likely a misread) or look more carefully (several fields).
export function mrzCheckSummary(mrz: MrzValidationResult | null): string | null {
  if (!mrz) return null;
  if (!mrz.totalCount) return 'unreadable';
  if (mrz.passedCount === mrz.totalCount) return mrz.passedCount + '/' + mrz.totalCount + ' digit(s) matched';
  const fieldLabels: Record<string, string> = {
    passportNumber: 'document number',
    birthDate: 'date of birth',
    expiryDate: 'expiry date',
    composite: 'composite',
  };
  const failed = (Object.keys(mrz.checks) as (keyof MrzChecks)[])
    .filter((k) => mrz.checks[k] === false)
    .map((k) => fieldLabels[k] || k);
  return (
    mrz.passedCount +
    '/' +
    mrz.totalCount +
    ' matched - ' +
    (failed.length ? failed.join(', ') + " check digit" + (failed.length > 1 ? 's' : '') + " didn't match" : 'see rows above')
  );
}

// Strips the two MRZ lines themselves out of the OCR'd text, leaving just the visual (printed) zone —
// so a "does this also appear elsewhere on the page" cross-check is genuine, not a trivial self-match
// against the MRZ line it was read from in the first place.
export function stripMrzLines(text: string): string {
  const found = findMrzLinesWithIndex(text);
  if (!found) return text;
  // Excludes exactly the two original lines findMrzLinesWithIndex identified (by index) — reusing that
  // same detection instead of re-matching independently, so a noisy OCR read of the padding tail is
  // recognized (and excluded) consistently here too. Otherwise the "Printed vs. MRZ" cross-check could
  // end up comparing the MRZ against itself.
  return text
    .split('\n')
    .filter((_l, idx) => found.indices.indexOf(idx) === -1)
    .join('\n');
}

// Loose "does this value also appear elsewhere on the page" match — allows an optional space/hyphen
// between every character, since printed passport numbers are sometimes spaced out (e.g. "A 123 4567").
export function looseContains(haystack: string, needle: string): boolean {
  if (!needle) return false;
  const pattern = needle
    .split('')
    .map((c) => c.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
    .join('[\\s-]?');
  return new RegExp(pattern).test(haystack);
}
