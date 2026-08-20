'use strict';
// User feedback: "There is a high possibility that all these inflow from the same person might
// not carry the same [reason]. Why not ask the applicant if it carries the same narration or a
// different narration. If it is a different narration, allow the applicant to [set] the narration
// one after the other from the drop down menu." A recurring sender's box used to force ONE reason
// onto the whole group of payments — this adds an explicit "same reason for all / different
// reasons per payment" choice, defaulting to the existing single-reason behavior (so nothing
// changes unless the applicant opts in), and once "different" is picked, gives each individual
// payment its own reason dropdown (reusing the same inflowExplanations store, and category list,
// as every other per-payment reason in the app) instead of one blanket answer for all of them.
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
    await page.waitForSelector('#srcbox_2'); // "Mary Smith" — 3 payments, a family-type box needing a note

    // The "same / different" choice should default to "same" — unchanged existing behavior — and
    // the single group-level dropdown should still be the one showing, not per-payment ones.
    var modeValue = await page.$eval('#srcmode_2', function(el){ return el.value; });
    assert.strictEqual(modeValue, 'same', 'Should default to "same reason for all", got: ' + modeValue);
    var groupDropdownVisible = await page.$eval('#srccat_2', function(el){ return !!el; }).catch(function(){ return false; });
    assert.strictEqual(groupDropdownVisible, true, 'Group-level dropdown should still render by default');

    // Switching to "different reasons per payment" swaps in one dropdown per payment, and
    // auto-opens the "Show individual payment(s)" panel so they're immediately visible.
    await page.selectOption('#srcmode_2', 'different');
    await page.waitForSelector('#srctxcat_2_0');
    var panelOpen = await page.$eval('#srcpayments_2', function(el){ return el.open; });
    assert.strictEqual(panelOpen, true, 'Switching to "different" should auto-open the individual-payments panel');
    var perPaymentDropdownCount = await page.$$eval('[id^="srctxcat_2_"]', function(els){ return els.length; });
    assert.strictEqual(perPaymentDropdownCount, 3, 'Mary Smith has 3 payments, so 3 individual dropdowns should render, got: ' + perPaymentDropdownCount);
    var groupDropdownGone = await page.$('#srccat_2');
    assert.strictEqual(groupDropdownGone, null, 'The single group-level dropdown should be gone once in per-payment mode');

    // Answering only 2 of the 3 payments should NOT mark the box as fully explained yet.
    await page.selectOption('#srctxcat_2_0', 'gift');
    await page.selectOption('#srctxcat_2_1', 'rental_income');
    await page.waitForTimeout(700);
    var partialStatus = await page.$eval('#srcexplain_status_2', function(el){ return el.textContent; });
    assert.ok(/2 of 3/.test(partialStatus), 'Should show partial progress "2 of 3", got: ' + partialStatus);
    var boxExplainedPartial = await page.$eval('#srcbox_2', function(el){ return el.classList.contains('explained'); });
    assert.strictEqual(boxExplainedPartial, false, 'Box should not be marked explained with 1 of 3 payments still unset');

    // Answering the last one completes it, shows the "Saved" confirmation, and — since the panel is
    // still open — the box should wait to auto-collapse (same established pattern as the group-level
    // dropdown) until the applicant closes the panel themselves.
    await page.selectOption('#srctxcat_2_2', 'gift');
    await page.waitForTimeout(700);
    var fullStatus = await page.$eval('#srcexplain_status_2', function(el){ return el.textContent; });
    assert.ok(/Saved/.test(fullStatus), 'Should show "Saved" once all 3 payments are set, got: ' + fullStatus);
    await page.waitForTimeout(1600); // past the 1200ms auto-collapse delay
    var stillExpandedWhilePanelOpen = await page.$eval('#srcbox_2', function(el){ return !el.classList.contains('collapsed'); });
    assert.strictEqual(stillExpandedWhilePanelOpen, true, 'Should stay expanded while the payments panel is open, even once fully explained');

    await page.click('#srcpayments_2 summary'); // close the panel themselves
    await page.waitForFunction(function(){
      var box = document.getElementById('srcbox_2');
      return box && box.classList.contains('collapsed');
    }, { timeout: 3000 });
    var collapsedSummary = await page.$eval('#srcbox_2 .tx-line', function(el){ return el.textContent; });
    assert.ok(/3\/3 payments explained individually/.test(collapsedSummary), 'Collapsed summary should reflect per-payment mode, got: "' + collapsedSummary + '"');
  } finally {
    await page.context().close();
  }
};
