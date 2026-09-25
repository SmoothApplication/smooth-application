// Core row parser, ported from index.html (~lines 11007-11649).

import { AMOUNT_RE, detectColumnsAll } from './columns';
import type { Line, ParsedTxn, MonthAggregate, StableIncome } from './types';
import { isReversalNarration, isNonIncomeChargeNarration, markAmountMatchedReversals } from './classify';

export function parseLeadingDate(line: string): { date: Date; rest: string } | null {
  let m = line.match(/^\D{0,6}(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})\b/);
  if (m) {
    const dd = +m[1];
    const mm = +m[2] - 1;
    let yy = +m[3];
    if (yy < 100) yy += 2000;
    const d = new Date(yy, mm, dd);
    if (!isNaN(d.getTime()) && d.getFullYear() > 2000 && d.getFullYear() < 2100) {
      return { date: d, rest: line.slice(m[0].length) };
    }
  }
  m = line.match(/^\D{0,6}(\d{1,2})[\s\-\/](jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*[\s\-,\/]?\s*(\d{4})\b/i);
  if (m) {
    const months: Record<string, number> = {
      jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5, jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11,
    };
    const d2 = new Date(+m[3], months[m[2].toLowerCase().slice(0, 3)], +m[1]);
    if (!isNaN(d2.getTime())) return { date: d2, rest: line.slice(m[0].length) };
  }
  m = line.match(/^\D{0,6}(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})\b/);
  if (m) {
    const d3 = new Date(+m[1], +m[2] - 1, +m[3]);
    if (!isNaN(d3.getTime())) return { date: d3, rest: line.slice(m[0].length) };
  }
  return null;
}

export function extractAmountTokens(str: string): number[] {
  const out: number[] = [];
  const re = /-?\d{1,3}(?:,\d{3})+(?:\.\d{1,2})?|-?\d+\.\d{2}/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(str)) !== null) {
    const v = parseFloat(m[0].replace(/,/g, ''));
    if (!isNaN(v)) out.push(v);
  }
  return out;
}

// Amount-bearing parts on a line. Most cells are a part whose ENTIRE trimmed text is a currency-shaped
// number, but some PDF exports glue a column's value straight onto the next column's text with no real
// gap — e.g. a Credit cell rendered as one text run with the Value Date right after it, "550,000.00
// 10/02/2026" — so also recover a LEADING amount-shaped prefix from an otherwise-non-matching part.
export const LEADING_AMOUNT_RE = /^-?\d{1,3}(?:,\d{3})+(?:\.\d{1,2})?|^-?\d+\.\d{2}/;

export function amountPartsOfLine(line: Line): { x: number; value: number }[] {
  const out: { x: number; value: number }[] = [];
  line.parts.forEach((p) => {
    const str = p.str.trim();
    if (AMOUNT_RE.test(str)) {
      out.push({ x: p.x, value: parseFloat(str.replace(/,/g, '')) });
      return;
    }
    const m = str.match(LEADING_AMOUNT_RE);
    if (m) out.push({ x: p.x, value: parseFloat(m[0].replace(/,/g, '')) });
  });
  return out;
}

// Real-data finding, off a full 31-page statement: many bank statement DESCRIPTION cells wrap across
// MORE THAN ONE physical PDF text line — the transaction's date and amount figures sit on the first
// line, but the tail end of its narration spills onto the next line(s), which carry no date and no
// amount figures of their own. Those trailing lines used to be silently dropped: parseLeadingDate
// rejects them (no leading date), so the main parser loop just skipped past them and that text was
// lost for good — which is exactly why narration-dependent checks (salary-reason detection, the
// narration-consistency percentage) came up empty on otherwise-genuine salary payments whose "Salary"
// word only existed on the wrapped second line.
//
// This stitches a trailing line back onto the PRECEDING transaction's narration instead, but only when
// it looks unambiguously like leftover narration text, never a real row or unrelated page furniture:
// no leading date of its own, no amount-shaped numbers of its own, on the SAME PDF page (never wraps
// across a page break, where headers/footers repeat and would otherwise get glued onto the wrong
// transaction), short enough to plausibly be one wrapped cell, and not a recognisable page-furniture
// phrase (page numbers, "continued", etc). Caps how many trailing lines it will absorb per transaction.
// Deliberately conservative — a candidate line that fails any of these checks is left alone rather than
// guessed at, consistent with how the rest of this parser backs off instead of over-claiming.
export const NARRATION_WRAP_MAX_LINES = 3;
export const NARRATION_WRAP_MAX_LEN = 80;
// Real-data finding, off a real UBA statement: its page footer/header boilerplate — "Download App |
// Chat with Leo | Our Website", "Head Office: 57 Marina...", "Africa's global bank ... Bank Statement" —
// sits at a y-position with no date and no amount of its own, exactly like a genuine wrapped-narration
// continuation line, so the original (bank-name-agnostic) skip list let it get silently absorbed into
// whichever transaction happened to be nearest on the page. Extended with UBA's specific phrasing, plus
// a few generic bank-footer patterns (website/contact-centre lines) that would plausibly recur on other
// banks' statements in the same position.
export const NARRATION_WRAP_SKIP_RE =
  /^(page\s+\d+|statement of account|continued|end of statement|generated on|printed on|download app|chat with leo|our website|head office\s*:|africa.s global bank|customer care|call\s*(centre|center)|toll[\s\-]?free|www\.|contact us)\b/i;

