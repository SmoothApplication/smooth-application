// Column/text-extraction helpers, ported from index.html (~lines 10746-10981).
// PDF.js/Tesseract/XLSX-dependent functions (pdfPageToCanvas, getLinesFromPdf, linesFromWorkbook,
// getLinesFromFile) are intentionally NOT ported here — they call browser-only APIs and live in
// lib/statement/extractFile.ts instead. linesFromPlainText and isSpreadsheetFile are pure enough to
// keep here; linesFromPlainText sat unused until the "Scanned/photographed statement support"
// follow-up wired an OCR path into extractFile.ts that produces this exact shape.

import type { Line, ColumnOccurrence, ColumnPositions } from './types';

/** pdf.js gives us a flat list of positioned text runs (`tc.items`); this buckets them into
 * physical lines by shared y-position (within 2pt), then sorts each bucket's parts left-to-right
 * by x. Buckets are sorted top-to-bottom (descending y, since PDF y grows upward). */
export function linesFromTextContent(tc: {
  items: { str: string; transform: number[]; width?: number }[];
}): Line[] {
  const buckets: { y: number; parts: { x: number; str: string; w?: number }[] }[] = [];
  tc.items.forEach((it) => {
    if (!it.str || !it.str.trim()) return;
    const y = it.transform[5];
    const x = it.transform[4];
    let b = null;
    for (let i = 0; i < buckets.length; i++) {
      if (Math.abs(buckets[i].y - y) <= 2) {
        b = buckets[i];
        break;
      }
    }
    if (!b) {
      b = { y, parts: [] };
      buckets.push(b);
    }
    // `width` (pdf.js's own TextItem.width) is kept alongside `x`/`str` — see LinePart's own
    // comment in types.ts for why: it's what lets lineTextPreservingColumnGaps below tell a real
    // column boundary apart from ordinary same-cell word spacing, something the collapsed `.text`
    // field this function also produces can no longer do once `.replace(/\s+/g, ' ')` has run.
    b.parts.push({ x, str: it.str, w: it.width });
  });
  buckets.sort((a, b) => b.y - a.y);
  return buckets
    .map((b) => {
      const parts = b.parts.sort((p, q) => p.x - q.x);
      return {
        text: parts
          .map((p) => p.str)
          .join(' ')
          .replace(/\s+/g, ' ')
          .trim(),
        parts,
      };
    })
    .filter((l) => l.text);
}

// Plain-text source (OCR) — no reliable x-positions, so wrap as a line with empty parts;
// downstream logic falls back to the order/keyword/balance-delta heuristic for these.
export function linesFromPlainText(text: string): Line[] {
  return (text || '')
    .split('\n')
    .map((t) => ({ text: t, parts: [] }))
    .filter((l) => l.text.trim());
}

// Real-data finding (task "name was not extracted... did not follow the manual pattern" — a real
// Providus statement whose header literally reads "CUST. NAME   POPOOLA ADEPEJU ADETUTU" with wide
// column-aligned spacing): Line.text above collapses EVERY whitespace run down to exactly one
// space, including the wide x-gap pdf.js represents purely through item POSITION rather than
// literal space characters — by the time `extractAccountHolderName` (names.ts) ever sees the
// joined statement text, no 2+-space run survives anywhere, so its tabular "CUST. NAME<2+
// spaces>NAME<2+ spaces>" pattern (added for this exact statement shape, see
// ACCOUNT_NAME_TABULAR_LABEL_RE's own comment) can never match — even though a passing unit test
// for that regex gave false confidence, because it fed the regex a hand-built string with the
// spacing already preserved, never exercising this join step at all.
//
// This reconstructs a line's text from its still-intact `parts` (x-positioned, exactly like
// linesFromTextContent builds them) instead of reusing the already-collapsed `.text`, inserting a
// literal double space wherever the gap between two consecutive parts is wide enough to be a real
// column boundary rather than ordinary same-cell word spacing. Calibrated against this statement's
// own real x-positions: same-cell/same-phrase gaps (e.g. two date parts, or words within one bank
// name) measured 8-14pt; genuine label-to-value column gaps measured 30pt or more (several ran into
// the hundreds for widely separated amount/balance columns) — so 20pt sits safely in the gap
// between those two real clusters without needing per-line font-size data this shape doesn't carry.
// Only used for the specific "find the account holder's name" pass below — NOT swapped in for the
// shared `.text` field everywhere else (narration building, column-header detection, amount
// parsing all keep reading `.text` exactly as before), so this carries no risk to any of that
// already-locked-down behaviour.
//
// Measured against this real gap, not raw x-to-x distance (which conflates a long label's own
// width with actual blank space): same-cell/same-phrase blank gaps (two date parts, words within
// one bank name) measured 8-14pt end-to-end; genuine label-to-value column gaps measured 30pt or
// more. 20 sits safely between those two real clusters.
export const COLUMN_GAP_THRESHOLD = 20;

