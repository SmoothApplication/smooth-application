'use strict';
// Founder idea: applicants who've already been refused, or already paid the fee and filled the
// form, need a different conversation than a fresh applicant. This is deliberately the LIGHTWEIGHT
// version of that idea (see the block comment above #situationGate in index.html for the fuller
// reasoning) - no refusal-letter OCR, no automated "matching", no agent inbox. It just asks the
// question, and for the two non-fresh answers, collects a few quick details and routes to the same
// no-backend WhatsApp/email pattern used everywhere else in this app (Document Review, resume
// reminders, feedback) - built entirely on-device, sent nowhere until the applicant themselves taps
// send. Covers: the gate appears after country selection and before the checklist, all three
// options, the refused/paid follow-up forms and their live WhatsApp/email hrefs, the "continue
// anyway" escape hatch, event tracking, and Back.
const assert = require('assert');
const { newPageAt } = require('./helpers');

async function reachSituationGate(page, country){
  await page.waitForSelector('#quizIntro');
  await page.evaluate(function(){ window.__testSkipQuiz(); });
  await page.waitForSelector('#docsGateContinue');
  await page.click('#docsGateContinue');
  await page.waitForSelector('.gate-country-option[data-code="' + country + '"]');
  await page.click('.gate-country-option[data-code="' + country + '"]');
  await page.check('#gateAgree', { force: true });
  await page.click('#gateContinue');
  if (country === 'ZA'){
    await page.waitForSelector('#zaOnboardingContinue', { state: 'visible' });
    await page.click('#zaOnboardingContinue');
  }
  await page.waitForSelector('#situationOptFresh', { state: 'visible' });
}

