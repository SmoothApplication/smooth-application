'use strict';
// User request: "Create South Africa based on the link we have under travel history Session 2" →
// "create a proper form for it" → "A full South Africa onboarding page" — a dedicated screen shown
// only for South Africa applicants, between the consent gate and the checklist itself. Content is
// the same guide already written for South Africa under Travel Experience's "no history" country
// guides (TE_NO_HISTORY_GUIDES['South Africa'] — see renderZaOnboarding() in index.html), reused
// rather than duplicated. Every other country's flow is unaffected — this test also checks that.
const assert = require('assert');
const { newPageAt, passConsentGate } = require('./helpers');

exports.run = async function(ctx){
  var page = await newPageAt(ctx.browser, '/index.html');
  try {
    await page.waitForSelector('#quizIntro');
    await page.evaluate(function(){ window.__testSkipQuiz(); });
    await page.waitForSelector('#docsGateContinue');
    await page.click('#docsGateContinue');
    await page.waitForSelector('.gate-country-option[data-code="ZA"]');
    await page.click('.gate-country-option[data-code="ZA"]');
    await page.check('#gateAgree', { force: true });
    await page.click('#gateContinue');

    // South Africa should land on its own onboarding screen, NOT straight into the checklist.
    await page.waitForFunction(function(){
      var el = document.getElementById('zaOnboardingGate');
      return el && getComputedStyle(el).display !== 'none';
    }, { timeout: 5000 });
    var appWrapHidden = await page.$eval('#appWrap', function(el){ return el.style.display === 'none' || getComputedStyle(el).display === 'none'; });
    assert.strictEqual(appWrapHidden, true, 'The checklist should stay hidden until the South Africa onboarding screen is continued past');
    var consentHidden = await page.$eval('#consentGate', function(el){ return el.style.display === 'none'; });
    assert.strictEqual(consentHidden, true, 'Consent gate should be hidden once the South Africa onboarding screen shows');

    // Content is the real guide, not placeholder text.
    var onboardingText = await page.$eval('#zaOnboardingGate', function(el){ return el.textContent; });
    assert.ok(/Visa required \(VFS Global\)/.test(onboardingText), 'Should show South Africa\'s visa type, got: ' + onboardingText.slice(0, 300));
    assert.ok(/VFS Global/.test(onboardingText), 'Should mention VFS Global in the steps, got: ' + onboardingText.slice(0, 500));
    assert.ok(/Yellow Fever/.test(onboardingText), 'Should carry the real step content (Yellow Fever certificate), got: ' + onboardingText.slice(0, 800));
    var stepCount = await page.$$eval('.za-step', function(els){ return els.length; });
    assert.strictEqual(stepCount, 6, 'Should render all 6 steps from the South Africa guide, got ' + stepCount);
    var costText = await page.$eval('#zaOnboardingCost', function(el){ return el.textContent; });
    assert.ok(/Getting there:/.test(costText), 'Should show a flight cost estimate, got: ' + costText);
    assert.ok(/\$320/.test(costText), 'Should carry the real flight-fare figure, got: ' + costText);

    // Back goes to the consent gate, not the checklist.
    await page.click('#zaOnboardingBack');
    await page.waitForSelector('#consentGate', { state: 'visible' });
    var onboardingHiddenAfterBack = await page.$eval('#zaOnboardingGate', function(el){ return el.style.display === 'none'; });
    assert.strictEqual(onboardingHiddenAfterBack, true, 'Onboarding screen should be hidden after going back');

    // The country/agree choice wasn't touched by going back, so it should show as the confirmed
    // pick (not the tappable list) and Continue should work immediately, no re-picking needed.
    var confirmedVisibleAfterBack = await page.$eval('#gateCountryConfirmed', function(el){ return getComputedStyle(el).display !== 'none'; });
    assert.strictEqual(confirmedVisibleAfterBack, true, 'Going back should still show South Africa as the confirmed choice, not the picker list');

    // Continue into the checklist this time.
    await page.click('#gateContinue');
    await page.waitForFunction(function(){
      var el = document.getElementById('zaOnboardingGate');
      return el && getComputedStyle(el).display !== 'none';
    }, { timeout: 5000 });
    await page.click('#zaOnboardingContinue');
    await page.waitForFunction(function(){
      var el = document.getElementById('appWrap');
      return el && el.style.display !== 'none';
    }, { timeout: 5000 });
    var onboardingHiddenAfterContinue = await page.$eval('#zaOnboardingGate', function(el){ return el.style.display === 'none'; });
    assert.strictEqual(onboardingHiddenAfterContinue, true, 'Onboarding screen should be hidden once the checklist is showing');
  } finally {
    await page.context().close();
  }

  // Every other country should still skip straight to the checklist, unaffected.
  var page2 = await newPageAt(ctx.browser, '/index.html');
  try {
    await passConsentGate(page2, { country: 'UK' });
    var onboardingHiddenForUK = await page2.$eval('#zaOnboardingGate', function(el){ return el.style.display === 'none'; });
    assert.strictEqual(onboardingHiddenForUK, true, 'Non-South-Africa countries should never show the South Africa onboarding screen');
  } finally {
    await page2.context().close();
  }
};