export function lineTextPreservingColumnGaps(line: Line): string {
  if (!line.parts || line.parts.length === 0) return line.text;
  const sorted = [...line.parts].sort((a, b) => a.x - b.x);
  let out = '';
  for (let i = 0; i < sorted.length; i++) {
    if (i > 0) {
      const prev = sorted[i - 1];
      // Only ever WIDEN a gap to a column-boundary double-space when both items carry a real
      // width to measure the actual blank space from — without one, this falls back to an
      // ordinary single space (the same as before this function existed) rather than guessing
      // from raw x-distance, which a long label's own width could trip on its own.
      const hasWidths = typeof prev.w === 'number' && typeof sorted[i].x === 'number';
      const blankGap = hasWidths ? sorted[i].x - (prev.x + (prev.w as number)) : null;
      out += blankGap !== null && blankGap >= COLUMN_GAP_THRESHOLD ? '  ' : ' ';
    }
    out += sorted[i].str;
  }
  return out.replace(/[ \t]{3,}/g, '  ').trim();
}

export const AMOUNT_RE = /^-?\d{1,3}(?:,\d{3})+(?:\.\d{1,2})?$|^-?\d+\.\d{2}$/;

// Real Nigerian bank statements label these columns in all sorts of ways — "Debit(₦)", "Amount Debited",
// "Withdrawal (N)", "Lodgement", "DR" — so matching has to survive currency symbols/codes glued onto the
// word and still be exact for bare 2-3 letter abbreviations (so "dr"/"cr"/"bal" don't false-match inside
// an unrelated word like "address").
//
// Real-data finding, from the "proper and easy to read financial analyses & report" quality audit: a
// real Fidelity Bank statement labels its columns "Pay In"/"Pay Out" — neither matched any keyword
// here, so detectColumnsAll never found a header, and every row fell back to the weaker order-based
// heuristic. That heuristic still gets the numbers right, but its narration is the ENTIRE raw line
// (date, duplicated amount figures, wrapped continuation text and all) rather than the cleaned text
// buildCleanNarration produces once real columns are known — exactly the "clumsy" narration text this
// audit was checking for. Added alongside "money in"/"money out", which this already covered.
export const COL_LABELS: Record<'debit' | 'credit' | 'balance', string[]> = {
  debit: ['debit', 'withdrawal', 'withdrawals', 'amount debited', 'money out', 'pay out', 'dr'],
  credit: ['credit', 'deposit', 'deposits', 'lodgement', 'lodgements', 'amount credited', 'money in', 'pay in', 'cr'],
  balance: ['balance', 'closing balance', 'running balance', 'ledger balance', 'bal'],
};

