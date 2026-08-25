'use strict';
// New feature request: "A place to upload your letter of rejection, the system scans it,
// summarize it and [suggest a] proper best solution based on letter." The upload/scan mechanism
// itself (the 'refusalDocs' checklist item, checkKind:'refusalLetter') already existed — this test
// covers the accuracy/usefulness upgrade that came out of researching real UK Home Office (Appendix
// V / paragraph V 4.2) and Canada IRCC (paragraph 179(b) IRPR standard checkbox letter) refusal
// wording: which authority a letter is FROM is detected from its own text (not assumed from the
// country currently selected — a letter can be from "this country or any other", per the app's own
// wording), a misrepresentation/deception finding is called out separately from routine document
// issues (different stakes, no DIY "jump and fix it" link offered), and each detected reason links
// straight to the relevant session in this checklist.
//
// Fixtures (tests/fixtures/refusal-*.pdf) are synthetic letters built from real researched wording,
// not real applicant letters — see CHANGELOG for sources.
const assert = require('assert');
const path = require('path');
const { newPageAt, passConsentGate, goToSessionByPill, goToSessionByLabel } = require('./helpers');

var UK_FIXTURE = path.join(__dirname, 'fixtures', 'refusal-uk-genuine-visitor-financial-ties.pdf');
var CA_FIXTURE = path.join(__dirname, 'fixtures', 'refusal-ca-179b-checklist.pdf');
var MISREP_FIXTURE = path.join(__dirname, 'fixtures', 'refusal-misrepresentation-finding.pdf');
var NO_MATCH_FIXTURE = path.join(__dirname, 'fixtures', 'refusal-no-match-generic-letter.pdf');

// Ticks "I've been refused a visa..." (which is what makes the "Visa history" session/category
// exist at all — see appliesIf on the refusalDocs checklist item) and navigates to it.
async function openRefusalSession(page){
  await goToSessionByLabel(page, 'Identity & application');
  await page.check('#f_hasRefusal', { force: true });
  await page.waitForTimeout(200);
  await goToSessionByLabel(page, 'Visa history');
  await page.waitForSelector('#file_refusalDocs');
}

async function scanAndReadResult(page, fixturePath){
  await page.setInputFiles('#file_refusalDocs', fixturePath);
  await page.click('#scan_refusalDocs');
  await page.waitForFunction(function(){
    var el = document.getElementById('scanmsg_refusalDocs');
    return el && el.textContent.trim().length > 0 && el.textContent.indexOf('Loading local scanning tools') === -1;
  }, { timeout: 20000 });
  await page.waitForTimeout(300);
  return page.$eval('#scanmsg_refusalDocs', function(el){ return el.innerHTML; });
}

