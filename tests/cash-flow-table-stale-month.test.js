'use strict';
// User report, off a live screenshot of the "Cash flow & scores" tab: a cash-flow table whose most
// recent month was well behind today's date went completely unflagged. The existing recency check
// (search index.html for daysSinceLatest > 45) only ever ran off REAL per-transaction dates parsed
// from an uploaded statement — so it silently did nothing for the "Didn't upload a statement in Step
// 1? Type the totals in directly below instead." manual-entry path, and it only ever looked at the
// deepest raw transaction data, not whatever the cash-flow table itself currently displays (which can
// differ — an applicant can hand-edit a month label after a scan, or the table can be filled entirely
// by hand). This checks the table's own LAST filled month label against today's date directly, however
// that label got there, using the same 45-day tolerance and message style as the per-transaction check.
const assert = require('assert');
const { newPageAt, passConsentGate, goToSessionByPill, goToFinanceStep } = require('./helpers');

exports.run = async function(ctx){
  var page = await newPageAt(ctx.browser, '/index.html');
  try {
    await passConsentGate(page);
    await goToSessionByPill(page, 4); // finance2 — "Income & bank statement analysis"
    await goToFinanceStep(page, 2); // "Cash flow & scores" sub-tab — the manual-entry table lives here

    // Two months of real figures, but the most recent one is a stale "Jun 2026" — well over 6 weeks
    // before "today" (env date is 2026-09-19).
    await page.fill('#cf_month_1', 'May 2026');
    await page.fill('#cf_in_1', '300000');
    await page.fill('#cf_out_1', '50000');
    await page.fill('#cf_month_2', 'Jun 2026');
    await page.fill('#cf_in_2', '310000');
    await page.fill('#cf_out_2', '55000');
    await page.evaluate(function(){ document.activeElement && document.activeElement.blur(); });
    await page.waitForTimeout(200);

    var cfHtml = await page.$eval('#cashFlowSummary', function(el){ return el.innerHTML; });
    assert.ok(/Jun 2026/.test(cfHtml), 'Should name the stale month found in the table, got: ' + cfHtml);
    assert.ok(/over 6 weeks before today/.test(cfHtml), 'Should warn the most recent month is stale, got: ' + cfHtml);
    var errClassPresent = await page.$('#cashFlowSummary .scan-msg.err');
    assert.ok(errClassPresent, 'Stale-month warning should be a hard "err" severity, not a soft warn, got: ' + cfHtml);

    // Sidebar financial status pill should reflect the err-level issue too (bump('err')).
    var pillText = await page.$eval('#finStatusPill', function(el){ return el.textContent; });
    assert.ok(!/Looking solid/.test(pillText), 'Sidebar pill should not read "Looking solid" while the cash-flow table is stale, got: ' + pillText);

    // Fixing the last month to the current one should clear the warning.
    await page.fill('#cf_month_2', 'Sep 2026');
    await page.evaluate(function(){ document.activeElement && document.activeElement.blur(); });
    await page.waitForTimeout(200);
    var cfHtmlAfter = await page.$eval('#cashFlowSummary', function(el){ return el.innerHTML; });
    assert.ok(!/over 6 weeks before today/.test(cfHtmlAfter), 'Warning should clear once the most recent month is current, got: ' + cfHtmlAfter);
  } finally {
    await page.context().close();
  }
};
