'use strict';
// User feedback, off a real statement with 19 matching credits: "Based on my work, INflow from MFM
// Lekki Yohth Church & Crisp N Clean Exclusive Solution Ltd should be treated specially. Instead of
// grouping the 19 transactions from Crisp N Clean Exclusive Ltd must be explained." The employer/
// business cross-check used to fold every matching inflow into one summary sentence ("Found X as the
// sender on N inflows... totaling Y"). Each matched inflow now ALSO gets its own explain-box (reusing
// the same UI as the "needs an explanation" list), auto-tagged the first time it's seen so 19 legitimate
// salary payments don't turn into 19 chores, but still individually visible and editable — not just one
// lump total.
//
// Follow-up user feedback, screenshotted straight off these boxes on the live site: the auto-tag used to
// be a blanket "an employer match -> Salary, a business match -> Business" regardless of what each
// individual payment's OWN narration actually said. This fixture deliberately narrates the EMPLOYER's
// payments "Allowance" and the BUSINESS's payments "Salary" — the wrong way round from the old blanket
// assumption — specifically to prove the pre-tag now reads and uses each transaction's own stated reason
// (see detectWorkPaymentCategory) rather than defaulting off which field it matched.
const assert = require('assert');
const path = require('path');
const { newPageAt, passConsentGate, goToSessionByPill } = require('./helpers');

var INFLOW_STATEMENT = path.join(__dirname, 'fixtures', 'employer-inflow-narration.pdf');

exports.run = async function(ctx){
  var page = await newPageAt(ctx.browser, '/index.html');
  try {
    await passConsentGate(page);

    await goToSessionByPill(page, 3); // trip session — "Work status" dropdown lives here
    await page.fill('#f_name', 'Test Applicant');
    await page.selectOption('#f_workStatus', 'both');
    await page.fill('#f_employerName', 'MFM Lekki Youth Church');
    await page.fill('#f_businessName', 'Crisp N Clean Exclusive Solutions Ltd');

    await goToSessionByPill(page, 4); // finance2 session — statement upload lives here
    await page.setInputFiles('#stmtFile1', INFLOW_STATEMENT);
    await page.click('#btnAnalyzeStatements');
    await page.waitForSelector('#matchedIncomeInflowsBox .explain-box', { timeout: 20000 });
    await page.waitForTimeout(300);

    // 3 employer inflows + 3 business inflows = 6 individual boxes, not one rolled-up sentence.
    var boxCount = await page.$$eval('#matchedIncomeInflowsBox .explain-box', function(els){ return els.length; });
    assert.strictEqual(boxCount, 6, 'Should render 6 individual matched-inflow boxes (3 employer + 3 business), got: ' + boxCount);

    var introHtml = await page.$eval('#matchedIncomeInflowsBox', function(el){ return el.innerHTML; });
    assert.ok(/Instead of one lump total/.test(introHtml), 'Should explain these are itemized instead of a lump total, got: ' + introHtml);
    assert.ok(/3 inflows matching "MFM Lekki Youth Church"/.test(introHtml), 'Should mention the 3 employer inflows by name, got: ' + introHtml);
    assert.ok(/3 inflows matching "Crisp N Clean Exclusive Solutions Ltd"/.test(introHtml), 'Should mention the 3 business inflows by name, got: ' + introHtml);

    // Every box should already be auto-tagged (collapsed, showing a checkmark + its category) rather
    // than sitting empty and demanding the applicant redo work the system already knows the answer to.
    var allCollapsed = await page.$$eval('#matchedIncomeInflowsBox .explain-box', function(els){
      return els.every(function(el){ return el.classList.contains('collapsed') && el.classList.contains('explained'); });
    });
    assert.strictEqual(allCollapsed, true, 'Every matched inflow should start auto-explained and collapsed');

    // Match on the trailing "— <category>" summary specifically (not just anywhere in the line) —
    // the narration text itself can legitimately contain the word "Salary" too (e.g. "January Salary"),
    // so a bare /Salary/ search would over-match. This fixture deliberately narrates the EMPLOYER
    // (MFM Lekki Youth Church) payments "Allowance" and the BUSINESS (Crisp N Clean) payments "Salary" —
    // the pre-tag should follow what each payment's own narration says, not which field it matched.
    var summaries = await page.$$eval('#matchedIncomeInflowsBox .tx-line', function(els){ return els.map(function(e){ return e.textContent; }); });
    assert.ok(summaries.filter(function(s){ return /— Allowance$/.test(s); }).length === 3, 'The 3 employer inflows, all narrated "Allowance", should be pre-tagged "Allowance" (read from their own narration, not defaulted to "Salary" just because they matched the employer), got: ' + JSON.stringify(summaries));
    assert.ok(summaries.filter(function(s){ return /— Salary$/.test(s); }).length === 3, 'The 3 business inflows, all narrated "Salary", should be pre-tagged "Salary" (read from their own narration, not defaulted to "Business" just because they matched the business), got: ' + JSON.stringify(summaries));

    // Still fully editable — a wrongly-matched payment should be re-classifiable, same as any other
    // inflow explanation on this page.
    await page.click('#matchcollapsed_0');
    await page.waitForSelector('#match_cat_0');
    await page.selectOption('#match_cat_0', 'others');
    await page.fill('#match_detail_0', 'Actually a one-off gift, not real salary');
    await page.waitForFunction(function(){
      var box = document.getElementById('matchbox_0');
      return box && box.classList.contains('collapsed');
    }, { timeout: 3000 });
    var editedSummary = await page.$eval('#matchbox_0 .tx-line', function(el){ return el.textContent; });
    assert.ok(/Others.*Actually a one-off gift/.test(editedSummary), 'Should allow correcting an individual matched inflow to a different reason, got: ' + editedSummary);
  } finally {
    await page.context().close();
  }
};
