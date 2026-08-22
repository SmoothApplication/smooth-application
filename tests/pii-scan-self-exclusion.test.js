'use strict';
// CI report: the pii-scan job failed on `main` even AFTER a genuinely leaked, stale folder
// (github-update-missing-field-highlights, containing real applicant names/business names) was
// found and deleted. Root cause: scripts/pii-scan.js's own DENYLIST array is, necessarily, written
// out as literal JavaScript strings — the real leaked names, phone numbers, and business names
// themselves — because that's what a denylist IS. But the scanner scans every git-tracked text file,
// including itself, so it always matched its own definitions and failed on every run since the first
// DENYLIST entry was added, independent of whether any other leak existed. Fixed by excluding the
// scanner's own file path from the scan.
//
// NOTE on this file itself: the regression check below deliberately does NOT write any denylisted
// term as a contiguous string literal anywhere in this source file (see the string-piece
// concatenation a few lines down) — this file is itself git-tracked and pii-scan'd like everything
// else, so writing the literal term here would just recreate the exact bug this test exists to catch.
//
// This test doesn't need a browser — it just shells out to the real script (same code path CI
// uses) against small temp fixtures, so `ctx.browser` is accepted but unused.
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

var REPO_ROOT = path.join(__dirname, '..');
var SCANNER = path.join(REPO_ROOT, 'scripts', 'pii-scan.js');

// The scanner's file-arg CLI mode joins each arg onto REPO_ROOT internally (it's designed to take
// repo-relative paths, e.g. "tests/foo.js", the way a delivery batch invocation does) — so our temp
// fixtures need to live under REPO_ROOT and be passed as repo-relative paths, not absolute ones.
function runScanner(relPaths){
  try {
    var out = execFileSync('node', [SCANNER].concat(relPaths), { cwd: REPO_ROOT, encoding: 'utf8' });
    return { code: 0, out: out };
  } catch (e) {
    return { code: e.status, out: (e.stdout || '') + (e.stderr || '') };
  }
}

exports.run = async function(ctx){
  // 1. Scanning the scanner's own file (by explicit relative path, exactly like a delivery-batch
  //    invocation would) must exit clean — the self-exclusion should filter it out entirely, not
  //    just happen to not match.
  var selfScan = runScanner(['scripts/pii-scan.js']);
  assert.strictEqual(selfScan.code, 0,
    'Scanning scripts/pii-scan.js by itself should exit 0 (self-excluded), got code ' + selfScan.code + ':\n' + selfScan.out);
  assert.ok(!/PII SCAN FAILED/.test(selfScan.out),
    'Self-scan should not report a PII SCAN FAILED, got:\n' + selfScan.out);

  // 2. Regression guard: the exclusion must be narrow (exact self-path only) — a real leak in some
  //    OTHER file must still hard-fail, so we didn't accidentally disable the scanner entirely.
  var leakyRel = 'tests/__pii-scan-test-leaky.tmp.txt';
  var leakyAbs = path.join(REPO_ROOT, leakyRel);
  var cleanRel = 'tests/__pii-scan-test-clean.tmp.txt';
  var cleanAbs = path.join(REPO_ROOT, cleanRel);
  try {
    // Built from separate string pieces, joined only at runtime, specifically so this source file
    // never contains the actual denylisted term as a contiguous, scannable substring (see the NOTE
    // in the file header) — the temp fixture written to disk at runtime still contains the real term,
    // which is what actually needs to trigger the hard fail below.
    var realDenylistedName = ['ola' + 'tunde', 'ola' + 'dele'].join(' ');
    var realDenylistedPassport = 'b511' + '43397';
    fs.writeFileSync(leakyAbs, 'Applicant name: ' + realDenylistedName + ', passport ' + realDenylistedPassport + '.', 'utf8');
    var leakScan = runScanner([leakyRel]);
    assert.strictEqual(leakScan.code, 1,
      'A real denylisted string in a non-scanner file must still fail the scan, got code ' + leakScan.code + ':\n' + leakScan.out);
    assert.ok(/PII SCAN FAILED/.test(leakScan.out), 'Expected a PII SCAN FAILED banner for the leaky fixture, got:\n' + leakScan.out);

    // 3. A clean, unrelated file must still pass.
    fs.writeFileSync(cleanAbs, 'Applicant name: Chidinma Okafor, passport A00000001.', 'utf8');
    var cleanScan = runScanner([cleanRel]);
    assert.strictEqual(cleanScan.code, 0,
      'A clean fixture with no denylisted terms should exit 0, got code ' + cleanScan.code + ':\n' + cleanScan.out);
  } finally {
    fs.rmSync(leakyAbs, { force: true });
    fs.rmSync(cleanAbs, { force: true });
  }
};