export function mergeWrappedNarrationLines(lines: Line[]): Line[] {
  const out: Line[] = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (!parseLeadingDate(line.text)) {
      out.push(line);
      i++;
      continue;
    }
    let mergedText = line.text;
    let extraText = '';
    let consumed = 0;
    while (consumed < NARRATION_WRAP_MAX_LINES && i + 1 + consumed < lines.length) {
      const next = lines[i + 1 + consumed];
      const nextText = (next.text || '').trim();
      if (next.__page !== line.__page) break; // never wrap across a page boundary
      if (!nextText || nextText.length > NARRATION_WRAP_MAX_LEN) break;
      if (parseLeadingDate(nextText)) break; // the next real row starts here
      if (extractAmountTokens(nextText).length > 0) break; // a real data row, not wrapped text
      if (NARRATION_WRAP_SKIP_RE.test(nextText)) break; // page furniture, not narration
      mergedText += ' ' + nextText;
      extraText += (extraText ? ' ' : '') + nextText;
      consumed++;
    }
    // __wrapExtra keeps just the absorbed continuation text separate from the row's own date/amount
    // cells, so a display-narration rebuild (buildCleanNarration) can drop the duplicated date/amount
    // text while still keeping every bit of genuine wrapped narration that was stitched on here.
    out.push(
      consumed
        ? { text: mergedText, parts: line.parts, __page: line.__page, __wrapExtra: extraText }
        : line
    );
    i += 1 + consumed;
  }
  return out;
}

// Real-data finding, off the "ALAT by WEMA" statement format: its Date column is rendered narrow
// enough that the date text WRAPS within its own table cell, so pdf.js's y-position line-bucketing
// splits a single date across two separate lines — e.g. "05-Feb-" on one line and a bare "2026" several
// lines later — while the transaction's actual reference/narration/amount data sits at a DIFFERENT
// y-position sandwiched between those two date fragments, with no date of its own. parseLeadingDate
// then rejects every one of those data lines, so the row-based parser finds zero transactions and the
// app reports "couldn't detect transaction rows" on an otherwise perfectly good statement.
//
// This reassembles the split date and prepends it onto the sandwiched data line, BEFORE
// mergeWrappedNarrationLines ever runs (that pass requires a line to already start with a date, so it
// can't help here on its own). Deliberately narrow: only fires on the exact [date-head-with-no-year,
// data-line-with-amounts-and-no-date, bare-4-digit-year] triple, on the same PDF page, so it can't
// misfire on an ordinary statement whose dates already sit on one line.
export const SPLIT_DATE_HEAD_RE = /^(\d{1,2})[\s\-\/](jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*[\s\-\/]?$/i;
export const SPLIT_DATE_YEAR_RE = /^(\d{4})$/;

export function mergeSplitDateLines(lines: Line[]): Line[] {
  const out: Line[] = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    const text = (line.text || '').trim();
    const headMatch = !parseLeadingDate(text) ? SPLIT_DATE_HEAD_RE.exec(text) : null;
    if (headMatch && i + 2 < lines.length) {
      const dataLine = lines[i + 1];
      const yearLine = lines[i + 2];
      const dataText = (dataLine.text || '').trim();
      const yearText = (yearLine.text || '').trim();
      const yearMatch = SPLIT_DATE_YEAR_RE.exec(yearText);
      if (
        yearMatch &&
        dataLine.__page === line.__page &&
        yearLine.__page === line.__page &&
        !parseLeadingDate(dataText) &&
        extractAmountTokens(dataText).length > 0
      ) {
        const fullDate = headMatch[0].replace(/[\s\-\/]+$/, '') + '-' + yearMatch[1];
        out.push({ text: fullDate + ' ' + dataLine.text, parts: dataLine.parts, __page: dataLine.__page });
        i += 3;
        continue;
      }
    }
    out.push(line);
    i++;
  }
  return out;
}

