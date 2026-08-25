'use strict';
// User feedback, off the "Planned application/submission date" field: "State the number of days
// or weeks you have from the day you are filling this website to Planned application/submission
// date. That is the number of days you have to prepare all your documents." This is deliberately
// a SEPARATE countdown from the existing one on this same field (which measures the gap between
// the application date and the travel date, for processing-time risk) — this one measures the gap
// between right now and the planned submission date, so it only needs that one field filled in,
// not the travel date too.
//
// All the expected values below are computed the same way the app computes them (relative to
// "today"), rather than hardcoded, so this test stays correct no matter what day it actually runs.
const assert = require('assert');
const { newPageAt, passConsentGate, goToSessionByPill } = require('./helpers');

function toDateInputValue(d){
  var y = d.getFullYear();
  var m = String(d.getMonth() + 1).padStart(2, '0');
  var day = String(d.getDate()).padStart(2, '0');
  return y + '-' + m + '-' + day;
}

function addDays(base, days){
  var d = new Date(base);
  d.setDate(d.getDate() + days);
  return d;
}

exports.run = async function(ctx){
  var page = await newPageAt(ctx.browser, '/index.html');
  try {
    await passConsentGate(page);
    await goToSessionByPill(page, 3);

    var today = new Date();
    today.setHours(0,0,0,0);

    // Nothing entered yet -> blank, not a bogus 0-day countdown.
    var emptyText = await page.$eval('#prepTimeCountdown', function(el){ return el.textContent; });
    assert.strictEqual(emptyText, '', 'Should stay blank until a submission date is entered, got: "' + emptyText + '"');

    // 20 days out -> "about 2 weeks" parenthetical included. Deliberately NOT filling the travel
    // date here, to prove this countdown doesn't depend on it the way the other one does.
    await page.fill('#f_appdate', toDateInputValue(addDays(today, 20)));
    await page.waitForTimeout(300);
    var text20 = await page.$eval('#prepTimeCountdown', function(el){ return el.textContent; });
    assert.ok(/You have 20 day\(s\) \(about 2 weeks\) from today to gather and prepare/.test(text20), 'Expected a 20-day/~2-week countdown, got: ' + text20);
    var travelTextStillBlank = await page.$eval('#appDateCountdown', function(el){ return el.textContent; });
    assert.strictEqual(travelTextStillBlank, '', 'The OTHER (travel-date) countdown should stay blank with no travel date entered, got: "' + travelTextStillBlank + '"');

    // 3 days out -> under a week, so no "(about 0 weeks)" parenthetical.
    await page.fill('#f_appdate', toDateInputValue(addDays(today, 3)));
    await page.waitForTimeout(300);
    var text3 = await page.$eval('#prepTimeCountdown', function(el){ return el.textContent; });
    assert.ok(/You have 3 day\(s\) from today to gather and prepare/.test(text3), 'Expected a plain 3-day countdown with no week parenthetical, got: ' + text3);
    assert.ok(!/week/.test(text3), 'Should not mention weeks for a 3-day gap, got: ' + text3);

    // Exactly today -> the same-day message, not "0 day(s)".
    await page.fill('#f_appdate', toDateInputValue(today));
    await page.waitForTimeout(300);
    var textToday = await page.$eval('#prepTimeCountdown', function(el){ return el.textContent; });
    assert.ok(/That's today/.test(textToday), 'Expected the same-day message, got: ' + textToday);

    // In the past -> a warning to update the date, not a negative day count.
    await page.fill('#f_appdate', toDateInputValue(addDays(today, -5)));
    await page.waitForTimeout(300);
    var textPast = await page.$eval('#prepTimeCountdown', function(el){ return el.textContent; });
    assert.ok(/is in the past/.test(textPast), 'Expected a past-date warning, got: ' + textPast);
  } finally {
    await page.context().close();
  }
};
