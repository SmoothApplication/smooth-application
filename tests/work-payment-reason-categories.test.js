'use strict';
// User feedback, off a real manual extraction of every inflow from a declared employer ("Crisp N Clean
// Exclusive Solutions Ltd"): several of the genuine matched inflows carry a narration that never states
// a specific reason at all — just "…TRANSFER TO <applicant> FROM <employer>…", no "Salary"/"Allowance"/
// etc. For those specifically, offer a narrower Salary/Allowance-type dropdown
// (WORK_PAYMENT_REASON_CATEGORIES) instead of the general reason list, since the sender is already
// confirmed as the declared employer — "Family"/"Gift"/"Business" etc. don't apply, what's unclear is
// which TYPE of employment payment this one was. A matched inflow whose own narration DOES already state
// a reason (e.g. "February Salary"), and any inflow matched to a declared BUSINESS rather than an
// employer, should both keep the general list.
const assert = require('assert');
const path = require('path');
const { newPageAt, passConsentGate, goToSessionByPill } = require('./helpers');

var FIXTURE = path.join(__dirname, 'fixtures', 'work-payment-reason-fixture.pdf');

exports.run = async function(ctx){
  // --- Employer match: one txn has an explicit reason, one doesn't -------------------------------
  var page = await newPageAt(ctx.browser, '/index.html');
  try {
    await passConsentGate(page);
    await page.fill('#f_name', 'Test Applicant');
    await goToSessionByPill(page, 0);
    await page.selectOption('#f_workStatus', 'employed');
    await page.fill('#f_employerName', 'Crisp N Clean Exclusive Solutions Ltd');

    await goToSessionByPill(page, 1);
    await page.setInputFiles('#stmtFile1', FIXTURE);
    await page.click('#btnAnalyzeStatements');
    await page.waitForFunction(function(){
      var el = document.getElementById('stmtAnalyzeMsg');
      return el && /Detected \d+ transaction/.test(el.textContent);
    }, { timeout: 20000 });
    await page.waitForTimeout(400);

    // Both matched inflows are auto-tagged "Salary" on first sight, so their boxes start collapsed —
    // expand both to inspect their dropdowns.
    await page.click('#matchcollapsed_0');
    await page.click('#matchcollapsed_1');
    await page.waitForSelector('#match_cat_0');
    await page.waitForSelector('#match_cat_1');
    var boxes = await page.$$eval('#matchedIncomeInflowsBox select[id^="match_cat_"]', function(sels){
      return sels.map(function(sel){ return Array.from(sel.options).map(function(o){ return o.value; }); });
    });
    assert.strictEqual(boxes.length, 2, 'Expected 2 matched-inflow dropdowns, got: ' + JSON.stringify(boxes));

    // The "February Salary" txn already states a specific reason -> general list (has "family"/"business").
    var generalListBox = boxes.filter(function(opts){ return opts.indexOf('business') !== -1; })[0];
    assert.ok(generalListBox, 'The txn with an explicit narration reason should keep the general reason list, got: ' + JSON.stringify(boxes));

    // The boilerplate "TRANSFER TO ... FROM ..." txn has no specific reason -> narrower work-payment list
    // (has "transport_allowance"/"housing_allowance", no "family"/"business"/"gift").
    var workListBox = boxes.filter(function(opts){ return opts.indexOf('transport_allowance') !== -1; })[0];
    assert.ok(workListBox, 'The txn with no specific narration reason should offer the narrower work-payment-type list, got: ' + JSON.stringify(boxes));
    assert.ok(workListBox.indexOf('family') === -1 && workListBox.indexOf('business') === -1 && workListBox.indexOf('gift') === -1,
      'The narrower work-payment list should not include Family/Business/Gift, got: ' + JSON.stringify(workListBox));
    ['housing_allowance','car_allowance','fuel_allowance','wardrobe_allowance','subsidy_allowance','13th_month_allowance','medical_allowance'].forEach(function(v){
      assert.ok(workListBox.indexOf(v) !== -1, 'Narrower work-payment list missing expected option "'+v+'", got: ' + JSON.stringify(workListBox));
    });

    // Its prompt text should reflect the narrower framing.
    var promptTexts = await page.$$eval('#matchedIncomeInflowsBox .item-tip', function(els){ return els.map(function(e){ return e.textContent; }); });
    assert.ok(promptTexts.some(function(t){ return /doesn't spell out a specific reason/.test(t); }),
      'Expected the narrower work-payment prompt text to appear, got: ' + JSON.stringify(promptTexts));
  } finally {
    await page.context().close();
  }

  // --- Business match: even the boilerplate no-reason txn keeps the GENERAL list, not the work list ---
  var page2 = await newPageAt(ctx.browser, '/index.html');
  try {
    await passConsentGate(page2);
    await page2.fill('#f_name', 'Test Applicant');
    await goToSessionByPill(page2, 0);
    await page2.selectOption('#f_workStatus', 'selfEmployed');
    await page2.fill('#f_businessName', 'Crisp N Clean Exclusive Solutions Ltd');

    await goToSessionByPill(page2, 1);
    await page2.setInputFiles('#stmtFile1', FIXTURE);
    await page2.click('#btnAnalyzeStatements');
    await page2.waitForFunction(function(){
      var el = document.getElementById('stmtAnalyzeMsg');
      return el && /Detected \d+ transaction/.test(el.textContent);
    }, { timeout: 20000 });
    await page2.waitForTimeout(400);

    await page2.click('#matchcollapsed_0');
    await page2.click('#matchcollapsed_1');
    await page2.waitForSelector('#match_cat_0');
    await page2.waitForSelector('#match_cat_1');
    var boxes2 = await page2.$$eval('#matchedIncomeInflowsBox select[id^="match_cat_"]', function(sels){
      return sels.map(function(sel){ return Array.from(sel.options).map(function(o){ return o.value; }); });
    });
    assert.strictEqual(boxes2.length, 2, 'Expected 2 matched-inflow dropdowns for the business match too, got: ' + JSON.stringify(boxes2));
    boxes2.forEach(function(opts){
      assert.ok(opts.indexOf('business') !== -1, 'A business-declared match should always keep the general reason list (never the employer-only work-payment list), got: ' + JSON.stringify(opts));
    });
  } finally {
    await page2.context().close();
  }
};