// Real-data finding, off a real UBA statement: the column-position path stores the WHOLE bucketed
// line (transaction date + value date + narration + debit/credit/balance figures, all joined into one
// string) as the transaction's narration — harmless for most statements, but on statements whose
// narration cell wraps across several physical lines the same duplicated date/amount text got repeated
// inside what should be a short description, making an already-long quoted narration read as outright
// garbled. This rebuilds a cleaner narration from the row's own text cells, dropping only cells that ARE
// (in their entirety) the date or one of the three amount figures already parsed out above — everything
// else, including any genuine wrapped-narration text appended by mergeWrappedNarrationLines, is kept
// untouched.
export function buildCleanNarration(
  line: Line,
  excludeX: Record<number, boolean> | null,
  wrapExtra?: string
): string {
  // Deliberately starts from '', not line.text — some real statement rows carry NO narration text of
  // their own on the dated/amount line at all (the whole description sits on a wrapped continuation
  // line instead), and starting from the full raw text here would silently re-glue the already-stripped
  // date/amount prefix back on, then duplicate the wrapExtra tail on top of that.
  let partsText = '';
  if (line.parts && line.parts.length) {
    const kept = line.parts.filter((p) => {
      const s = (p.str || '').trim();
      if (!s) return false;
      if (excludeX && excludeX[p.x]) return false;
      const dm = parseLeadingDate(s);
      if (dm && !dm.rest.trim()) return false; // the whole cell is just a date - not narration text
      return true;
    });
    partsText = kept
      .map((p) => p.str)
      .join(' ')
      .replace(/\s+/g, ' ')
      .trim();
  }
  const cleaned = (partsText + (wrapExtra ? ' ' + wrapExtra : '')).replace(/\s+/g, ' ').trim();
  return cleaned || line.text;
}

