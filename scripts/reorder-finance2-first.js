#!/usr/bin/env node
'use strict';
// One-off maintenance script: moves the "Income & bank statement analysis" session
// (data-session-key="finance2") to be the FIRST session in the checklist, ahead of Passport —
// per founder decision: bank-statement/financial readiness is the one requirement with real
// calendar lead time (building 3-6 months of clean statement history, fixing gaps), so it should
// be faced first while there's still time to act on it. Passport renewal is parallelizable and
// doesn't need to be first.
//
// Does two things, both byte-exact (no manual HTML retyping, which risks transcription errors on
// a 280+ line block):
//   1. In index.html: cuts the whole finance2 <details> card out (correctly matching nested
//      <details> tags inside it - the "Advanced details" menu and "Income vs. closing balance"
//      dropdown - via depth counting, not a naive first-</details> match) and reinserts it
//      immediately before the passport <details> card. Moves the `open` attribute from passport's
//      tag to finance2's tag (finance2 is now the first, auto-expanded session). Updates the
//      `keys` array inside getVisibleSessionKeys() so pill-bar order matches.
//   2. In every tests/*.test.js file: remaps hardcoded goToSessionByPill(page, N) index arguments
//      per the resulting permutation. Only N 0-4 change (finance2 was at 4, is now 0; passport/
//      travelExperience/responsibilities/trip each shift +1). N=5 (finance) and N=6 (nextSteps)
//      and N>=7 (checklist categories, bizLedger, review) are UNCHANGED, since they all sit after
//      finance2 in both the old and new order.
//
// Run once from the repo root: `node scripts/reorder-finance2-first.js`
// Then: review with `git diff`, run `npm test`, and delete this script (or leave it — harmless
// either way, it's idempotent-unsafe to run twice so don't re-run it after the first success).

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const INDEX_PATH = path.join(ROOT, 'index.html');
const TESTS_DIR = path.join(ROOT, 'tests');

// --- Part 1: index.html restructuring -------------------------------------------------------

function findMatchingDetailsEnd(html, openTagStart){
  // openTagStart points at the '<' of the opening <details ...> tag. Walk forward counting
  // nested <details tags vs </details> closes until depth returns to 0. Returns the index just
  // after the matching </details>.
  const openRe = /<details\b/g;
  const closeStr = '</details>';
  let depth = 0;
  let i = openTagStart;
  while (i < html.length) {
    const nextOpen = html.indexOf('<details', i);
    const nextClose = html.indexOf(closeStr, i);
    if (nextClose === -1) throw new Error('Unmatched <details> - no closing tag found');
    if (nextOpen !== -1 && nextOpen < nextClose) {
      depth += 1;
      i = nextOpen + '<details'.length;
    } else {
      depth -= 1;
      i = nextClose + closeStr.length;
      if (depth === 0) return i;
    }
  }
  throw new Error('Unmatched <details> - ran off the end of the file');
}

