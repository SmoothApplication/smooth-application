'use strict';
// User feedback (10-item list, off a real Zenith bank statement + the applicant's own manual analysis
// spreadsheet):
//   6. "Pick top 10 consistent names applicant receives inflow from" — ranked by how many separate
//      months a sender recurs across, not by amount (that's what "Top 10 highest transfers" already
//      does) — a one-off ₦500,000 payment should NOT outrank a sender who sends smaller amounts every
//      single month.
//   9. "If you find any Surname similar to applicant from the bank statement group as Family then ask
//      for the reason for what. Create a drop down menu to contain gift, sales of property, rental
//      income, others."
//   8/10. Decode common Nigerian bank narration shorthand (NIP, ROLEZ = Moniepoint MFB, WBP = Wema
//      Bank, etc.) inline, right where each inflow's raw narration is shown.
// Further user request: employer-matched inflows (exercised in items 8/10 below) now render on their
// own "Workplace income" tab (Step 5) instead of alongside business inflows on Step 2.
const assert = require('assert');
const path = require('path');
const { newPageAt, passConsentGate, goToSessionByPill, goToFinanceStep } = require('./helpers');

var FIXTURE = path.join(__dirname, 'fixtures', 'consistent-senders-fixture.pdf');

exports.run = async function(ctx){
  var page = await newPageAt(ctx.browser, '/index.html');
  try {
    await passConsentGate(page);

    // Applicant's own surname ("Smith") is shared by one of the senders in the fixture ("Mary Smith").
    await goToSessionByPill(page, 0);
    await page.fill('#f_name', 'Test Applicant Smith');
    await page.selectOption('#f_workStatus', 'employed');
    await page.fill('#f_employerName', 'Good Employer Ltd');

    await goToSessionByPill(page, 1); // 'Financial readiness'
    await page.setInputFiles('#stmtFile1', FIXTURE);
    await page.click('#btnAnalyzeStatements');
    await page.waitForFunction(function(){
      var el = document.getElementById('stmtAnalyzeMsg');
      return el && /Detected \d+ transaction/.test(el.textContent);
    }, { timeout: 20000 });
    await page.waitForTimeout(400);

    // --- Item 6: Top 10 most consistent senders, ranked by distinct-month count -------------------
    var consistentRows = await page.$$eval('#topConsistentSendersBox tbody tr', function(rows){
      return rows.map(function(r){ return Array.from(r.querySelectorAll('td')).map(function(td){ return td.textContent.trim(); }); });
    });
    assert.ok(consistentRows.length >= 3, 'Should list at least 3 consistent senders, got: ' + JSON.stringify(consistentRows));
    // "Good Employer" (4 distinct months) should rank above "Mary Smith" (3 months), which should rank
    // above "John Doe Ventures" (1 month) — even though John Doe Ventures sent the single BIGGEST
    // amount (₦500,000) of anyone in the whole fixture.
    var names = consistentRows.map(function(r){ return r[1]; });
    var goodEmployerIdx = names.findIndex(function(n){ return /Good Employer/i.test(n); });
    var marySmithIdx = names.findIndex(function(n){ return /Mary Smith/i.test(n); });
    var johnDoeIdx = names.findIndex(function(n){ return /John Doe Ventures/i.test(n); });
    assert.ok(goodEmployerIdx !== -1 && marySmithIdx !== -1 && johnDoeIdx !== -1,
      'All three senders should appear in the consistent-senders list, got: ' + JSON.stringify(names));
    assert.ok(goodEmployerIdx < marySmithIdx && marySmithIdx < johnDoeIdx,
      'Ranking should be by distinct-month count (Good Employer 4mo > Mary Smith 3mo > John Doe Ventures 1mo), got order: ' + JSON.stringify(names));
    assert.strictEqual(consistentRows[goodEmployerIdx][2], '4', 'Good Employer should show 4 distinct months, got: ' + JSON.stringify(consistentRows[goodEmployerIdx]));
    assert.strictEqual(consistentRows[marySmithIdx][2], '3', 'Mary Smith should show 3 distinct months, got: ' + JSON.stringify(consistentRows[marySmithIdx]));
    assert.strictEqual(consistentRows[johnDoeIdx][2], '1', 'John Doe Ventures should show only 1 distinct month, got: ' + JSON.stringify(consistentRows[johnDoeIdx]));

    // Contrast: the existing "Top 10 highest transfers" list (ranked by amount) should put John Doe
    // Ventures FIRST — proving the two lists genuinely measure different things.
    var topInflowNarrations = await page.$$eval('#topInflowsBox tbody tr', function(rows){
      return rows.map(function(r){ return r.children[3].textContent; });
    });
    assert.ok(/JOHN DOE VENTURES/i.test(topInflowNarrations[0] || ''),
      'The single largest inflow (₦500,000, John Doe Ventures) should rank #1 by amount, got: ' + JSON.stringify(topInflowNarrations));

    // --- Item 9: surname-matched sender grouped as "Family" with a narrower reason dropdown ---------
    // Each box now also has a "same reason for all / different reasons per payment" mode toggle
    // (a separate <select>, id="srcmode_N") ahead of the actual category dropdown — select the
    // category one specifically (id="srccat_N") rather than just "the first select in the box".
    var boxInfo = await page.evaluate(function(){
      var boxes = Array.from(document.querySelectorAll('#incomeBreakdownBox .explain-box'));
      return boxes.map(function(b){
        var nameEl = b.querySelector('.tx-line b');
        var sel = b.querySelector('select[id^="srccat_"]');
        return {
          id: b.id,
          name: nameEl ? nameEl.textContent : '',
          isFamily: /Family/.test(b.querySelector('.tx-line') ? b.querySelector('.tx-line').innerHTML : ''),
          options: sel ? Array.from(sel.options).map(function(o){ return o.textContent; }) : null
        };
      });
    });
    var marySmithBox = boxInfo.filter(function(b){ return /Mary Smith/i.test(b.name); })[0];
    var johnDoeBox = boxInfo.filter(function(b){ return /John Doe Ventures/i.test(b.name); })[0];
    assert.ok(marySmithBox, 'Mary Smith should appear as its own group in the income breakdown, got: ' + JSON.stringify(boxInfo));
    assert.ok(marySmithBox.isFamily, 'Mary Smith (shares the applicant\'s surname "Smith") should be badged "Family", got: ' + JSON.stringify(marySmithBox));
    assert.deepStrictEqual(marySmithBox.options, ['Choose a reason…', 'Gift', 'Sale of property', 'Rental income', 'Others'],
      'Family-badged sender should get the narrower gift/sale-of-property/rental-income/others dropdown, got: ' + JSON.stringify(marySmithBox.options));

    assert.ok(johnDoeBox, 'John Doe Ventures should appear as its own group, got: ' + JSON.stringify(boxInfo));
    assert.ok(!johnDoeBox.isFamily, 'John Doe Ventures does not share the applicant\'s surname and should NOT be badged "Family", got: ' + JSON.stringify(johnDoeBox));
    assert.ok(johnDoeBox.options.length > 5, 'A non-family sender should still get the full general-purpose reason dropdown, got: ' + JSON.stringify(johnDoeBox.options));

    // --- Items 8/10: bank narration code glossary, surfaced on the matched-employer inflow boxes ----
    // Matched inflows are auto-explained (and so start collapsed) — expand the first one to see the
    // full box, including the narration decode toggle. Employer-matched inflows live on their own
    // "Workplace income" tab (Step 5) now.
    await goToFinanceStep(page, 5);
    await page.waitForSelector('#matchcollapsed_emp_0');
    await page.click('#matchcollapsed_emp_0');
    await page.waitForSelector('#match_cat_emp_0');
    var decodeHtml = await page.$eval('#employerIncomeInflowsBox', function(el){ return el.innerHTML; });
    assert.ok(/What does this narration mean/i.test(decodeHtml), 'Matched inflow boxes should offer a narration decode toggle, got missing from: ' + decodeHtml.slice(0, 200));
    assert.ok(/NIBSS Instant Payment/i.test(decodeHtml), 'Should decode "NIP" as NIBSS Instant Payment, got: ' + decodeHtml);
    assert.ok(/Moniepoint MFB/i.test(decodeHtml), 'Should decode "ROLEZ" as Moniepoint MFB, got: ' + decodeHtml);
  } finally {
    await page.context().close();
  }
};
