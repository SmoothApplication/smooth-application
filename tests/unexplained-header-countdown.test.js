'use strict';
// User feedback, off the live "7 inflow(s) need an explanation" banner: "as I start filling each let
// the number 7 reduce until I fill the last one, then it tells me done or success." The headline number
// used to stay fixed at the original total forever, with only a small "(3 of 7 explained so far)" note
// tacked on — it never actually counted down, and there was no distinct success state once every inflow
// was explained. This locks in: the headline now counts the REMAINING unexplained inflows down to zero,
// live as each is filled in, and switches to a green "All N inflow(s) explained" success message (with
// the banner itself flipping from warn/orange to ok/green) the moment none are left.
const assert = require('assert');
const path = require('path');
const { newPageAt, passConsentGate, goToSessionByPill } = require('./helpers');

var FIXTURE = path.join(__dirname, 'fixtures', 'multi-unexplained-inflows.pdf');

exports.run = async function(ctx){
  var page = await newPageAt(ctx.browser, '/index.html');
  try {
    await passConsentGate(page);
    await goToSessionByPill(page, 4); // finance2 = Income & bank statement analysis

    await page.setInputFiles('#stmtFile1', FIXTURE);
    await page.click('#btnAnalyzeStatements');
    await page.waitForSelector('#unexplainedInflowsBox .explain-box', { timeout: 20000 });
    await page.waitForTimeout(300);

    var boxCount = await page.$$eval('#unexplainedInflowsBox .explain-box', function(els){ return els.length; });
    assert.strictEqual(boxCount, 3, 'Fixture should produce exactly 3 flagged inflows, got: ' + boxCount);

    var headerInitial = await page.$eval('#unexplainedHeaderMsg', function(el){ return el.textContent; });
    assert.ok(/^3 inflows still need an explanation/.test(headerInitial), 'Should start at "3 inflows still need an explanation", got: "' + headerInitial + '"');
    var initialCls = await page.$eval('#unexplainedHeaderMsg', function(el){ return el.className; });
    assert.ok(/\bwarn\b/.test(initialCls), 'Banner should start in the warn (orange) state, got class: ' + initialCls);

    // Fill in the first one — the headline should count DOWN to 2, not stay at 3.
    await page.selectOption('#explain_cat_0', 'gift');
    await page.waitForFunction(function(){
      var el = document.getElementById('unexplainedHeaderMsg');
      return el && /^2 inflows still need an explanation/.test(el.textContent);
    }, { timeout: 3000 });
    var headerAfterOne = await page.$eval('#unexplainedHeaderMsg', function(el){ return el.textContent; });
    assert.ok(/\(1 of 3 already explained\)/.test(headerAfterOne), 'Should show the running explained count too, got: "' + headerAfterOne + '"');

    // Fill in the second — down to 1, singular grammar ("1 inflow still needs").
    await page.selectOption('#explain_cat_1', 'family');
    await page.waitForFunction(function(){
      var el = document.getElementById('unexplainedHeaderMsg');
      return el && /^1 inflow still needs an explanation/.test(el.textContent);
    }, { timeout: 3000 });

    // Fill in the last one — should flip to a distinct success message and turn green (ok), not just
    // read "0 inflows need an explanation".
    await page.selectOption('#explain_cat_2', 'business');
    await page.waitForFunction(function(){
      var el = document.getElementById('unexplainedHeaderMsg');
      return el && /All 3 inflow\(s\) explained/.test(el.textContent);
    }, { timeout: 3000 });
    var finalCls = await page.$eval('#unexplainedHeaderMsg', function(el){ return el.className; });
    assert.ok(/\bok\b/.test(finalCls), 'Banner should switch to the ok (green) state once all are explained, got class: ' + finalCls);
    assert.ok(!/\bwarn\b/.test(finalCls), 'Banner should no longer carry the warn class once all are explained, got class: ' + finalCls);
  } finally {
    await page.context().close();
  }
};
