'use strict';
// User feedback: the travel-history "Date travelled" field used a native <input type="month">,
// whose built-in picker shows the year as static text with no way to jump to a different one
// beyond clicking through months one at a time. Travel history is always in the past, so this
// replaces it with two real dropdowns — Month, and Year (this year back 19 more, 20 years total,
// no future years since a past trip can't have a future date).
const assert = require('assert');
const { newPageAt, passConsentGate, goToSessionByPill } = require('./helpers');

exports.run = async function(ctx){
  var page = await newPageAt(ctx.browser, '/index.html');
  try {
    await passConsentGate(page);
    await goToSessionByPill(page, 0);
    await page.selectOption('#te_firstTime', 'yes');
    await page.waitForSelector('#btnAddTravelRow');
    await page.click('#btnAddTravelRow');
    await page.waitForSelector('#travelHistoryBody select[data-idx="0"][data-field="dateMonth"]');

    var currentYear = new Date().getFullYear();
    var yearOptions = await page.$eval('#travelHistoryBody select[data-idx="0"][data-field="dateYear"]', function(el){
      return Array.from(el.options).map(function(o){ return o.value; }).filter(Boolean);
    });
    assert.strictEqual(yearOptions.length, 20, 'Year dropdown should offer 20 years, got ' + yearOptions.length);
    assert.strictEqual(yearOptions[0], String(currentYear), 'First year option should be the current year, got: ' + yearOptions[0]);
    assert.strictEqual(yearOptions[yearOptions.length - 1], String(currentYear - 19), 'Last year option should be 19 years back, got: ' + yearOptions[yearOptions.length - 1]);
    // No future years — every option should be <= current year.
    yearOptions.forEach(function(y){
      assert.ok(parseInt(y, 10) <= currentYear, 'Year dropdown should not offer a future year, got: ' + y);
    });

    var monthOptions = await page.$eval('#travelHistoryBody select[data-idx="0"][data-field="dateMonth"]', function(el){
      return Array.from(el.options).map(function(o){ return o.textContent; }).slice(1); // drop the "Month…" placeholder
    });
    assert.deepStrictEqual(monthOptions, ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'], 'Month dropdown should list all 12 months, got: ' + monthOptions.join(','));

    // Picking a month and year should combine into the row's stored date.
    await page.selectOption('#travelHistoryBody select[data-idx="0"][data-field="dateMonth"]', '03');
    await page.selectOption('#travelHistoryBody select[data-idx="0"][data-field="dateYear"]', String(currentYear - 2));
    // Re-render happens on change; confirm the selects kept their picked values afterward (a
    // wholesale table rebuild that lost the selection would be a real regression here).
    var monthVal = await page.$eval('#travelHistoryBody select[data-idx="0"][data-field="dateMonth"]', function(el){ return el.value; });
    var yearVal = await page.$eval('#travelHistoryBody select[data-idx="0"][data-field="dateYear"]', function(el){ return el.value; });
    assert.strictEqual(monthVal, '03', 'Month selection should persist after the row re-renders, got: ' + monthVal);
    assert.strictEqual(yearVal, String(currentYear - 2), 'Year selection should persist after the row re-renders, got: ' + yearVal);
  } finally {
    await page.context().close();
  }
};
