'use strict';
// User request: "Add Income generation, Closing balance strength, how much is needed to balance,
// how long it would take to get the desired balance... Let the table [come] after as [a] summary of
// financials." A new #financialSummaryBox table on Step 5 (the "Report" tab) pulls together figures
// already computed elsewhere on the page (cash-flow totals, the Strong/Needs attention/Weak balance
// badge, the shortfall/months-to-save note) into one glanceable table — see the block right after
// balancePillPctEl inside computeFinancials() in index.html.
//
// Reuses the EXISTING consistent-senders-fixture.pdf (4 months, known figures — see the comment
// block below for the arithmetic) rather than adding a new fixture, since this only needs realistic
// cash-flow totals, not any particular sender name.
//
// Fixture arithmetic (from tests/fixtures/consistent-senders-fixture.pdf):
//   Jan: +300,000 (salary) +20,000 (Mary Smith) +500,000 (John Doe Ventures) -15,000 (POS)  = 820,000 in / 15,000 out
//   Feb: +300,000 +20,000                                                                    = 320,000 in / 0 out
//   Mar: +300,000 +20,000                                                                    = 320,000 in / 0 out
//   Apr: +300,000                                                                             = 300,000 in / 0 out
//   Total inflow  = 1,760,000   Total outflow = 15,000   Net change = 1,745,000
//   Closing balance (last row) = 1,745,000  ->  Opening balance = 1,745,000 - 1,745,000 = 0
//   Average monthly inflow = 1,760,000 / 4 = 440,000   Average monthly outflow = 15,000 / 4 = 3,750
//   Monthly net savings pace = 436,250
const assert = require('assert');
const path = require('path');
const { newPageAt, passConsentGate, goToSessionByPill, goToSessionByLabel, goToFinanceStep } = require('./helpers');

var FIXTURE = path.join(__dirname, 'fixtures', 'consistent-senders-fixture.pdf');

function rowsToMap(rows){
  var map = {};
  rows.forEach(function(r){ map[r[0]] = r[1]; });
  return map;
}

