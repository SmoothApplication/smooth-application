'use strict';
// Regression test for the "form is fully filled but it is showing 0% filled" bug: the finance
// session's progress pill/header must update LIVE as fields are typed, not only after navigating
// away and back (computeFinancials() previously never called applySessionVisibility()).
const assert = require('assert');
const { newPageAt, passConsentGate, goToSessionByPill } = require('./helpers');

exports.run = async function(ctx){
  var page = await newPageAt(ctx.browser, '/index.html');
  try {
    await passConsentGate(page);
    await goToSessionByPill(page, 5); // 'finance' — the financial calculator, its own session again.

    var pctText = function(){
      return page.$eval('#sessionProgressPct', function(el){ return el.textContent; }).catch(function(){ return null; });
    };

    var before = await pctText();
    assert.ok(before === null || before.indexOf('0%') === 0, 'Financial readiness session should start at 0% filled, got: ' + before);

    // 'finance' (the calculator) needs exactly these 4 fields — see sessionProgress('finance').
    await page.fill('#fc_flight', '1020762');
    await page.fill('#fc_accom', '60000');
    await page.fill('#fc_transport', '150000');
    await page.fill('#fc_closing', '3000000');

    // No navigation away, no blur, no explicit save — the pill must reflect this immediately.
    await page.waitForFunction(function(){
      var el = document.getElementById('sessionProgressPct');
      return el && el.textContent.indexOf('100%') === 0;
    }, { timeout: 3000 });

    var after = await pctText();
    assert.ok(after.indexOf('100%') === 0, 'Financial readiness session should read 100% filled once the calculator\'s required fields are typed, got: ' + after);
  } finally {
    await page.context().close();
  }
};
