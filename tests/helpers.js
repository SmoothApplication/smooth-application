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
  // Fake camera device + auto-accepted permission prompt — lets the guided passport-camera-scan
  // feature (see passport-camera-scan.test.js) actually exercise getUserMedia in headless CI
  // without a real webcam. Inert everywhere else: no other test calls getUserMedia, so this changes
  // nothing about the rest of the suite.
  opts.args = ['--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream'];
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
// entry point every other test needs to get past first. Two screens now load ahead of the consent
// gate — the confidence quiz (confidence-quiz.test.js) and the "two documents" page
// (docs-gate.test.js) — so this skips both first; tests that need either of those directly drive
// them instead of using this helper.
async function passConsentGate(page, options){
  var country = (options && options.country) || 'UK';
  await page.waitForSelector('#quizSkipLink');
  await page.click('#quizSkipLink');
  await page.waitForSelector('#docsGateContinue');
  await page.click('#docsGateContinue');
  // The country picker is a tappable list now, not a native <select> (see the "mockup 2b" comment
  // on .gate-country-list in index.html) -- #gateCountrySelect still exists and still drives the
  // real app logic, but it's visually hidden, so Playwright's selectOption() (which requires
  // visibility) can't target it directly. Click the matching list option instead, same as a real
  // applicant would.
  await page.waitForSelector('.gate-country-option[data-code="' + country + '"]');
  await page.click('.gate-country-option[data-code="' + country + '"]');
  await page.check('#gateAgree', { force: true });
  await page.click('#gateContinue');
  await page.waitForFunction(function(){
    var el = document.getElementById('appWrap');
    return el && el.style.display !== 'none';
  }, { timeout: 5000 });
}

// Jumps directly to a session by index — unlike the "Next →" button, this never triggers the soft
// "you're not done yet" confirm dialog. (Session pills themselves are always freely clickable now —
// see session-readiness-gate.test.js — but this is still the more deterministic route: it sidesteps
// any render-timing race from a real click, and lets tests jump straight to whatever they're testing
// without navigating through every earlier session first.) Calls the app's own
// window.__testGoToSession(idx) escape hatch, a direct setter meant only for this.
async function goToSessionByPill(page, idx){
  await page.evaluate(function(i){ window.__testGoToSession(i); }, idx);
}

// Jumps to a session by its display label (e.g. 'Validate your International Passport') instead of
// a hardcoded numeric index — added when 3 new sessions were prepended ahead of the existing ones,
// which shifted every previously-hardcoded index by +3. Index-based navigation is still fine for
// existing tests (all shifted in one pass), but new tests should prefer this where practical so a
// future reorder doesn't require another repo-wide shift.
async function goToSessionByLabel(page, label){
  var idx = await page.$$eval('.session-pill', function(pills, label){
    for (var i = 0; i < pills.length; i++){
      var title = pills[i].getAttribute('title') || '';
      if (title.indexOf(label) === 0) return i;
    }
    return -1;
  }, label);
  if (idx === -1) throw new Error('No session pill found with label "' + label + '"');
  await page.evaluate(function(i){ window.__testGoToSession(i); }, idx);
}

// Clicks one of the "Income & bank statement analysis" session's own internal step tabs (1 Upload,
// 2 Cash flow & scores, 3 Income sources breakdown, 4 Workplace income, 5 Report — see
// .fin-steps-nav in index.html). Needed any time a
// test interacts with an element that lives in a step other than whichever one is currently active,
// e.g. filling the cash-flow table directly (step 2) without first uploading a statement, or
// re-uploading a second statement after the first analysis auto-advanced away from step 1.
async function goToFinanceStep(page, n){
  await page.click('.fin-step-tab[data-fin-step="' + n + '"]');
  await page.waitForTimeout(50);
}

// Fills in one of the searchable "country" combobox fields (Travel Experience history table, or
// the overstay table) — types the country name to filter the list, then clicks the matching
// result, mirroring how a real user would use it. `containerId` is the tbody's id
// ('travelHistoryBody' or 'overstayBody'), `idx` is the row index, `countryName` must be one of
// the exact strings in TE_COUNTRY_LIST (the field won't accept anything else — see the CHANGELOG
// entry on why).
async function pickTravelCountry(page, containerId, idx, countryName){
  var inputSel = '#' + containerId + ' input[data-idx="' + idx + '"][data-field="country"]';
  await page.click(inputSel);
  await page.fill(inputSel, countryName);
  var optionSel = '#' + containerId + ' .country-combo-list[data-idx="' + idx + '"] .country-combo-option[data-value="' + countryName + '"]';
  await page.waitForSelector(optionSel, { timeout: 3000 });
  await page.click(optionSel);
}

module.exports = { startServer, launchBrowser, newPageAt, passConsentGate, goToSessionByPill, goToSessionByLabel, goToFinanceStep, pickTravelCountry, PORT, ROOT };
