'use strict';
// User feedback: "Once I edit the menu does close up back" (with a screenshot showing an income-source
// explanation box with "Show individual payment(s)" open, a "Gift" relationship dropdown selected, and
// a "✓ Saved" confirmation showing). Root cause: the whole box's "save & tidy away" behaviour (collapse
// to a one-line summary ~1.2s after a successful save) rebuilds the box's entire innerHTML regardless
// of whether the applicant currently has the "Show individual payment(s)" detail panel open reviewing
// the specific transactions behind their choice — yanking that context away right after they'd picked
// a reason, and resetting the panel back to closed.
//
// Fix: the auto-collapse now checks whether that detail panel is open first. If it is, the box stays
// expanded (deferring the tidy-away) until the applicant closes the panel themselves, at which point
// it collapses as normal. If the panel isn't open (the common case), behaviour is unchanged.
const assert = require('assert');
const path = require('path');
const { newPageAt, passConsentGate, goToSessionByPill, goToFinanceStep } = require('./helpers');

var FIXTURE = path.join(__dirname, 'fixtures', 'consistent-senders-fixture.pdf');

exports.run = async function(ctx){
  var page = await newPageAt(ctx.browser, '/index.html');
  try {
    await passConsentGate(page);
    await goToSessionByPill(page, 3);
    await page.fill('#f_name', 'Test Applicant Smith');
    await page.selectOption('#f_workStatus', 'employed');
    await page.fill('#f_employerName', 'Good Employer Ltd');

    await goToSessionByPill(page, 4);
    await goToFinanceStep(page, 1);
    await page.setInputFiles('#stmtFile1', FIXTURE);
    await page.click('#btnAnalyzeStatements');
    await page.waitForFunction(function(){
      var el = document.getElementById('stmtAnalyzeMsg');
      return el && /Detected \d+ transaction/.test(el.textContent);
    }, { timeout: 20000 });
    await page.waitForTimeout(300);

    await goToFinanceStep(page, 4);
    await page.waitForSelector('#srcbox_2'); // "Mary Smith" — a family-type box needing a note

    // Scenario A: payments panel left CLOSED — the existing "save & tidy away" behaviour is unchanged,
    // the box should still auto-collapse a beat after saving.
    await page.selectOption('#srccat_1', 'business'); // "John Doe Ventures" box
    await page.waitForFunction(function(){
      var box = document.getElementById('srcbox_1');
      return box && box.classList.contains('collapsed');
    }, { timeout: 3000 });

    // Scenario B: payments panel OPEN when a reason is picked — the box must NOT collapse out from
    // under the applicant while they're reviewing the individual payments.
    await page.click('#srcpayments_2 summary');
    await page.waitForFunction(function(){
      var d = document.getElementById('srcpayments_2');
      return d && d.open;
    }, { timeout: 3000 });
    await page.selectOption('#srccat_2', 'gift');
    // Give the debounced save (500ms) plenty of time to complete, and well past the old unconditional
    // 1200ms auto-collapse delay, to prove it's genuinely being held back rather than just running slow.
    await page.waitForTimeout(2200);
    var stillExpanded = await page.$eval('#srcbox_2', function(el){ return !el.classList.contains('collapsed'); });
    assert.strictEqual(stillExpanded, true,
      'Box should stay expanded while "Show individual payment(s)" is open, even well past the normal auto-collapse delay');
    var savedShown = await page.$eval('#srcexplain_status_2', function(el){ return /Saved/.test(el.textContent); });
    assert.strictEqual(savedShown, true, 'Should still show the "Saved" confirmation while waiting to collapse');
    var panelStillOpen = await page.$eval('#srcpayments_2', function(el){ return el.open; });
    assert.strictEqual(panelStillOpen, true, 'The individual-payments panel itself should not have been reset/closed underneath the applicant');

    // Now the applicant closes the payments panel themselves — the box should tidy away shortly after.
    await page.click('#srcpayments_2 summary');
    await page.waitForFunction(function(){
      var box = document.getElementById('srcbox_2');
      return box && box.classList.contains('collapsed');
    }, { timeout: 3000 });
    var collapsedSummary = await page.$eval('#srcbox_2 .tx-line', function(el){ return el.textContent; });
    assert.ok(/Gift/i.test(collapsedSummary), 'Collapsed summary should reflect the saved "Gift" choice, got: "' + collapsedSummary + '"');
  } finally {
    await page.context().close();
  }
};
