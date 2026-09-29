'use strict';
// Replaces the retired 142-file Playwright suite (see git history / CHANGELOG "Retire the legacy
// index.html Playwright suite" for why): that suite drove a browser against the ROOT /index.html
// expecting the old single-file app's full UI (#quizIntro, the country picker, the passport
// scanner, etc). Since "Retire the old GitHub Pages site", root index.html is just a two-line
// redirect page — every one of those 142 tests was structurally broken from that point on, all
// testing a page that no longer exists, not a real regression. The actual, current app
// (smoothapplication.com) already has its own real coverage: the Jest suite under web/ (473 tests
// as of this writing), which CI now runs directly (see .github/workflows/ci.yml).
//
// What's left to test at the repo root is only the root's own job: redirect the visitor, and make
// sure a stale, already-installed service worker from the old app can still be forced off (see
// sw.js's own top-of-file comment for the full incident this exists to prevent). Plain Node +
// `fs`/`assert` — no browser needed, so this runs anywhere, including CI environments that can't
// download a Playwright browser build.
const assert = require('assert');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');

function run() {
  var indexHtml = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');

  assert.ok(/http-equiv="refresh"[^>]*url=https:\/\/smoothapplication\.com/i.test(indexHtml),
    'index.html should have a <meta http-equiv="refresh"> redirect to smoothapplication.com, for browsers with JS disabled');
  assert.ok(/window\.location\.replace\(\s*['"]https:\/\/smoothapplication\.com['"]\s*\)/.test(indexHtml),
    'index.html should also redirect via window.location.replace(...) for browsers with JS enabled — replace() so the retired page never enters browser history');
  assert.ok(/rel="canonical"[^>]*href="https:\/\/smoothapplication\.com"/i.test(indexHtml),
    'index.html should point its canonical link at smoothapplication.com, not itself, so search engines don\'t index the retired page');
  assert.ok(/serviceWorker\.register\(\s*['"]sw\.js['"]\s*\)/.test(indexHtml),
    'index.html should re-register sw.js on every visit, so THIS visit triggers the kill-switch update check immediately rather than waiting on the browser\'s own periodic check');

  var swJs = fs.readFileSync(path.join(ROOT, 'sw.js'), 'utf8');

  assert.ok(/self\.skipWaiting\(\)/.test(swJs),
    'sw.js should call skipWaiting() on install, so it takes over immediately instead of waiting for all old tabs to close');
  assert.ok(/caches\s*\.\s*keys\(\)/.test(swJs) && /caches\.delete/.test(swJs),
    'sw.js should delete every cache the old worker created — leaving stale caches behind would keep serving old content even after the worker itself is gone');
  assert.ok(/self\.registration\.unregister\(\)/.test(swJs),
    'sw.js should unregister itself once its cleanup work is done, so the origin ends up with no service worker at all (matching what the current app, which never registers one, expects)');
  assert.ok(/clients\.matchAll/.test(swJs) && /client\.navigate\(/.test(swJs),
    'sw.js should force every open tab to re-navigate, so an applicant who already has the tab open sees the redirect immediately rather than needing a manual refresh');

  console.log('  redirect-and-kill-switch: all checks passed');
}

if (require.main === module) {
  try {
    run();
    process.exit(0);
  } catch (err) {
    console.error('FAIL: ' + err.message);
    process.exit(1);
  }
}

module.exports = { run };