export function normalizeColLabel(str: string): string {
  return str
    .replace(/[₦$£€]/g, '') // currency symbols (₦ £ $ €)
    .replace(/\(.*?\)/g, '') // parenthetical currency codes, e.g. "(N)" "(₦)"
    .replace(/[^a-zA-Z ]/g, '') // anything else that isn't a letter or space
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

export function colLabelMatches(norm: string, keyword: string): boolean {
  // Short abbreviations (dr/cr/bal) only match on an exact cell — matching as a substring risks false
  // hits inside unrelated words. Longer, more specific words/phrases are safe to match as a substring,
  // since a header cell like "Amount Debited(N)" normalizes to "amount debited" which contains "debit".
  if (keyword.length <= 3) return norm === keyword;
  return norm === keyword || norm.indexOf(keyword) !== -1;
}

// Scan for a header row naming Debit/Credit/Balance columns, and record each column's x-position so
// later rows — including ones with only one populated amount cell — can be matched by column, not guessed.
//
// Real-data finding, off a real First Bank statement: its account-summary info box prints its own
// labels — "Pending Debit:", "Available Balance:", "Total Credit:", "Total Debit:" — as a vertically
// stacked label column, all left-aligned at the exact same x-position (one per row). Each one
// INDEPENDENTLY matches one of the debit/credit/balance keyword lists below, and since they share the
// summary box's label x-position, matching them column-by-column ACROSS separate lines (the previous
// approach) silently wired up debit/credit/balance to that x-position instead of the real transaction
// table's header — corrupting the debit/credit/balance assignment for every single transaction.
//
// A genuine table header names all three columns TOGETHER, on the SAME physical row — an info box's
// labels never do, each sits on its own row. Requiring co-occurrence on one line is what actually
// distinguishes a header from this false positive, so only a single line's own parts are considered
// per candidate; the first line whose own parts satisfy all three columns wins.
// Real-data finding, off a real Opay wallet statement: a 168-page export whose column x-positions
// actually SHIFT partway through the document — the transaction table header appears more than once,
// at two visibly different sets of x-positions. detectColumnsAll returns every occurrence, so callers
// can pick whichever one actually applies to a given row's position in the document.
export function scanColLabelsOnLine(line: Line, into: ColumnPositions): void {
  line.parts.forEach((p) => {
    const norm = normalizeColLabel(p.str);
    if (!norm) return;
    (Object.keys(COL_LABELS) as (keyof typeof COL_LABELS)[]).forEach((col) => {
      if (into[col] !== undefined) return;
      if (COL_LABELS[col].some((k) => colLabelMatches(norm, k))) into[col] = p.x;
    });
  });
}

export function detectColumnsAll(lines: Line[]): ColumnOccurrence[] {
  const found: ColumnOccurrence[] = [];
  for (let i = 0; i < lines.length; i++) {
    const cols: ColumnPositions = {};
    scanColLabelsOnLine(lines[i], cols);
    if (cols.debit !== undefined && cols.credit !== undefined && cols.balance !== undefined) {
      found.push({ index: i, cols });
      continue;
    }
    // Real-data finding, off a real Opay wallet statement: its "Balance After" column header wraps
    // onto its own line, one line above "... Debit (₦) Credit (₦) ..." and one line below a lone
    // "(₦)" — so the strict single-line check above never matches it. This looks for the same three
    // labels spread across a tight 2-line window instead of requiring them all on one line.
    //
    // The single-line requirement above exists specifically to reject the real First Bank false
    // positive this function is named for. Widening the window to 2 lines risks matching that same
    // info box if its four labels happen to land within 2 lines of each other, so this ALSO requires
    // the three matched x-positions to be meaningfully spread apart (not one shared label column) and
    // in the standard left-to-right table order (debit, then credit, then balance) — an info box's
    // single-column labels can satisfy neither.
    if (i + 1 < lines.length) {
      const windowCols: ColumnPositions = {};
      scanColLabelsOnLine(lines[i], windowCols);
      scanColLabelsOnLine(lines[i + 1], windowCols);
      if (windowCols.debit !== undefined && windowCols.credit !== undefined && windowCols.balance !== undefined) {
        const xs = [windowCols.debit, windowCols.credit, windowCols.balance];
        const spread = Math.max.apply(null, xs) - Math.min.apply(null, xs);
        const properOrder = windowCols.debit < windowCols.credit && windowCols.credit < windowCols.balance;
        if (spread > 25 && properOrder) {
          found.push({ index: i, cols: windowCols });
        }
      }
    }
  }
  return found;
}

export function detectColumns(lines: Line[]): ColumnPositions | null {
  const all = detectColumnsAll(lines);
  return all.length ? all[0].cols : null;
}

export function isSpreadsheetFile(file: { type: string; name?: string }): boolean {
  if (/spreadsheetml|ms-excel/.test(file.type)) return true;
  return /\.(xlsx|xls)$/i.test(file.name || '');
}
