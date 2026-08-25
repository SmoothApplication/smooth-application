'use strict';
// User feedback, off the "Income & bank statement analysis" section's two summary pills: "Under income
// generation add the percentage of income that has been generated. Under Closing balance strength, add
// the closing balance generated from the bank statement and give it a percentage of what the closing
// balance [is] to the amount needed to travel." Follow-up clarification: the income percentage should
// blend BOTH things that pill already judges qualitatively — how much of the "needs an explanation" list
// has actually been explained, and how consistent the monthly income itself looks (no zero-income months,
// low month-to-month variance) — into one combined score, not just one or the other.
const assert = require('assert');
const path = require('path');
const { newPageAt, passConsentGate, goToSessionByPill } = require('./helpers');

var SAMPLE_STATEMENT = path.join(__dirname, 'fixtures', 'bank-statement-sample.pdf');

exports.run = async function(ctx){
  var page = await newPageAt(ctx.browser, '/index.html');
  try {
    await passConsentGate(page);

    // Before anything is entered, both percentage lines should stay empty rather than show a bogus 0%.
    // (#incomePillPct/#balancePillPct live on finance2 — reading them via $eval doesn't actually need
    // that session visible, but navigate there anyway since that's also where the statement gets
    // scanned a little further down.)
    await goToSessionByPill(page, 4); // finance2
    var emptyIncomePct = await page.$eval('#incomePillPct', function(el){ return el.textContent.trim(); });
    var emptyBalancePct = await page.$eval('#balancePillPct', function(el){ return el.textContent.trim(); });
    assert.strictEqual(emptyIncomePct, '', 'Income % should be blank until cash-flow data exists, got: "' + emptyIncomePct + '"');
    assert.strictEqual(emptyBalancePct, '', 'Balance % should be blank until trip-cost figures are entered, got: "' + emptyBalancePct + '"');

    // Fill in the detailed financial calculator (its own session now — 'finance', index 5) so a real
    // recommended-funds figure exists: flight 1,000,000/adult, accommodation 100,000/night × 5 nights
    // -> totalCost 1,500,000, recommendedFunds (2× buffer) 3,000,000.
    await goToSessionByPill(page, 5); // finance (calculator)
    await page.fill('#fc_nights', '5');
    await page.fill('#fc_flight', '1000000');
    await page.fill('#fc_accom', '100000');
    await page.waitForTimeout(300);

    // Scan the fixture statement: 3 months of ₦450,000 salary (Jan, Feb) plus a 3rd month combining
    // ₦450,000 (narrated "SALARY PAYMENT ABC LTD") + a blank-narration ₦500,000 inflow (both dated in
    // March) — final closing balance ₦1,823,000. The blank-narration inflow is the one flagged as
    // needing an explanation.
    await goToSessionByPill(page, 4); // finance2 — stmtFile1/btnAnalyzeStatements live here
    await page.setInputFiles('#stmtFile1', SAMPLE_STATEMENT);
    await page.click('#btnAnalyzeStatements');
    await page.waitForSelector('#unexplainedInflowsBox .explain-box', { timeout: 20000 });
    await page.waitForTimeout(500);

    // --- Closing balance strength: exact balance + percentage of the recommended funds -------------
    var balanceHtml = await page.$eval('#balancePillPct', function(el){ return el.innerHTML; });
    assert.ok(/1,823,000/.test(balanceHtml), 'Should show the exact closing balance detected from the statement, got: ' + balanceHtml);
    assert.ok(/detected from your bank statement/.test(balanceHtml), 'Should note the balance came from the analyzed statement, not a typed figure, got: ' + balanceHtml);
    var expectedBalancePct = Math.round(1823000 / 3000000 * 100); // 61%
    assert.ok(balanceHtml.indexOf('>' + expectedBalancePct + '%<') !== -1, 'Expected ' + expectedBalancePct + '% of recommended funds, got: ' + balanceHtml);
    assert.ok(/3,000,000/.test(balanceHtml), 'Should show the recommended-funds figure it\'s measured against, got: ' + balanceHtml);

    // --- Income generation: combined explainability + consistency percentage -----------------------
    // Nothing explained yet -> 0% of 1 flagged inflow explained; income itself is present every month
    // with moderate variance (cv ≈ 0.382) -> consistency 81%; combined (0+81)/2 = 40.5, rounds to 41%.
    var incomeHtmlBefore = await page.$eval('#incomePillPct', function(el){ return el.innerHTML; });
    assert.ok(/41% overall/.test(incomeHtmlBefore), 'Expected 41% overall before explaining the flagged inflow, got: ' + incomeHtmlBefore);
    assert.ok(/0% of flagged inflows explained \(0 of 1\)/.test(incomeHtmlBefore), 'Expected 0 of 1 flagged inflows explained, got: ' + incomeHtmlBefore);
    assert.ok(/81% income consistency/.test(incomeHtmlBefore), 'Expected 81% income consistency, got: ' + incomeHtmlBefore);

    // Explain the one flagged inflow -> explainability jumps to 100%, combined rises to 91% (avg of 100
    // and 81, rounded).
    await page.selectOption('#explain_cat_0', 'self');
    await page.waitForFunction(function(){
      var box = document.getElementById('explainbox_0');
      return box && box.classList.contains('collapsed');
    }, { timeout: 3000 });
    await page.waitForTimeout(200);
    var incomeHtmlAfter = await page.$eval('#incomePillPct', function(el){ return el.innerHTML; });
    assert.ok(/91% overall/.test(incomeHtmlAfter), 'Expected 91% overall after explaining the flagged inflow, got: ' + incomeHtmlAfter);
    assert.ok(/100% of flagged inflows explained \(1 of 1\)/.test(incomeHtmlAfter), 'Expected 1 of 1 flagged inflows explained, got: ' + incomeHtmlAfter);
  } finally {
    await page.context().close();
  }
};