export function parseStatementLines(lines: Line[]): ParsedTxn[] {
  // Segment-aware: a document can contain more than one header occurrence, each with its own
  // x-positions (see detectColumnsAll) — walk a pointer forward through the occurrences as the row
  // index advances, always using whichever occurrence is nearest to (at-or-before, or otherwise the
  // very first) the current row, rather than one column set applied blindly to the whole document.
  const headerOccurrences = detectColumnsAll(lines);
  let hdrPtr = 0;
  const txns: ParsedTxn[] = [];
  let runningBalance: number | null = null;
  lines.forEach((line, lineIdx) => {
    const parsed = parseLeadingDate(line.text);
    if (!parsed) return;

    while (hdrPtr + 1 < headerOccurrences.length && headerOccurrences[hdrPtr + 1].index <= lineIdx) hdrPtr++;
    const columns = headerOccurrences.length ? headerOccurrences[hdrPtr].cols : null;
    // Debit/credit/balance in left-to-right table order, derived from this segment's own header.
    const colOrder = columns
      ? (Object.keys(columns) as (keyof typeof columns)[]).sort((a, b) => (columns[a] as number) - (columns[b] as number))
      : null;

    let credit = 0;
    let debit = 0;
    let balance: number | undefined;
    let excludeX: Record<number, boolean> | null = null;

    if (columns && colOrder && line.parts.length) {
      // Column-position path (text-based PDF). Amount cells are matched to debit/credit/balance by their
      // RELATIVE left-to-right order within this row, not by absolute proximity to a header's x-position —
      // right-aligned narrow debit/credit values (e.g. "0.00") can visually sit closer to the *next*
      // column's header than their own, but their order relative to each other never changes: whichever
      // comes first is debit, then credit, then balance, matching the header order.
      const amtParts = amountPartsOfLine(line).sort((a, b) => a.x - b.x);
      if (amtParts.length < 1) return;
      if (amtParts.length >= colOrder.length) {
        const tail = amtParts.slice(-colOrder.length);
        const assigned: Record<string, number> = {};
        colOrder.forEach((col, idx) => {
          assigned[col] = tail[idx].value;
        });
        if (assigned.balance === undefined) return;
        debit = Math.abs(assigned.debit || 0);
        credit = Math.abs(assigned.credit || 0);
        balance = assigned.balance;
        excludeX = {};
        tail.forEach((a) => {
          (excludeX as Record<number, boolean>)[a.x] = true;
        });
      } else if (amtParts.length === 2) {
        // One side (debit or credit) didn't survive as a separate token — we have [amount, balance].
        // Fall back to the running-balance delta to infer which side it belongs to.
        //
        // Tried and REJECTED: matching amtParts[0]'s x-position to whichever of columns.debit/
        // columns.credit it sits closer to. That looked promising on a real Opay statement (where the
        // one real amount landed exactly on its own column's x), but broke a real, previously-exact
        // Providus reconciliation — small right-aligned values there (e.g. a "50.00" Stamp Duty debit)
        // rendered 35+pt to the right of their own column's header, past the midpoint and closer to
        // the NEIGHBORING column, the same right-alignment drift the >= colOrder.length branch above
        // already has to guard against. That drift isn't bounded by a fixed margin — a short, narrow
        // value can drift arbitrarily far right depending on the column's width — so there's no safe
        // threshold that fixes one statement without silently flipping debits to credits on another.
        // The delta heuristic below is less clever but doesn't share that failure mode.
        balance = amtParts[1].value;
        const amt2 = Math.abs(amtParts[0].value);
        if (runningBalance !== null && Math.abs(runningBalance + amt2 - balance) < 1) credit = amt2;
        else if (runningBalance !== null && Math.abs(runningBalance - amt2 - balance) < 1) debit = amt2;
        else if (runningBalance !== null) {
          if (balance >= runningBalance) credit = amt2;
          else debit = amt2;
        } else debit = amt2;
        excludeX = {};
        amtParts.forEach((a) => {
          (excludeX as Record<number, boolean>)[a.x] = true;
        });
      } else {
        return; // just one token on the row - not enough to classify as a transaction
      }
      if (!debit && !credit) return; // header/summary row with only a balance figure
    } else {
      // Fallback path (no header detected, or an OCR-sourced line with no positions):
      // order-based heuristic using whichever text this line has.
      const amounts = extractAmountTokens(parsed.rest);
      if (amounts.length < 2) return;
      if (amounts.length >= 3) {
        const last3 = amounts.slice(-3);
        debit = Math.abs(last3[0]);
        credit = Math.abs(last3[1]);
        balance = last3[2];
      } else {
        const last2 = amounts.slice(-2);
        const amt = Math.abs(last2[0]);
        balance = last2[1];
        const lower = parsed.rest.toLowerCase();
        if (/\bcr\b|credit/.test(lower)) credit = amt;
        else if (/\bdr\b|debit/.test(lower)) debit = amt;
        else if (runningBalance !== null && Math.abs(runningBalance + amt - balance) < 1) credit = amt;
        else if (runningBalance !== null && Math.abs(runningBalance - amt - balance) < 1) debit = amt;
        else if (runningBalance !== null) {
          if (balance >= runningBalance) credit = amt;
          else debit = amt;
        } else debit = amt; // no prior balance to compare against - conservative default
      }
    }

    runningBalance = balance as number;
    const narrationText = excludeX ? buildCleanNarration(line, excludeX, line.__wrapExtra) : line.text;
    txns.push({ date: parsed.date, credit, debit, balance: balance as number, narration: narrationText });
  });
  return txns;
}

// Turns a single amount-shaped token into a number, or null. Used by the column-major fallback below,
// where we need to test whether a token IS ENTIRELY an amount (not just contains one, like AMOUNT_RE
// already does via its ^...$ anchors).
export function amountTokensStrict(text: string): number[] {
  return text
    .split(/\s+/)
    .filter((t) => AMOUNT_RE.test(t))
    .map((t) => parseFloat(t.replace(/,/g, '')));
}

export function parseDateToken(tok: string): Date | null {
  let m = tok.match(/^(\d{1,2})[\-\/](jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*[\-\/,]?(\d{4})$/i);
  if (m) {
    const months: Record<string, number> = {
      jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5, jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11,
    };
    const d = new Date(+m[3], months[m[2].toLowerCase().slice(0, 3)], +m[1]);
    return isNaN(d.getTime()) ? null : d;
  }
  m = tok.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})$/);
  if (m) {
    let yy = +m[3];
    if (yy < 100) yy += 2000;
    const d2 = new Date(yy, +m[2] - 1, +m[1]);
    return isNaN(d2.getTime()) ? null : d2;
  }
  return null;
}

