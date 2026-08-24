'use strict';
// User feedback, off a real statement with 19 matching credits: inflow from a declared employer and
// business should be treated specially — instead of grouping every matching transaction into one
// summary sentence, each individual payment should be shown and explainable on its own. The employer/
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
//
// Further user request: give employer-matched inflows their own "Workplace income" tab (Step 5),
// separate from business-matched inflows which stay on Step 2 — previously both rendered together into
// matchedIncomeInflowsBox. This test now checks each group lands in its own box, on its own step tab.
const assert = require('assert');
const path = require('path');
const { newPageAt, passConsentGate, goToSessionByPill, goToFinanceStep } = require('./helpers');

var INFLOW_STATEMENT = path.join(__dirname, 'fixtures', 'employer-inflow-narration.pdf');

exports.run = async function(ctx){
  var page = await newPageAt(ctx.browser, '/index.html');
  try {
    await passConsentGate(page);

    await goToSessionByPill(page, 0); // trip session — "Work status" dropdown lives here
    await page.fill('#f_name', 'Test Applicant');
    await page.selectOption('#f_workStatus', 'both');
    await page.fill('#f_employerName', 'Grace Covenant Youth Church');
    await page.fill('#f_businessName', 'Bright Homes Cleaning Solutions Ltd');

    await goToSessionByPill(page, 1); // finance2 session — statement upload lives here
    await page.setInputFiles('#stmtFile1', INFLOW_STATEMENT);
    await page.click('#btnAnalyzeStatements');
    await page.waitForSelector('#matchedIncomeInflowsBox .explain-box', { timeout: 20000 });
    await page.waitForTimeout(300);

    // 3 business inflows on Step 2, 3 employer inflows on Step 5 — split into separate boxes/tabs,
    // not one rolled-up sentence and not mixed together.
    var bizBoxCount = await page.$$eval('#matchedIncomeInflowsBox .explain-box', function(els){ return els.length; });
    assert.strictEqual(bizBoxCount, 3, 'Step 2 should render 3 individual business-matched inflow boxes, got: ' + bizBoxCount);

    var empBoxCount = await page.$$eval('#employerIncomeInflowsBox .explain-box', function(els){ return els.length; });
    assert.strictEqual(empBoxCount, 3, 'Step 5 (Workplace income) should render 3 individual employer-matched inflow boxes, got: ' + empBoxCount);

    var introHtmlBiz = await page.$eval('#matchedIncomeInflowsBox', function(el){ return el.innerHTML; });
    assert.ok(/Instead of one lump total/.test(introHtmlBiz), 'Should explain these are itemized instead of a lump total, got: ' + introHtmlBiz);
    assert.ok(/3 inflows matching "Bright Homes Cleaning Solutions Ltd"/.test(introHtmlBiz), 'Should mention the 3 business inflows by name, got: ' + introHtmlBiz);
    assert.ok(!/Grace Covenant Youth Church/.test(introHtmlBiz), 'Employer inflows should not also appear in the Step 2 business box, got: ' + introHtmlBiz);

    var introHtmlEmp = await page.$eval('#employerIncomeInflowsBox', function(el){ return el.innerHTML; });
    assert.ok(/Instead of one lump total/.test(introHtmlEmp), 'Should explain these are itemized instead of a lump total, got: ' + introHtmlEmp);
    assert.ok(/3 inflows matching "Grace Covenant Youth Church"/.test(introHtmlEmp), 'Should mention the 3 employer inflows by name, got: ' + introHtmlEmp);
    assert.ok(!/Bright Homes Cleaning Solutions Ltd/.test(introHtmlEmp), 'Business inflows should not also appear in the Step 5 workplace-income box, got: ' + introHtmlEmp);

    // Every box should already be auto-tagged (collapsed, showing a checkmark + its category) rather
    // than sitting empty and demanding the applicant redo work the system already knows the answer to.
    var allCollapsedBiz = await page.$$eval('#matchedIncomeInflowsBox .explain-box', function(els){
      return els.every(function(el){ return el.classList.contains('collapsed') && el.classList.contains('explained'); });
    });
    assert.strictEqual(allCollapsedBiz, true, 'Every business-matched inflow should start auto-explained and collapsed');

    var allCollapsedEmp = await page.$$eval('#employerIncomeInflowsBox .explain-box', function(els){
      return els.every(function(el){ return el.classList.contains('collapsed') && el.classList.contains('explained'); });
    });
    assert.strictEqual(allCollapsedEmp, true, 'Every employer-matched inflow should start auto-explained and collapsed');

    // Match on the trailing "— <category>" summary specifically (not just anywhere in the line) —
    // the narration text itself can legitimately contain the word "Salary" too (e.g. "January Salary"),
    // so a bare /Salary/ search would over-match. This fixture deliberately narrates the EMPLOYER
    // (Grace Covenant Youth Church) payments "Allowance" and the BUSINESS (Bright Homes Cleaning) payments "Salary" —
    // the pre-tag should follow what each payment's own narration says, not which field it matched.
    var bizSummaries = await page.$$eval('#matchedIncomeInflowsBox .tx-line', function(els){ return els.map(function(e){ return e.textContent; }); });
    assert.ok(bizSummaries.filter(function(s){ return /— Salary$/.test(s); }).length === 3, 'The 3 business inflows, all narrated "Salary", should be pre-tagged "Salary" (read from their own narration, not defaulted to "Business" just because they matched the business), got: ' + JSON.stringify(bizSummaries));

    var empSummaries = await page.$$eval('#employerIncomeInflowsBox .tx-line', function(els){ return els.map(function(e){ return e.textContent; }); });
    assert.ok(empSummaries.filter(function(s){ return /— Allowance$/.test(s); }).length === 3, 'The 3 employer inflows, all narrated "Allowance", should be pre-tagged "Allowance" (read from their own narration, not defaulted to "Salary" just because they matched the employer), got: ' + JSON.stringify(empSummaries));

    // Still fully editable — a wrongly-matched payment should be re-classifiable, same as any other
    // inflow explanation on this page. Employer inflows live on Step 5 now, so navigate there first —
    // Step 2's content (and its own unprefixed matchbox_0) is hidden while Step 5 is active.
    await goToFinanceStep(page, 5);
    await page.click('#matchcollapsed_emp_0');
    await page.waitForSelector('#match_cat_emp_0');
    await page.selectOption('#match_cat_emp_0', 'others');
    await page.fill('#match_detail_emp_0', 'Actually a one-off gift, not real salary');
    await page.waitForFunction(function(){
      var box = document.getElementById('matchbox_emp_0');
      return box && box.classList.contains('collapsed');
    }, { timeout: 3000 });
    var editedSummary = await page.$eval('#matchbox_emp_0 .tx-line', function(el){ return el.textContent; });
    assert.ok(/Others.*Actually a one-off gift/.test(editedSummary), 'Should allow correcting an individual matched inflow to a different reason, got: ' + editedSummary);
  } finally {
    await page.context().close();
  }
};
