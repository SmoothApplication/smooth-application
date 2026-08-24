'use strict';
// User report, off a real statement filled in mid-August: "August Salary" got flagged as missing even
// though August wasn't over yet — real salary for a month isn't due until month-end or the first week
// of the following month, and simply hadn't failed to arrive at all. The statement just happened to have
// OTHER (non-salary) activity in August, which was enough to drag the missing-month detector's window
// forward into a month that hadn't concluded. Fixed two ways: (1) never flag the CURRENT calendar month
// or anything after it — it can't have "failed" to show up yet — and (2) give last month a short grace
// window (first week of a new month), since payroll commonly posts a few days into the following month.
// Uses Playwright's clock API to pin "today" so this is deterministic regardless of when the suite runs.
const assert = require('assert');
const path = require('path');
const { passConsentGate, goToSessionByPill, PORT } = require('./helpers');

var FIXTURE = path.join(__dirname, 'fixtures', 'current-month-grace-fixture.pdf');

async function newPageAtFixedTime(browser, isoDate){
  var context = await browser.newContext({});
  var page = await context.newPage();
  page.on('dialog', function(d){ d.accept(); });
  await page.clock.setFixedTime(new Date(isoDate));
  await page.goto('http://127.0.0.1:' + PORT + '/index.html');
  return page;
}

async function analyzeAndGetBoxHtml(page){
  await passConsentGate(page);
  await goToSessionByPill(page, 1); // finance2 = Income & bank statement analysis
  await page.setInputFiles('#stmtFile1', FIXTURE);
  await page.waitForTimeout(500);
  await page.click('#btnAnalyzeStatements');
  await page.waitForTimeout(8000);
  return page.$eval('#incomeBreakdownBox', function(el){ return el.innerHTML; });
}

exports.run = async function(ctx){
  // Scenario 1: "today" is mid-August (the 19th, well outside the grace window). July has activity but
  // no salary — a genuine, completed gap, should still be flagged. August also has activity but no
  // salary — but August itself isn't over yet, so it must NOT be flagged.
  var midAugustPage = await newPageAtFixedTime(ctx.browser, '2026-08-19T10:00:00');
  try {
    var midAugustHtml = await analyzeAndGetBoxHtml(midAugustPage);
    assert.ok(/no <b>July Salary<\/b> payment was found/.test(midAugustHtml), 'A completed past month (July) with no salary should still be flagged, got: ' + midAugustHtml.slice(0, 400));
    assert.ok(!/August Salary/.test(midAugustHtml), 'The CURRENT month (August), still in progress, should NOT be flagged as missing, got: ' + midAugustHtml.slice(0, 400));
  } finally {
    await midAugustPage.context().close();
  }

  // Scenario 2: "today" is Sept 3rd — within the first-week payroll grace window. August's salary may
  // simply not have posted yet, so August should ALSO be excluded here despite the new month having
  // started. July (older, well past any grace period) should still be flagged.
  var earlySeptPage = await newPageAtFixedTime(ctx.browser, '2026-09-03T10:00:00');
  try {
    var earlySeptHtml = await analyzeAndGetBoxHtml(earlySeptPage);
    assert.ok(/no <b>July Salary<\/b> payment was found/.test(earlySeptHtml), 'July should still be flagged in early September, got: ' + earlySeptHtml.slice(0, 400));
    assert.ok(!/August Salary/.test(earlySeptHtml), 'August should get a payroll grace period in the first week of September, got: ' + earlySeptHtml.slice(0, 400));
  } finally {
    await earlySeptPage.context().close();
  }
};
