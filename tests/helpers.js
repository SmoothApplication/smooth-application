// Shared helpers for the plain-Node Playwright test suite (no @playwright/test framework —
// just `playwright` + Node's built-in assert, run via tests/run-all.js). Kept dependency-light
// on purpose: this is a static, no-build, single-file app, so the test tooling shouldn't need a
// build step either.
'use strict';

const { chromium } = require('playwright');
const path = require('path');
const http = require('http');
const fs = require('fs');

const ROOT = path.join(__dirname, '..');
const PORT = process.env.TEST_PORT ? parseInt(process.env.TEST_PORT, 10) : 8971;

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml'
};

// Minimal static file server so tests run over a real http:// origin, not file:// — several
// things under test (the service worker, manifest link, fetch()-based helpers) either don't
// work at all or behave differently under file://.
function startServer(){
  const server = http.createServer(function(req, res){
    var urlPath = decodeURIComponent((req.url || '/').split('?')[0]);
    if (urlPath === '/') urlPath = '/index.html';
    var filePath = path.join(ROOT, urlPath);
    if (!filePath.startsWith(ROOT)){ res.writeHead(403); res.end(); return; }
    fs.readFile(filePath, function(err, data){
      if (err){ res.writeHead(404); res.end('Not found'); return; }
      var ext = path.extname(filePath);
      res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream' });
      res.end(data);
    });
  });
  return new Promise(function(resolve){
    server.listen(PORT, '127.0.0.1', function(){ resolve(server); });
  });
}

async function launchBrowser(){
  var opts = {};
  // This sandbox's pre-installed browser lives outside the default Playwright cache path — set
  // PLAYWRIGHT_CHROMIUM_PATH to reuse it instead of downloading. CI (and any normal machine that
  // ran `npx playwright install`) should leave this unset and use Playwright's managed browser.
  if (process.env.PLAYWRIGHT_CHROMIUM_PATH) opts.executablePath = process.env.PLAYWRIGHT_CHROMIUM_PATH;
  return chromium.launch(opts);
}

async function newPageAt(browser, urlPath, opts){
  var context = await browser.newContext(opts || {});
  var page = await context.newPage();
  page.on('dialog', function(d){ d.accept(); }); // auto-accept the "still X% done — proceed anyway?" nudge
  await page.goto('http://127.0.0.1:' + PORT + (urlPath || '/index.html'));
  return page;
}

// Selects a country, ticks the disclaimer checkbox, and clicks through the consent gate — the
// entry point every other test needs to get past first.
async function passConsentGate(page, options){
  var country = (options && options.country) || 'UK';
  await page.waitForSelector('#gateCountrySelect');
  await page.selectOption('#gateCountrySelect', country);
  await page.check('#gateAgree', { force: true });
  await page.click('#gateContinue');
  await page.waitForFunction(function(){
    var el = document.getElementById('appWrap');
    return el && el.style.display !== 'none';
  }, { timeout: 5000 });
}

// Jumps directly to a session by index via its numbered pill — unlike the "Next →" button, this
// never triggers the soft "you're not done yet" confirm dialog, which keeps tests deterministic.
//
// If a text field still has focus (e.g. right after page.fill()), its 'change' listener fires
// render() on blur, which rebuilds the session-pill DOM. If that rebuild lands in the same
// instant as the click's own hit-test, the click can land on a pill node that's mid-replacement
// and silently do nothing. Real users don't hit this in practice (there's always some reaction
// time between finishing typing and clicking elsewhere), but to keep tests deterministic we blur
// whatever's focused and let that render() settle before clicking.
async function goToSessionByPill(page, idx){
  await page.evaluate(function(){ document.activeElement && document.activeElement.blur(); });
  await page.waitForTimeout(50);
  await page.click('.session-pill[data-idx="' + idx + '"]');
}

// Jumps to a session by its display label (e.g. 'Validate your International Passport') instead of
// a hardcoded numeric index — added when 3 new sessions were prepended ahead of the existing ones,
// which shifted every previously-hardcoded index by +3. Index-based navigation is still fine for
// existing tests (all shifted in one pass), but new tests should prefer this where practical so a
// future reorder doesn't require another repo-wide shift.
async function goToSessionByLabel(page, label){
  await page.evaluate(function(){ document.activeElement && document.activeElement.blur(); });
  await page.waitForTimeout(50);
  var idx = await page.$$eval('.session-pill', function(pills, label){
    for (var i = 0; i < pills.length; i++){
      var title = pills[i].getAttribute('title') || '';
      if (title.indexOf(label) === 0) return i;
    }
    return -1;
  }, label);
  if (idx === -1) throw new Error('No session pill found with label "' + label + '"');
  await page.click('.session-pill[data-idx="' + idx + '"]');
}

module.exports = { startServer, launchBrowser, newPageAt, passConsentGate, goToSessionByPill, goToSessionByLabel, PORT, ROOT };
