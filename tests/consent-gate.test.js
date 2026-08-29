'use strict';
const assert = require('assert');
const { newPageAt } = require('./helpers');

exports.run = async function(ctx){
  var page = await newPageAt(ctx.browser, '/index.html');
  try {
    // The confidence quiz and the "two documents" page are now shown first — skip through both to
    // reach the consent gate this test actually exercises (see confidence-quiz.test.js and
    // docs-gate.test.js for their own behavior).
    await page.waitForSelector('#quizSkipLink');
    await page.click('#quizSkipLink');
    await page.waitForSelector('#docsGateContinue');
    await page.click('#docsGateContinue');
    await page.waitForSelector('#gateCountrySelect');

    // Continue must start disabled — no country picked, disclaimer not agreed to.
    var initiallyDisabled = await page.$eval('#gateContinue', function(el){ return el.disabled; });
    assert.strictEqual(initiallyDisabled, true, 'Continue button should start disabled');

    await page.selectOption('#gateCountrySelect', 'UK');
    var stillDisabledBeforeAgree = await page.$eval('#gateContinue', function(el){ return el.disabled; });
    assert.strictEqual(stillDisabledBeforeAgree, true, 'Continue should stay disabled until the disclaimer checkbox is ticked');

    await page.check('#gateAgree', { force: true });
    var enabledAfterAgree = await page.$eval('#gateContinue', function(el){ return !el.disabled; });
    assert.strictEqual(enabledAfterAgree, true, 'Continue should enable once a valid country is picked and the disclaimer is agreed to');

    await page.click('#gateContinue');
    await page.waitForFunction(function(){
      var el = document.getElementById('appWrap');
      return el && el.style.display !== 'none';
    }, { timeout: 5000 });

    var gateHidden = await page.$eval('#consentGate', function(el){ return el.style.display === 'none'; });
    assert.strictEqual(gateHidden, true, 'Consent gate should be hidden after continuing');

    var appVisible = await page.$eval('#appWrap', function(el){ return el.style.display !== 'none'; });
    assert.strictEqual(appVisible, true, 'App content should be visible after continuing');
  } finally {
    await page.context().close();
  }
};