exports.run = async function(ctx){
  var page = await newPageAt(ctx.browser, '/index.html');
  try {
    await passConsentGate(page);
    await goToSessionByPill(page, 3);
    await page.fill('#f_name', 'Test Applicant Smith');
    await page.selectOption('#f_workStatus', 'employed');
    await page.fill('#f_employerName', 'Good Employer Ltd');

    await goToSessionByPill(page, 4);
    await page.setInputFiles('#stmtFile1', FIXTURE);
    await page.click('#btnAnalyzeStatements');
    await page.waitForFunction(function(){
      var el = document.getElementById('stmtAnalyzeMsg');
      return el && /Detected \d+ transaction/.test(el.textContent);
    }, { timeout: 20000 });
    await page.waitForTimeout(400);
    await goToFinanceStep(page, 5);

    // --- Before any trip cost is entered: totals/averages are real, but there's nothing yet to grade
    // the closing balance against ------------------------------------------------------------------
    var rows1 = await page.$eval('#financialSummaryBox', function(el){
      return Array.from(el.querySelectorAll('tbody tr')).map(function(r){
        var tds = r.querySelectorAll('td');
        return [tds[0].textContent.trim(), tds[1].textContent.trim()];
      });
    });
    var map1 = rowsToMap(rows1);
    assert.strictEqual(map1['Opening balance (start of statement window)'], '₦0', 'Opening balance should derive to ₦0 for this fixture, got: ' + JSON.stringify(map1));
    assert.strictEqual(map1['Total inflow (credits)'], '₦1,760,000', 'Total inflow should sum all 4 months, got: ' + JSON.stringify(map1));
    assert.strictEqual(map1['Total outflow (debits)'], '₦15,000', 'Total outflow should be the one POS debit, got: ' + JSON.stringify(map1));
    assert.strictEqual(map1['Net change (inflow − outflow)'], '₦1,745,000', 'Net change should be inflow minus outflow, got: ' + JSON.stringify(map1));
    assert.strictEqual(map1['Closing balance (most recent)'], '₦1,745,000', 'Closing balance should match the fixture\'s last balance figure, got: ' + JSON.stringify(map1));
    assert.strictEqual(map1['Income generation (average per month)'], '₦440,000', 'Average monthly inflow should be 1,760,000/4, got: ' + JSON.stringify(map1));
    assert.strictEqual(map1['Average monthly outflow'], '₦3,750', 'Average monthly outflow should be 15,000/4, got: ' + JSON.stringify(map1));
    assert.strictEqual(map1['Monthly net savings pace'], '₦436,250', 'Monthly net savings pace should be avg inflow minus avg outflow, got: ' + JSON.stringify(map1));
    assert.strictEqual(map1['Closing balance strength'], 'Detected — add a trip cost to compare', 'With no trip cost/dates entered yet, strength should say so rather than guess, got: ' + JSON.stringify(map1));
    assert.strictEqual(map1['Recommended funds needed (2× buffer)'], 'Add trip dates/cost above', 'Should prompt for a trip cost rather than show a bogus figure, got: ' + JSON.stringify(map1));
    assert.strictEqual(map1['Amount still needed to reach it'], '—', 'With nothing to compare against yet, this should be a dash, not a number, got: ' + JSON.stringify(map1));
    assert.strictEqual(map1['Estimated time to reach it'], '—', 'Same reasoning for the time-to-target row, got: ' + JSON.stringify(map1));

    // --- Once a trip cost is entered: the closing balance (1,745,000) comfortably covers a modest
    // 2× buffer (2 × 200,000 = 400,000), so the summary should read "already there" ------------------
    // fc_flight lives on the SEPARATE "Financial readiness calculator" session/card (session key
    // 'finance'), distinct from the "Income & bank statement analysis" session (key 'finance2', with
    // its own Step 1-5 sub-tabs) this test has been in so far — not another sub-tab within it.
    await goToSessionByLabel(page, 'Financial readiness calculator');
    await page.fill('#fc_flight', '200000');
    await page.waitForTimeout(300);
    await goToSessionByLabel(page, 'Income & bank statement analysis');
    await goToFinanceStep(page, 5);

    var rows2 = await page.$eval('#financialSummaryBox', function(el){
      return Array.from(el.querySelectorAll('tbody tr')).map(function(r){
        var tds = r.querySelectorAll('td');
        return [tds[0].textContent.trim(), tds[1].textContent.trim()];
      });
    });
    var map2 = rowsToMap(rows2);
    assert.strictEqual(map2['Recommended funds needed (2× buffer)'], '₦400,000', 'Recommended funds should be 2× the 200,000 flight-only cost, got: ' + JSON.stringify(map2));
    assert.strictEqual(map2['Closing balance strength'], 'Strong — covers the 2× buffer', 'A 1,745,000 closing balance comfortably covers a 400,000 buffer, got: ' + JSON.stringify(map2));
    assert.strictEqual(map2['Amount still needed to reach it'], 'Already met ✅', 'The buffer is already covered, so nothing further should be "needed", got: ' + JSON.stringify(map2));
    assert.strictEqual(map2['Estimated time to reach it'], 'Already there ✅', 'Matches the row above — already met, not a months estimate, got: ' + JSON.stringify(map2));
    // Every other row should stay exactly as computed before — entering a trip cost must not alter
    // the cash-flow totals themselves.
    assert.strictEqual(map2['Total inflow (credits)'], '₦1,760,000', 'Entering a trip cost should not change the detected cash-flow totals, got: ' + JSON.stringify(map2));
    assert.strictEqual(map2['Closing balance (most recent)'], '₦1,745,000', 'Entering a trip cost should not change the detected closing balance, got: ' + JSON.stringify(map2));
  } finally {
    await page.context().close();
  }
};