exports.run = async function(ctx){
  var page = await newPageAt(ctx.browser, '/index.html');
  try {
    await reachSituationGate(page, 'UK');

    // Stub analytics so situation_* events can be observed (same pattern as the other event-tracking
    // tests in this suite — trackEvent() only ever fires window.goatcounter.count() when it's set).
    await page.evaluate(function(){
      window.__trackedEvents = [];
      window.goatcounter = { count: function(o){ window.__trackedEvents.push(o.path); } };
    });

    // Nothing selected yet: no follow-up, no continue button, appWrap still hidden.
    var refusedVisible0 = await page.$eval('#situationRefusedFollowup', function(el){ return getComputedStyle(el).display !== 'none'; });
    var paidVisible0 = await page.$eval('#situationPaidFollowup', function(el){ return getComputedStyle(el).display !== 'none'; });
    var continueVisible0 = await page.$eval('#situationContinue', function(el){ return getComputedStyle(el).display !== 'none'; });
    assert.strictEqual(refusedVisible0, false, 'Refused follow-up should be hidden before any option is picked');
    assert.strictEqual(paidVisible0, false, 'Paid follow-up should be hidden before any option is picked');
    assert.strictEqual(continueVisible0, false, 'Continue button should be hidden before any option is picked');
    var appWrapHidden0 = await page.$eval('#appWrap', function(el){ return el.style.display === 'none'; });
    assert.strictEqual(appWrapHidden0, true, 'Checklist should stay hidden until the situation gate is continued past');

    // Picking "refused" reveals its follow-up, hides the "paid" one, and marks the option selected.
    await page.click('#situationOptRefused');
    var refusedVisible = await page.$eval('#situationRefusedFollowup', function(el){ return getComputedStyle(el).display !== 'none'; });
    var paidVisible = await page.$eval('#situationPaidFollowup', function(el){ return getComputedStyle(el).display !== 'none'; });
    assert.strictEqual(refusedVisible, true, 'Refused follow-up should show once that option is picked');
    assert.strictEqual(paidVisible, false, 'Paid follow-up should stay hidden while "refused" is picked');
    var refusedSelected = await page.$eval('#situationOptRefused', function(el){ return el.classList.contains('selected') && el.getAttribute('aria-checked') === 'true'; });
    assert.strictEqual(refusedSelected, true, 'Refused option should show as selected');
    var continueTextRefused = await page.$eval('#situationContinue', function(el){ return el.textContent; });
    assert.ok(/anyway/i.test(continueTextRefused), 'Continue button should read as an "anyway" escape hatch once a non-fresh option is picked, got: ' + continueTextRefused);

    // Filling in the refused follow-up should build a live WhatsApp/email draft with that context,
    // entirely client-side.
    await page.selectOption('#situationRefusedCountry', 'UK');
    await page.selectOption('#situationRefusedCount', '2');
    await page.fill('#situationRefusedReason', 'Not satisfied you were a genuine visitor');
    await page.fill('#situationRefusedBalance', '450000');
    await page.waitForFunction(function(){
      var href = document.getElementById('situationRefusedWhatsApp').getAttribute('href');
      return href && /^https:\/\/wa\.me\/2349081389969\?text=/.test(href) && decodeURIComponent(href).indexOf('Refused by: UK') !== -1;
    }, { timeout: 3000 });
    var waHref = await page.$eval('#situationRefusedWhatsApp', function(el){ return el.getAttribute('href'); });
    var waMsg = decodeURIComponent(waHref.split('?text=')[1]);
    assert.ok(/Refused by: UK/.test(waMsg), 'Message should include the refusing country, got: ' + waMsg);
    assert.ok(/Number of times refused: 2/.test(waMsg), 'Message should include the refusal count, got: ' + waMsg);
    assert.ok(/Not satisfied you were a genuine visitor/.test(waMsg), 'Message should include the typed reason, got: ' + waMsg);
    assert.ok(/450000/.test(waMsg), 'Message should include the typed balance, got: ' + waMsg);
    var emailHref = await page.$eval('#situationRefusedEmail', function(el){ return el.getAttribute('href'); });
    assert.ok(/^mailto:lalasionline@gmail\.com\?subject=/.test(emailHref), 'Email fallback should point at the team inbox, got: ' + emailHref);

    // Switching to "paid" hides the refused follow-up and shows its own, pre-filled with the
    // current country and the existing Document Review offer - not a second, separate mechanism.
    await page.click('#situationOptPaid');
    var refusedVisibleAfterSwitch = await page.$eval('#situationRefusedFollowup', function(el){ return getComputedStyle(el).display !== 'none'; });
    var paidVisibleAfterSwitch = await page.$eval('#situationPaidFollowup', function(el){ return getComputedStyle(el).display !== 'none'; });
    assert.strictEqual(refusedVisibleAfterSwitch, false, 'Refused follow-up should hide once "paid" is picked instead');
    assert.strictEqual(paidVisibleAfterSwitch, true, 'Paid follow-up should show once that option is picked');
    var paidWaHref = await page.$eval('#situationPaidWhatsApp', function(el){ return el.getAttribute('href'); });
    var paidMsg = decodeURIComponent(paidWaHref.split('?text=')[1]);
    assert.ok(/United Kingdom/.test(paidMsg), 'Paid-follow-up message should name the current country, got: ' + paidMsg);
    assert.ok(/\$25/.test(paidMsg), 'Paid-follow-up message should mention the Document Review price, got: ' + paidMsg);

    // Clicking through (without sending a message) should still land on the real checklist - a
    // refusal/review question is never a dead end.
    await page.evaluate(function(){
      document.getElementById('situationPaidWhatsApp').dispatchEvent(new MouseEvent('click', {bubbles:true, cancelable:true}));
    });
    await page.click('#situationContinue');
    await page.waitForFunction(function(){
      var el = document.getElementById('appWrap');
      return el && el.style.display !== 'none';
    }, { timeout: 5000 });
    var situationGateHiddenAfter = await page.$eval('#situationGate', function(el){ return el.style.display === 'none'; });
    assert.strictEqual(situationGateHiddenAfter, true, 'Situation gate should be hidden once the checklist is showing');

    var tracked = await page.evaluate(function(){ return window.__trackedEvents.slice(); });
    assert.ok(tracked.indexOf('situation_selected:refused') !== -1, 'Should track picking "refused", got: ' + JSON.stringify(tracked));
    assert.ok(tracked.indexOf('situation_selected:paid') !== -1, 'Should track switching to "paid", got: ' + JSON.stringify(tracked));
    assert.ok(tracked.indexOf('situation_paid_contact:whatsapp') !== -1, 'Should track the paid-follow-up WhatsApp click, got: ' + JSON.stringify(tracked));
    assert.ok(tracked.indexOf('situation_continue_clicked') !== -1, 'Should track continuing into the checklist, got: ' + JSON.stringify(tracked));
  } finally {
    await page.context().close();
  }

  // Back goes to the consent gate (non-South-Africa), not the checklist, and picking "fresh"
  // skips straight through with no follow-up form at all.
  var page2 = await newPageAt(ctx.browser, '/index.html');
  try {
    await reachSituationGate(page2, 'UK');
    await page2.click('#situationBack');
    await page2.waitForSelector('#consentGate', { state: 'visible' });
    var situationHiddenAfterBack = await page2.$eval('#situationGate', function(el){ return el.style.display === 'none'; });
    assert.strictEqual(situationHiddenAfterBack, true, 'Situation gate should be hidden after going back');

    await page2.click('#gateContinue');
    await page2.waitForSelector('#situationOptFresh', { state: 'visible' });
    await page2.click('#situationOptFresh');
    var freshContinueText = await page2.$eval('#situationContinue', function(el){ return el.textContent; });
    assert.ok(!/anyway/i.test(freshContinueText), 'Continue button should read as the normal forward action for "fresh", got: ' + freshContinueText);
    await page2.click('#situationContinue');
    await page2.waitForFunction(function(){
      var el = document.getElementById('appWrap');
      return el && el.style.display !== 'none';
    }, { timeout: 5000 });
  } finally {
    await page2.context().close();
  }

  // South Africa: the situation gate comes after its own onboarding screen, and Back returns there.
  var page3 = await newPageAt(ctx.browser, '/index.html');
  try {
    await reachSituationGate(page3, 'ZA');
    await page3.click('#situationBack');
    await page3.waitForSelector('#zaOnboardingGate', { state: 'visible' });
  } finally {
    await page3.context().close();
  }
};
