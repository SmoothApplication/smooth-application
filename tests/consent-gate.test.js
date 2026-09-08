'use strict';
const assert = require('assert');
const { newPageAt } = require('./helpers');

exports.run = async function(ctx){
  var page = await newPageAt(ctx.browser, '/index.html');
  try {
    // The confidence quiz and the "two documents" page are now shown first — skip through both to
    // reach the consent gate this test actually exercises (see confidence-quiz.test.js and
    // docs-gate.test.js for their own behavior). The quiz's real "Skip" button was removed (field
    // feedback) — window.__testSkipQuiz() is the test-only escape hatch left in its place.
    await page.waitForSelector('#quizIntro');
    await page.evaluate(function(){ window.__testSkipQuiz(); });
    await page.waitForSelector('#docsGateContinue');
    await page.click('#docsGateContinue');
    // The country picker is a tappable list now, not a native <select> — see the "mockup 2b" comment
    // on .gate-country-list in index.html. #gateCountrySelect still exists and drives the real app
    // logic, but it's visually hidden, so waitForSelector's default visible-state check (and
    // selectOption(), which also requires visibility) can't target it — wait for the visible tappable
    // option instead, same as passConsentGate() in helpers.js does.
    await page.waitForSelector('.gate-country-option[data-code="UK"]');

    // Continue must start disabled — no country picked, disclaimer not agreed to.
    var initiallyDisabled = await page.$eval('#gateContinue', function(el){ return el.disabled; });
    assert.strictEqual(initiallyDisabled, true, 'Continue button should start disabled');

    await page.click('.gate-country-option[data-code="UK"]');
    var stillDisabledBeforeAgree = await page.$eval('#gateContinue', function(el){ return el.disabled; });
    assert.strictEqual(stillDisabledBeforeAgree, true, 'Continue should stay disabled until the disclaimer checkbox is ticked');

    await page.check('#gateAgree', { force: true });
    var enabledAfterAgree = await page.$eval('#gateContinue', function(el){ return !el.disabled; });
    assert.strictEqual(enabledAfterAgree, true, 'Continue should enable once a valid country is picked and the disclaimer is agreed to');

    await page.click('#gateContinue');

    var gateHidden = await page.$eval('#consentGate', function(el){ return el.style.display === 'none'; });
    assert.strictEqual(gateHidden, true, 'Consent gate should be hidden after continuing');

    // One more screen now sits between country selection and the checklist — "Where are you in the
    // process?" (see #situationGate in index.html) — before appWrap shows.
    await page.waitForSelector('#situationOptFresh', { state: 'visible' });
    await page.click('#situationOptFresh');
    await page.click('#situationContinue');
    await page.waitForFunction(function(){
      var el = document.getElementById('appWrap');
      return el && el.style.display !== 'none';
    }, { timeout: 5000 });

    var appVisible = await page.$eval('#appWrap', function(el){ return el.style.display !== 'none'; });
    assert.strictEqual(appVisible, true, 'App content should be visible after continuing');
  } finally {
    await page.context().close();
  }
};