// Per page, find the "date list" line (almost entirely individual dates — the Trans./Value. Date column,
// stacked as one string down the page) and a same-length "list" line elsewhere on the page (the Balance
// column). Only the FIRST date-list line found is used — Trans. Date and Value. Date are usually identical
// lists, and using both would double-count every row.
export function tryColumnMajorParsePage(pageLines: Line[]): { date: Date; balance: number }[] {
  let found: { line: Line; dates: Date[] } | null = null;
  for (let li = 0; li < pageLines.length; li++) {
    const line = pageLines[li];
    const tokens = line.text.split(/\s+/);
    const dates: Date[] = [];
    tokens.forEach((t) => {
      const d = parseDateToken(t);
      if (d) dates.push(d);
    });
    if (dates.length < 3) continue; // not a "date list" line
    if (dates.length < tokens.length - 3) continue; // allow only a short leading label, e.g. "Trans. Date"
    found = { line, dates };
    break;
  }
  if (!found) return [];
  const N = found.dates.length;
  const candidates = pageLines.filter((l) => {
    if (l === (found as { line: Line; dates: Date[] }).line) return false;
    return amountTokensStrict(l.text).length === N;
  });
  if (!candidates.length) return [];
  let chosen: Line | null = null;
  for (let ci = 0; ci < candidates.length; ci++) {
    if (/^bal(ance)?\.?$/i.test(candidates[ci].text.split(/\s+/)[0])) {
      chosen = candidates[ci];
      break;
    }
  }
  if (!chosen) chosen = candidates[0];
  const balances = amountTokensStrict(chosen.text);
  const out: { date: Date; balance: number }[] = [];
  for (let i = 0; i < N; i++) out.push({ date: found.dates[i], balance: balances[i] });
  return out;
}

// This layout's info box prints its field LABELS as one phrase ("...Total Debit Total Credit Closing
// Balance Usable Balance Opening Balance...") separately from its VALUES (a sibling line ending in the
// matching amounts, in the same left-to-right order, alongside the account currency name) — so "Opening
// Balance" as a value is simply the LAST amount on whichever line carries that value row, once we've
// confirmed the label phrase exists at all (guards against ever misreading an unrelated statement layout).
export function findOpeningBalanceForColumnMajor(pagesArr: Line[][], fullText: string): number | null {
  if (
    !/total\s*debit.{0,20}total\s*credit.{0,30}closing\s*balance.{0,30}usable\s*balance.{0,20}opening\s*balance/i.test(
      fullText
    )
  )
    return null;
  let best: number | null = null;
  pagesArr.forEach((pageLines) => {
    pageLines.forEach((l) => {
      const amt = amountTokensStrict(l.text);
      if (amt.length >= 5 && /naira|ngn/i.test(l.text)) best = amt[amt.length - 1];
    });
  });
  return best;
}

// Fallback for statements whose PDF renders each table COLUMN as its own vertically-stacked block of
// text (all sharing one Y position down the whole page) rather than a normal row grid — a real-world
// pathology seen from at least one major Nigerian bank's statement export. The normal row-based parser
// above sees this as a handful of garbled "lines" and finds ~0-1 real transactions. Here we instead look,
// per page, for a date-list line and a same-length balance-list line, and reconstruct each row's
// debit/credit from the balance-to-balance DELTA rather than also trying to disentangle separate
// Debit/Credit column lists (which, without header text after page 1, can't be told apart from Balance
// by shape alone). Narration is deliberately left blank for these reconstructed rows — the Remarks
// column's text is one long run per page with no reliable per-row boundary to split it on.
export function tryColumnMajorStatementParse(allLines: Line[]): ParsedTxn[] {
  const byPage: Record<string, Line[]> = {};
  const pageOrder: (string | number)[] = [];
  allLines.forEach((l) => {
    const p = l.__page || 0;
    if (!byPage[p]) {
      byPage[p] = [];
      pageOrder.push(p);
    }
    byPage[p].push(l);
  });
  const pagesArr = pageOrder.map((p) => byPage[p]);
  const fullText = allLines.map((l) => l.text || '').join(' ');
  let runningBalance = findOpeningBalanceForColumnMajor(pagesArr, fullText);
  const txns: ParsedTxn[] = [];
  pagesArr.forEach((pageLines) => {
    const rows = tryColumnMajorParsePage(pageLines);
    rows.forEach((r) => {
      let credit = 0;
      let debit = 0;
      if (runningBalance !== null) {
        const delta = r.balance - runningBalance;
        if (delta >= 0) credit = delta;
        else debit = -delta;
      }
      runningBalance = r.balance;
      txns.push({ date: r.date, credit, debit, balance: r.balance, narration: '' });
    });
  });
  return txns;
}