exports.run = async function(ctx){
  // --- UK letter: genuine-visitor + financial + ties wording, plus a working jump link ------------
  var page = await newPageAt(ctx.browser, '/index.html');
  try {
    await passConsentGate(page, { country: 'UK' });
    await openRefusalSession(page);
    var ukHtml = await scanAndReadResult(page, UK_FIXTURE);

    assert.ok(/UK Home Office refusal letter/i.test(ukHtml), 'Should identify this as a UK letter from its own wording, got: ' + ukHtml.slice(0, 400));
    assert.ok(/Financial readiness/.test(ukHtml), 'Should detect the financial/maintenance reason, got: ' + ukHtml.slice(0, 1200));
    assert.ok(/Genuine visitor/.test(ukHtml), 'Should detect the genuine-visitor reason, got: ' + ukHtml.slice(0, 1200));
    assert.ok(/Ties to home country/.test(ukHtml), 'Should detect the ties-to-home reason, got: ' + ukHtml.slice(0, 1200));
    assert.ok(!/misrepresentation/i.test(ukHtml), 'A routine refusal should NOT trigger the misrepresentation warning, got: ' + ukHtml.slice(0, 1200));

    // Each matched category should offer a jump button targeting the right session. (Reaching
    // "Visa history" at all already means every EARLIER session cleared the 70%-readiness gate — see
    // computeLockAfterIndex() in index.html — so in real use these earlier-session jump targets are
    // never actually blocked; session-readiness-gate.test.js covers that clamping behavior on its
    // own, so this test just confirms each button targets the right key.)
    var jumpKeys = await page.$$eval('.refusal-jump-btn', function(els){ return els.map(function(e){ return e.getAttribute('data-jump-key'); }); });
    assert.ok(jumpKeys.indexOf('finance2') !== -1, 'Financial reason should link to the finance2 session, got: ' + JSON.stringify(jumpKeys));
    assert.ok(jumpKeys.indexOf('responsibilities') !== -1, 'Ties-to-home reason should link to the responsibilities session, got: ' + JSON.stringify(jumpKeys));
    assert.ok(jumpKeys.indexOf('trip') !== -1, 'Genuine-visitor reason should link to the trip session, got: ' + JSON.stringify(jumpKeys));

    // The click handler itself (data-jump-key -> getVisibleSessionKeys().indexOf() -> goToSession())
    // is real wiring worth exercising once, on a target that's genuinely never gated: 'passport' is
    // always index 0, so it's never past the lock boundary no matter how little else is filled in.
    // (Repointing an existing button's data-jump-key rather than fabricating a new element — this is
    // exercising the click handler's own key -> session lookup, not the category-matching logic,
    // which the assertions above already covered.)
    await page.evaluate(function(){
      window.__trackedEvents = [];
      window.goatcounter = { count: function(o){ window.__trackedEvents.push(o.path); } };
      var el = document.querySelector('.refusal-jump-btn[data-jump-key="finance2"]');
      el.setAttribute('data-jump-key', 'passport');
    });
    await page.click('.refusal-jump-btn[data-jump-key="passport"]');
    await page.waitForTimeout(200);
    var nowLabel = await page.$eval('.session-pill.active', function(el){ return el.getAttribute('title'); });
    assert.ok(/^Validate your International Passport/.test(nowLabel), 'Clicking a jump button should navigate to the session named in its data-jump-key, got: ' + nowLabel);
    var tracked = await page.evaluate(function(){ return window.__trackedEvents; });
    assert.ok(tracked.indexOf('refusal_jump_clicked:passport') !== -1, 'Clicking a jump button should record a refusal_jump_clicked event, got: ' + JSON.stringify(tracked));
  } finally {
    await page.context().close();
  }

  // --- Canada letter: IRCC-specific reasons (employment, travel history) + authority detection ----
  var page2 = await newPageAt(ctx.browser, '/index.html');
  try {
    await passConsentGate(page2, { country: 'CA' });
    await openRefusalSession(page2);
    var caHtml = await scanAndReadResult(page2, CA_FIXTURE);

    assert.ok(/Canada \(IRCC\) refusal letter/i.test(caHtml), 'Should identify this as a Canada/IRCC letter from its own wording, got: ' + caHtml.slice(0, 400));
    assert.ok(/Genuine intention to leave Canada/.test(caHtml), 'Should use the Canada-flavored label for the genuine-intention reason, got: ' + caHtml.slice(0, 1200));
    assert.ok(/Employment \/ income stability/.test(caHtml), 'Should detect the IRCC-specific employment-situation reason, got: ' + caHtml.slice(0, 1200));
    assert.ok(/Travel history/.test(caHtml), 'Should detect the IRCC-specific travel-history reason, got: ' + caHtml.slice(0, 1200));
    assert.ok(/Financial readiness/.test(caHtml), 'Should also detect the financial/funds reason, got: ' + caHtml.slice(0, 1200));
  } finally {
    await page2.context().close();
  }

  // --- Misrepresentation finding: distinct, serious warning, kept separate from routine issues ----
  var page3 = await newPageAt(ctx.browser, '/index.html');
  try {
    await passConsentGate(page3, { country: 'UK' });
    await openRefusalSession(page3);
    var misrepHtml = await scanAndReadResult(page3, MISREP_FIXTURE);

    assert.ok(/scan-msg err/.test(misrepHtml), 'A misrepresentation finding should render with the critical (err) style, got: ' + misrepHtml.slice(0, 600));
    assert.ok(/misrepresentation, deception, or document-authenticity finding/i.test(misrepHtml), 'Should name the misrepresentation finding explicitly, got: ' + misrepHtml.slice(0, 600));
    assert.ok(/regulated immigration adviser/i.test(misrepHtml), 'Should point to a regulated adviser rather than DIY advice for this finding, got: ' + misrepHtml.slice(0, 800));
  } finally {
    await page3.context().close();
  }

  // --- No recognizable refusal wording at all: stays honest about the miss, no false positives ----
  var page4 = await newPageAt(ctx.browser, '/index.html');
  try {
    await passConsentGate(page4, { country: 'UK' });
    await openRefusalSession(page4);
    var noMatchHtml = await scanAndReadResult(page4, NO_MATCH_FIXTURE);

    assert.ok(/Couldn't automatically match/.test(noMatchHtml), 'A letter with no matching wording should say so plainly, got: ' + noMatchHtml.slice(0, 600));
    assert.ok(!/scan-msg warn/.test(noMatchHtml), 'Should not show any warn-level category matches for unrelated text, got: ' + noMatchHtml.slice(0, 600));
  } finally {
    await page4.context().close();
  }
};
