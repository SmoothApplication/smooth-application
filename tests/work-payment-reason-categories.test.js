'use strict';
// User feedback, off a real manual extraction of every inflow from a declared employer ("Crisp N Clean
// Exclusive Solutions Ltd"), in two rounds:
//   1. Several genuinely matched inflows carry a narration that never states a specific reason at all —
//      just "…TRANSFER TO <applicant> FROM <employer>…", no "Salary"/"Allowance"/etc. For those, offer a
//      narrower Salary/Allowance-type dropdown (WORK_PAYMENT_REASON_CATEGORIES) instead of the general
//      reason list, since the sender is already confirmed — what's unclear is which TYPE of employment
//      payment this one was.
//   2. Direct follow-up, screenshotted straight off the live matched-inflow boxes: other inflows' own
//      narration DOES already state a specific reason (".../February Salary/...", ".../allowance/...")
//      but were still defaulting to the generic "Business" pre-tag from the general list, ignoring what
//      the narration said. Those should read the stated reason and pre-select/offer the matching
//      WORK_PAYMENT_REASON_CATEGORIES option instead — regardless of whether the match was against a
//      declared employer or a declared business, since "February Salary" means the same thing either way.
//      A blank-narration inflow matched to a declared BUSINESS (not an employer) is the one case that
//      still keeps the general list — no specific reason stated, and a business's own income could be
//      anything (a sale, a service fee), not necessarily payroll.
const assert = require('assert');
const path = require('path');
const { newPageAt, passConsentGate, goToSessionByPill } = require('./helpers');

var FIXTURE = path.join(__dirname, 'fixtures', 'work-payment-reason-fixture.pdf');

exports.run = async function(ctx){
  // --- Employer match: one txn states "February Salary", the other has no specific reason -----------
  var page = await newPageAt(ctx.browser, '/index.html');
  try {
    await passConsentGate(page);
    await goToSessionByPill(page, 3);
    await page.fill('#f_name', 'Test Applicant');
    await page.selectOption('#f_workStatus', 'employed');
    await page.fill('#f_employerName', 'Crisp N Clean Exclusive Solutions Ltd');

    await goToSessionByPill(page, 4);
    await page.setInputFiles('#stmtFile1', FIXTURE);
    await page.click('#btnAnalyzeStatements');
    await page.waitForFunction(function(){
      var el = document.getElementById('stmtAnalyzeMsg');
      return el && /Detected \d+ transaction/.test(el.textContent);
    }, { timeout: 20000 });
    await page.waitForTimeout(400);

    // Both matched inflows are auto-tagged on first sight, so their boxes start collapsed — expand both.
    await page.click('#matchcollapsed_0');
    await page.click('#matchcollapsed_1');
    await page.waitForSelector('#match_cat_0');
    await page.waitForSelector('#match_cat_1');
    var boxes = await page.$$eval('#matchedIncomeInflowsBox select[id^="match_cat_"]', function(sels){
      return sels.map(function(sel){ return {value: sel.value, options: Array.from(sel.options).map(function(o){ return o.value; })}; });
    });
    assert.strictEqual(boxes.length, 2, 'Expected 2 matched-inflow dropdowns, got: ' + JSON.stringify(boxes));

    // Both are matched to a declared EMPLOYER, so BOTH should offer the narrower work-payment list
    // (one because its narration states "Salary" directly, the other because it states no reason at all
    // and an employer match with no reason still gets the narrower list) — neither should ever offer
    // "Family"/"Business"/"Gift" from the general list.
    boxes.forEach(function(b){
      assert.ok(b.options.indexOf('transport_allowance') !== -1, 'Employer-matched inflow should offer the narrower work-payment list, got: ' + JSON.stringify(b));
      assert.ok(b.options.indexOf('family') === -1 && b.options.indexOf('business') === -1 && b.options.indexOf('gift') === -1,
        'Narrower work-payment list should not include Family/Business/Gift, got: ' + JSON.stringify(b));
    });

    // The txn whose narration literally says "February Salary" should be pre-selected "salary" — read
    // FROM the narration, not just defaulted to the generic employer pre-tag.
    var salarySelected = boxes.filter(function(b){ return b.value === 'salary'; });
    assert.ok(salarySelected.length >= 1, 'Expected at least one dropdown pre-selected "salary" from its own narration, got: ' + JSON.stringify(boxes));

    var promptTexts = await page.$$eval('#matchedIncomeInflowsBox .item-tip', function(els){ return els.map(function(e){ return e.textContent; }); });
    assert.ok(promptTexts.some(function(t){ return /already states what it was for/.test(t); }),
      'Expected the "read from narration" prompt text to appear for the "February Salary" txn, got: ' + JSON.stringify(promptTexts));
    assert.ok(promptTexts.some(function(t){ return /doesn't spell out a specific reason/.test(t); }),
      'Expected the "no specific reason" prompt text to appear for the blank-reason txn, got: ' + JSON.stringify(promptTexts));
  } finally {
    await page.context().close();
  }

  // --- Business match: "February Salary" txn still reads the narration; the blank one keeps the general
  // list (a business's blank-narration payment isn't assumed to be payroll) ---------------------------
  var page2 = await newPageAt(ctx.browser, '/index.html');
  try {
    await passConsentGate(page2);
    await goToSessionByPill(page2, 3);
    await page2.fill('#f_name', 'Test Applicant');
    await page2.selectOption('#f_workStatus', 'selfEmployed');
    await page2.fill('#f_businessName', 'Crisp N Clean Exclusive Solutions Ltd');

    await goToSessionByPill(page2, 4);
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
      return sels.map(function(sel){ return {value: sel.value, options: Array.from(sel.options).map(function(o){ return o.value; })}; });
    });
    assert.strictEqual(boxes2.length, 2, 'Expected 2 matched-inflow dropdowns for the business match too, got: ' + JSON.stringify(boxes2));

    var salaryBox = boxes2.filter(function(b){ return b.value === 'salary'; })[0];
    assert.ok(salaryBox, 'The "February Salary" txn should still be pre-selected "salary" even on a business match, got: ' + JSON.stringify(boxes2));
    assert.ok(salaryBox.options.indexOf('business') === -1, 'Once a specific reason is read from the narration, the narrower list (not the general one) should be offered, got: ' + JSON.stringify(salaryBox));

    var businessBox = boxes2.filter(function(b){ return b.value === 'business'; })[0];
    assert.ok(businessBox, 'The blank-narration txn on a business match should keep the general list, pre-tagged "business", got: ' + JSON.stringify(boxes2));
    assert.ok(businessBox.options.indexOf('transport_allowance') === -1, 'A business match with no stated reason should NOT get the employer-only narrower list, got: ' + JSON.stringify(businessBox));
  } finally {
    await page2.context().close();
  }
};