// The row-based parser above covers the vast majority of statement formats; this only reaches for the
// column-major reconstruction when the normal parser essentially found nothing, so normal (working)
// statement formats are never affected by it.
export function parseStatementLinesWithFallback(
  lines: Line[]
): ParsedTxn[] & { __usedColumnMajorFallback?: boolean } {
  const txns = parseStatementLines(mergeWrappedNarrationLines(mergeSplitDateLines(lines)));
  if (txns.length >= 2) {
    markAmountMatchedReversals(txns);
    return txns;
  }
  // Column-major fallback deliberately uses the RAW (unmerged) lines — it reads dates/balances off
  // whole date-list/balance-list lines by shape, not narration, so wrap-merging has nothing to offer
  // it and could only risk interfering with that separate detection pass.
  const fallback = tryColumnMajorStatementParse(lines) as ParsedTxn[] & { __usedColumnMajorFallback?: boolean };
  if (fallback.length > txns.length) {
    fallback.__usedColumnMajorFallback = true;
    markAmountMatchedReversals(fallback);
    return fallback;
  }
  markAmountMatchedReversals(txns);
  return txns;
}

export function aggregateTransactions(txns: ParsedTxn[]): MonthAggregate[] {
  const byMonth: Record<string, MonthAggregate> = {};
  txns.forEach((t) => {
    const key = t.date.getFullYear() + '-' + t.date.getMonth();
    if (!byMonth[key])
      byMonth[key] = {
        year: t.date.getFullYear(),
        month: t.date.getMonth(),
        inflow: 0,
        outflow: 0,
        lastDate: t.date,
        lastBalance: t.balance,
      };
    byMonth[key].inflow += t.credit;
    byMonth[key].outflow += t.debit;
    if (t.date >= byMonth[key].lastDate) {
      byMonth[key].lastDate = t.date;
      byMonth[key].lastBalance = t.balance;
    }
  });
  const arr = Object.keys(byMonth).map((k) => byMonth[k]);
  arr.sort((a, b) => a.year * 12 + a.month - (b.year * 12 + b.month));
  return arr;
}

// Group credit transactions by rounded amount and see which one recurs across the most distinct
// months — the best candidate for a "stable monthly income" (salary), the way a human reviewer would
// spot it by eye when scanning down a statement.
export function identifyStableIncome(txns: ParsedTxn[]): StableIncome | null {
  const groups: Record<number, Record<string, boolean>> = {};
  txns.forEach((t) => {
    if (!t.credit || isReversalNarration(t) || isNonIncomeChargeNarration(t.narration)) return;
    const rounded = Math.round(t.credit / 5000) * 5000;
    const monthKey = t.date.getFullYear() + '-' + t.date.getMonth();
    if (!groups[rounded]) groups[rounded] = {};
    groups[rounded][monthKey] = true;
  });
  let best: number | null = null;
  let bestCount = 0;
  Object.keys(groups).forEach((k) => {
    // Skip the "rounds to ₦0" bucket entirely — every credit under ₦2,500 lands here regardless of
    // what it actually is (an airtime top-up, an SMS charge, a stray coin credit), so several
    // completely unrelated tiny amounts can coincidentally pile up into what LOOKS like the
    // best-recurring bucket. A "stable monthly income" of ₦0 is meaningless by definition, so this
    // bucket can never win regardless of count — an extra structural safeguard alongside the
    // narration-based isNonIncomeChargeNarration exclusion above, for whatever that exclusion's
    // keyword list doesn't happen to catch.
    if (+k <= 0) return;
    const count = Object.keys(groups[+k]).length;
    if (count > bestCount) {
      bestCount = count;
      best = +k;
    }
  });
  if (best === null || bestCount < 2) return null;
  return { amount: best, monthsSeen: bestCount };
}
