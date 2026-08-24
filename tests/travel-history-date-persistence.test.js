'use strict';
// User report, off the live Travel Experience section: "After typing my input on the 1st line ..
// once I move to the next line, everything in the 1st line clears except the country." Root cause:
// the "Countries you've travelled to" table stores each row's travel date as a single combined
// "YYYY-MM" string (row.date), built from two separate <select> elements (month, year). The old
// code tried to recover "the other half" of the date by re-splitting row.date itself whenever
// either select changed — but row.date was ONLY ever written by that same code, so the very first
// selection (month OR year, whichever came first) had nothing to recombine with and left row.date
// stuck at ''. The second selection then tried to recover the first from row.date and found it
// still empty too. The date was silently never actually saved, no matter what order month/year
// were picked in — invisible until the next full-table rebuild ("+ Add a country" for a new row),
// at which point the date selects reset to their empty "Month…"/"Year…" placeholders, which read as
// the whole row having "cleared" even though the country/reason/days fields (single, non-composite
// values) were unaffected the whole time. Fixed by reading both selects' current DOM values
// directly instead of trying to reconstruct one from the other via row.date.
const assert = require('assert');
const { newPageAt, passConsentGate, goToSessionByPill } = require('./helpers');

async function readRow(page, idx){
  return page.evaluate(function(i){
    var tr = document.querySelectorAll('#travelHistoryBody tr')[i];
    if (!tr) return null;
    return {
      country: tr.querySelector('select[data-field="country"]').value,
      dateMonth: tr.querySelector('select[data-field="dateMonth"]').value,
      dateYear: tr.querySelector('select[data-field="dateYear"]').value,
      reason: tr.querySelector('input[data-field="reason"]').value,
      days: tr.querySelector('input[data-field="days"]').value
    };
  }, idx);
}

exports.run = async function(ctx){
  var page = await newPageAt(ctx.browser, '/index.html');
  try {
    await passConsentGate(page);
    await goToSessionByPill(page, 0);
    await page.waitForSelector('#te_firstTime');
    await page.selectOption('#te_firstTime', 'yes');
    await page.click('#btnAddTravelRow');
    await page.waitForSelector('#travelHistoryBody select[data-idx="0"][data-field="country"]');

    // Fill row 0 completely: country, month, year (in that order), reason, days.
    await page.selectOption('#travelHistoryBody select[data-idx="0"][data-field="country"]', 'Spain');
    await page.selectOption('#travelHistoryBody select[data-idx="0"][data-field="dateMonth"]', '05');
    await page.selectOption('#travelHistoryBody select[data-idx="0"][data-field="dateYear"]', '2023');
    await page.fill('#travelHistoryBody input[data-idx="0"][data-field="reason"]', 'Tourism');
    await page.fill('#travelHistoryBody input[data-idx="0"][data-field="days"]', '5');

    // "Move to the next line" — this is the exact reported trigger: clicking "+ Add a country"
    // rebuilds the whole table from stored state, which is where the date used to vanish.
    await page.click('#btnAddTravelRow');
    await page.waitForSelector('#travelHistoryBody select[data-idx="1"][data-field="country"]');

    var row0 = await readRow(page, 0);
    assert.strictEqual(row0.country, 'Spain', 'Country should survive moving to the next row, got: ' + JSON.stringify(row0));
    assert.strictEqual(row0.dateMonth, '05', 'Month should survive moving to the next row, got: ' + JSON.stringify(row0));
    assert.strictEqual(row0.dateYear, '2023', 'Year should survive moving to the next row, got: ' + JSON.stringify(row0));
    assert.strictEqual(row0.reason, 'Tourism', 'Reason should survive moving to the next row, got: ' + JSON.stringify(row0));
    assert.strictEqual(row0.days, '5', 'Days should survive moving to the next row, got: ' + JSON.stringify(row0));

    // Reverse order (year before month) must work identically — the old bug affected both orders.
    await page.selectOption('#travelHistoryBody select[data-idx="1"][data-field="dateYear"]', '2022');
    await page.selectOption('#travelHistoryBody select[data-idx="1"][data-field="dateMonth"]', '11');
    await page.selectOption('#travelHistoryBody select[data-idx="1"][data-field="country"]', 'Morocco');
    await page.click('#btnAddTravelRow');
    await page.waitForSelector('#travelHistoryBody select[data-idx="2"][data-field="country"]');
    var row1 = await readRow(page, 1);
    assert.strictEqual(row1.dateMonth, '11', 'Month should survive (year-then-month order), got: ' + JSON.stringify(row1));
    assert.strictEqual(row1.dateYear, '2022', 'Year should survive (year-then-month order), got: ' + JSON.stringify(row1));

    // Editing an already-set date (changing just the year) must not disturb the month, and must
    // still survive a subsequent rebuild.
    await page.selectOption('#travelHistoryBody select[data-idx="0"][data-field="dateYear"]', '2020');
    await page.click('#btnAddTravelRow');
    await page.waitForSelector('#travelHistoryBody select[data-idx="3"][data-field="country"]');
    var row0Edited = await readRow(page, 0);
    assert.strictEqual(row0Edited.dateMonth, '05', 'Editing the year alone should leave the month untouched, got: ' + JSON.stringify(row0Edited));
    assert.strictEqual(row0Edited.dateYear, '2020', 'The edited year should stick, got: ' + JSON.stringify(row0Edited));
  } finally {
    await page.context().close();
  }
};
