#!/usr/bin/env node
'use strict';

// PII intake safeguard.
//
// Twice now, a real user's data — sent to us as a bug report or a screenshot to explain a real
// statement-parsing problem — ended up copy-pasted into a committed file (a code comment, a test
// fixture, a changelog entry) before it was fictionalized. Both times we caught it after the fact
// and scrubbed it. This script exists so we stop relying on catching it after the fact.
//
// Two tiers:
//   1. DENYLIST  — exact strings we have already found leaked and scrubbed once. A hard match here
//      FAILS the scan (exit code 1). Every time a new leak is found and fixed, add the string(s)
//      here so that exact leak can never silently recur.
//   2. STRUCTURAL heuristics — patterns that *look like* a real passport number, phone number, or
//      BVN, even though we don't have a specific denylist entry for them. These only WARN (they
//      don't fail the build), because our own fixtures deliberately contain realistic-looking fake
//      IDs (e.g. a fake MRZ passport number) — a hard fail here would have false-positived on
//      legitimate fixtures. Warnings are for a human to glance at before shipping, not a gate.
//
// Usage:
//   node scripts/pii-scan.js              # scans every git-tracked file in the repo
//   node scripts/pii-scan.js a.js b.pdf   # scans only the given files (used for a delivery batch)
//
// Exit code 0 = clean (warnings may still be printed). Exit code 1 = at least one denylist hit.

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

var REPO_ROOT = path.join(__dirname, '..');

// ---------------------------------------------------------------------------------------------
// Tier 1: known-real strings that have already leaked into this repo at least once. Case-
// insensitive substring match. Add to this list — never remove from it — whenever a new leak is
// found and scrubbed, citing what it was in a comment so the history stays legible.
// ---------------------------------------------------------------------------------------------
var DENYLIST = [
  // Real applicant name/passport data (session: personal-name + passport/DOB cleanup)
  { term: 'olatunde', note: 'real applicant first name' },
  { term: 'oladele', note: 'real applicant surname' },
  { term: 'b51143397', note: 'real passport number' },
  { term: '8061292474', note: 'real phone/account number' },
  { term: '6505823562', note: 'real phone/account number' },
  { term: 'oluwaseyi', note: 'real applicant name (decl_name placeholder leak)' },
  { term: 'adegboyega', note: 'real applicant name (decl_name placeholder leak)' },
  { term: 'mosunmola', note: 'real applicant name' },
  { term: 'oluwafunmilayo', note: 'real applicant name (reused across fixtures/comments/changelog)' },
  { term: 'agboola', note: 'real applicant surname (reused across fixtures/comments/changelog)' },
  // Real business/organization names (session: business-name cleanup, incl. glued variant)
  { term: 'crisp n clean', note: 'real business name reused as test fixture data' },
  { term: 'crisp n clear', note: 'misspelled variant of the same real business name' },
  { term: 'gregory george', note: 'real name used as a fixture sender' },
  { term: 'mfm lekki', note: 'real church name' },
  { term: 'mfmlyc', note: 'glued-together abbreviation of the same real church name' },
  { term: 'clean deals ventures', note: 'real business name variant' },
  // Found by this scanner's first-ever run — a real bio-data page (name, passport no., DOB) had
  // survived two earlier manual scrub rounds inside a PDF fixture, because raw grep over a PDF's
  // bytes doesn't see text that's inside a compressed content stream (see extractText() above).
  // Also a real third-party name quoted in changelog narrative describing the same real statement.
  { term: 'b50338594', note: 'real passport number (found inside a PDF fixture — raw grep had missed it)' },
  { term: 'ekim hannah', note: 'real third-party name quoted in changelog narrative' },
  { term: 'james daniel', note: 'real third-party name quoted in changelog/test-comment narrative' }
];

// ---------------------------------------------------------------------------------------------
// Tier 2: structural "this looks like a real identifier" heuristics. Warn-only.
// ---------------------------------------------------------------------------------------------
var STRUCTURAL_PATTERNS = [
  {
    name: 'Nigerian-style passport number',
    // One letter + 8 digits, as a standalone token (e.g. "A12345678").
    regex: /\b[A-Za-z]\d{8}\b/g
  },
  {
    name: 'Nigerian-style phone number',
    regex: /\b0[7-9][0-1]\d{8}\b/g
  },
  {
    name: 'BVN-style 11-digit number near a "BVN" label',
    regex: /\bBVN[:\s]*\d{11}\b/gi
  },
  {
    name: 'NUBAN-style 10-digit account number near an "Account" label',
    regex: /\bAccount\s*(?:No\.?|Number)?[:\s]*\d{10}\b/gi
  }
];

var TEXT_EXTENSIONS = ['.html', '.htm', '.js', '.md', '.json', '.txt', '.css', '.yml', '.yaml'];

