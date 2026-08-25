'use strict';
// Real user report (via a live user, "Funmi"): her GTB bank statement produced only "Detected 1
// transaction(s)" with a garbage row, and the employer/business name cross-check then failed with a
// false "could not be found" error. Root cause: this bank's PDF export renders each table COLUMN as
// its own text run sharing one Y position down the whole page (e.g. one run reads "Balance 1,765.79
// 11,765.79 3,707.79" — the header word plus every row's value in that column), rather than a normal
// row grid. The row-based parser's Y-proximity line grouping sees this as a handful of garbled lines
// and finds no real transactions — it ends up parsing the statement's own header info-box (Print
// Date / Total Debit / Total Credit / Closing / Usable / Opening Balance) as one fake row instead.
//
// The fallback below only activates when the normal parser finds fewer than 2 transactions, so normal
// (working) statement formats are never affected. It reconstructs each row from a per-page date-list
// line and a same-length balance-list line, using the balance-to-balance delta for debit/credit (an
// "Opening Balance" figure read from the statement's own summary box seeds the very first delta) —
// deliberately leaving narration blank, since this layout's Remarks column is one long unsplittable
// run per page.
const assert = require('assert');
const path = require('path');
const { newPageAt, passConsentGate, goToSessionByPill } = require('./helpers');

var COLUMN_MAJOR_STATEMENT = path.join(__dirname, 'fixtures', 'column-major-statement.pdf');

exports.run = async function(ctx){
  var page = await newPageAt(ctx.browser, '/index.html');
  try {
    await passConsentGate(page);
    await goToSessionByPill(page, 4); // finance2 session — statement upload lives here
    await page.setInputFiles('#stmtFile1', COLUMN_MAJOR_STATEMENT);
    await page.click('#btnAnalyzeStatements');
    await page.waitForFunction(function(){
      var el = document.getElementById('stmtAnalyzeMsg');
      return el && /Detected \d+ transaction/.test(el.textContent);
    }, { timeout: 20000 });
    await page.waitForTimeout(300);
    var html = await page.$eval('#stmtAnalyzeMsg', function(el){ return el.innerHTML; });

    // 3 real rows reconstructed, not the 1 fake header-derived row the old code produced.
    assert.ok(/Detected 3 transaction/.test(html), 'Should reconstruct all 3 rows from the column-major layout, got: ' + html);
    // An honest note that narration couldn't be read for this layout, so the reader knows why any
    // cross-checks below are weaker than usual.
    assert.ok(/layout is unusual/i.test(html), 'Should explain the reconstructed-row limitation, got: ' + html);

    var cf = await page.evaluate(function(){
      return {
        inflow: document.getElementById('cf_in_1').value,
        outflow: document.getElementById('cf_out_1').value,
        balance: document.getElementById('cf_bal_1').value
      };
    });
    // Debit/credit reconstructed via balance delta from a 3,397.79 opening balance read off the
    // statement's own summary box: 1,765.79 (-1,632 debit), 11,765.79 (+10,000 credit), 3,707.79
    // (-8,058 debit) — total debit 9,690, total credit 10,000, closing balance 3,707.79.
    assert.strictEqual(cf.inflow, '10000', 'Total credit should be 10,000, got: ' + cf.inflow);
    assert.strictEqual(cf.outflow, '9690', 'Total debit should be 9,690, got: ' + cf.outflow);
    assert.strictEqual(cf.balance, '3708', 'Closing balance should be about 3,708 (rounded), got: ' + cf.balance);
  } finally {
    await page.context().close();
  }
};