function reorderIndexHtml(){
  let html = fs.readFileSync(INDEX_PATH, 'utf8');

  const finance2Marker = '<details class="card collapsible" data-session-key="finance2"';
  const passportMarker = '<details class="card collapsible" data-session-key="passport"';

  const finance2Start = html.indexOf(finance2Marker);
  const passportStart = html.indexOf(passportMarker);
  if (finance2Start === -1) throw new Error('Could not find finance2 session card - already moved, or markup changed');
  if (passportStart === -1) throw new Error('Could not find passport session card');
  if (finance2Start < passportStart) {
    console.log('finance2 already appears before passport - nothing to do for index.html.');
    return false;
  }

  const finance2End = findMatchingDetailsEnd(html, finance2Start);
  let finance2Block = html.slice(finance2Start, finance2End);

  // Remove the block from its old position (plus the newline/indentation right before it, to
  // avoid leaving a blank line behind).
  let beforeBlockStart = finance2Start;
  while (beforeBlockStart > 0 && /[ \t]/.test(html[beforeBlockStart - 1])) beforeBlockStart -= 1;
  if (html[beforeBlockStart - 1] === '\n') beforeBlockStart -= 1;
  const htmlWithoutFinance2 = html.slice(0, beforeBlockStart) + html.slice(finance2End);

  // Re-find passport's position in the shortened string (index shifted since we removed text
  // before it) and figure out its own line-start indentation to match when inserting.
  const newPassportStart = htmlWithoutFinance2.indexOf(passportMarker);
  if (newPassportStart === -1) throw new Error('Lost track of passport marker after removing finance2 block');
  let passportLineStart = newPassportStart;
  while (passportLineStart > 0 && htmlWithoutFinance2[passportLineStart - 1] !== '\n') passportLineStart -= 1;
  const indent = htmlWithoutFinance2.slice(passportLineStart, newPassportStart);

  // Move the `open` attribute: strip it from finance2's captured block (it never had one) is a
  // no-op; add ` open` to finance2's opening tag, and strip ` open` from passport's opening tag.
  finance2Block = finance2Block.replace(
    '<details class="card collapsible" data-session-key="finance2" style="border-left-color:#0b7a6e;">',
    '<details class="card collapsible" data-session-key="finance2" style="border-left-color:#0b7a6e;" open>'
  );
  let result = htmlWithoutFinance2.slice(0, passportLineStart)
    + finance2Block + '\n\n' + indent
    + htmlWithoutFinance2.slice(passportLineStart);

  result = result.replace(
    '<details class="card collapsible" data-session-key="passport" style="border-left-color:#8a4baf;" open>',
    '<details class="card collapsible" data-session-key="passport" style="border-left-color:#8a4baf;">'
  );

  // Update the keys array that drives session-pill order.
  const oldKeysLine = "var keys = ['passport', 'travelExperience', 'responsibilities', 'trip', 'finance2', 'finance', 'nextSteps'];";
  const newKeysLine = "var keys = ['finance2', 'passport', 'travelExperience', 'responsibilities', 'trip', 'finance', 'nextSteps'];";
  if (result.indexOf(oldKeysLine) === -1) throw new Error('Could not find the session `keys` array line to update - markup may have changed');
  result = result.replace(oldKeysLine, newKeysLine);

  fs.writeFileSync(INDEX_PATH, result, 'utf8');
  console.log('index.html: moved finance2 session card before passport, updated keys array and `open` attribute.');
  return true;
}

// --- Part 2: test file pill-index remap -----------------------------------------------------
// Old order:  passport=0, travelExperience=1, responsibilities=2, trip=3, finance2=4, finance=5, nextSteps=6, ...unchanged from 7+
// New order:  finance2=0, passport=1, travelExperience=2, responsibilities=3, trip=4, finance=5, nextSteps=6, ...unchanged from 7+
const REMAP = { 0: 1, 1: 2, 2: 3, 3: 4, 4: 0 }; // 5 and above: unchanged

function remapTestFiles(){
  const files = fs.readdirSync(TESTS_DIR).filter(function(f){ return f.endsWith('.test.js'); });
  let totalCalls = 0, totalFiles = 0;
  files.forEach(function(f){
    const filePath = path.join(TESTS_DIR, f);
    const src = fs.readFileSync(filePath, 'utf8');
    let changed = false;
    const out = src.replace(/goToSessionByPill\(([^,()]+),\s*(\d+)\)/g, function(whole, pageExpr, digits){
      const n = parseInt(digits, 10);
      if (!(n in REMAP)) return whole; // 5+ unchanged
      changed = true;
      totalCalls += 1;
      return 'goToSessionByPill(' + pageExpr + ', ' + REMAP[n] + ')';
    });
    if (changed) {
      fs.writeFileSync(filePath, out, 'utf8');
      totalFiles += 1;
    }
  });
  console.log('Test files: remapped ' + totalCalls + ' goToSessionByPill(...) call(s) across ' + totalFiles + ' file(s).');
}

const movedHtml = reorderIndexHtml();
remapTestFiles();
if (movedHtml) {
  console.log('\nDone. Now run: git diff -- index.html | head -80   (sanity check)');
  console.log('Then: npm test');
}