function listTrackedFiles(){
  try {
    var out = execFileSync('git', ['ls-files'], { cwd: REPO_ROOT, encoding: 'utf8' });
    return out.split('\n').map(function(s){ return s.trim(); }).filter(Boolean);
  } catch (e) {
    // No git available — fall back to walking the tree, skipping the obvious noise.
    var results = [];
    (function walk(dir){
      var entries;
      try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch (e2) { return; }
      entries.forEach(function(entry){
        if (entry.name === '.git' || entry.name === 'node_modules') return;
        var full = path.join(dir, entry.name);
        if (entry.isDirectory()) { walk(full); }
        else { results.push(path.relative(REPO_ROOT, full)); }
      });
    })(REPO_ROOT);
    return results;
  }
}

var pdftotextAvailable = null;
function havePdftotext(){
  if (pdftotextAvailable !== null) return pdftotextAvailable;
  try {
    execFileSync('pdftotext', ['-v'], { stdio: 'ignore' });
    pdftotextAvailable = true;
  } catch (e) {
    pdftotextAvailable = false;
  }
  return pdftotextAvailable;
}

function extractText(relPath){
  var abs = path.join(REPO_ROOT, relPath);
  var ext = path.extname(relPath).toLowerCase();

  if (ext === '.pdf') {
    // IMPORTANT: PDF content streams are typically compressed, so a raw byte/string search over
    // the file will silently miss text that's really in there — this is not a hypothetical, it
    // was confirmed empirically against our own reportlab-generated fixtures. Always extract via
    // pdftotext (poppler-utils) rather than reading the file as if it were plain text.
    if (!havePdftotext()) {
      return { text: null, skippedReason: 'pdftotext not installed — cannot scan PDF text (see README/CI setup)' };
    }
    try {
      var out = execFileSync('pdftotext', ['-layout', abs, '-'], { encoding: 'utf8', maxBuffer: 1024 * 1024 * 20 });
      return { text: out };
    } catch (e) {
      return { text: null, skippedReason: 'pdftotext failed on this file: ' + e.message };
    }
  }

  if (TEXT_EXTENSIONS.indexOf(ext) === -1) {
    return { text: null, skippedReason: null }; // silently skip binaries we don't know how to read (images, etc.)
  }

  try {
    return { text: fs.readFileSync(abs, 'utf8') };
  } catch (e) {
    return { text: null, skippedReason: 'could not read file: ' + e.message };
  }
}

function scanFile(relPath){
  var findings = { denylist: [], warnings: [], skippedReason: null };
  var result = extractText(relPath);
  if (result.text === null) {
    findings.skippedReason = result.skippedReason;
    return findings;
  }
  var text = result.text;
  var lowerText = text.toLowerCase();

  DENYLIST.forEach(function(entry){
    if (lowerText.indexOf(entry.term.toLowerCase()) !== -1) {
      findings.denylist.push(entry);
    }
  });

  STRUCTURAL_PATTERNS.forEach(function(pat){
    var matches = text.match(pat.regex);
    if (matches && matches.length) {
      findings.warnings.push({ name: pat.name, sample: matches.slice(0, 3) });
    }
  });

  return findings;
}

function main(){
  var argFiles = process.argv.slice(2);
  var files = argFiles.length ? argFiles : listTrackedFiles();

  var hardFails = [];
  var softWarnings = [];
  var skipped = [];

  files.forEach(function(relPath){
    var findings = scanFile(relPath);
    if (findings.skippedReason) {
      skipped.push({ file: relPath, reason: findings.skippedReason });
    }
    if (findings.denylist.length) {
      hardFails.push({ file: relPath, hits: findings.denylist });
    }
    if (findings.warnings.length) {
      softWarnings.push({ file: relPath, hits: findings.warnings });
    }
  });

  if (hardFails.length) {
    console.log('\n✗ PII SCAN FAILED — known-real data found in the following files:\n');
    hardFails.forEach(function(f){
      console.log('  ' + f.file);
      f.hits.forEach(function(h){
        console.log('    - "' + h.term + '"  (' + h.note + ')');
      });
    });
    console.log('\nFix: replace the real data with clearly fictional data before this can ship.');
  }

  if (softWarnings.length) {
    console.log('\n⚠ Structural warnings (review, but not a blocker — our own fixtures legitimately' +
      ' contain realistic-looking fake IDs):\n');
    softWarnings.forEach(function(f){
      console.log('  ' + f.file);
      f.hits.forEach(function(h){
        console.log('    - ' + h.name + ': ' + JSON.stringify(h.sample));
      });
    });
  }

  var skippedPdfIssue = skipped.filter(function(s){ return /pdftotext/.test(s.reason || ''); });
  if (skippedPdfIssue.length) {
    console.log('\n⚠ ' + skippedPdfIssue.length + ' PDF file(s) could NOT be scanned (pdftotext unavailable/failed) — ' +
      'install poppler-utils to scan PDF fixtures:');
    skippedPdfIssue.forEach(function(s){ console.log('    - ' + s.file + ': ' + s.reason); });
  }

  if (!hardFails.length && !softWarnings.length) {
    console.log('✓ PII scan clean: ' + files.length + ' file(s) checked, no known-real data or structural warnings found.');
  } else if (!hardFails.length) {
    console.log('\n✓ No denylisted PII found (warnings above are informational only).');
  }

  process.exit(hardFails.length ? 1 : 0);
}

main();
