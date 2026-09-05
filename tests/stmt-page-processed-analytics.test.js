'use strict';
// Year-end ask: "how many pages processed" and "how many accounts processed" — without ever
// keeping anyone's actual statement. Fixed by firing the existing anonymous `stmt_page_processed`
// event once per page read during a statement analysis (personal or business) - GoatCounter's own
// running hit-count on that one event IS the year's page total, and the existing
// statement_analysis:completed / business_statement_analysis:completed counts already answer
// "how many processed" - no new storage, account, or per-file record needed anywhere. See the
// trackEvent()/trackEventTimes() doc comments in index.html for the full reasoning.
const assert = require('assert');
const path = require('path');
const { passConsentGate, goToSessionByPill, newPageAt } = require('./helpers');

var MANY_PAGES_STATEMENT = path.join(__dirname, 'fixtures', 'many-pages-statement.pdf'); // 65 pages
var ONE_PAGE_STATEMENT = path.join(__dirname, 'fixtures', 'bank-statement-sample.pdf'); // 1 page

async function stubGoatcounter(page){
  await page.evaluate(function(){
    window.__trackedEvents = [];
    window.goatcounter = { count: function(o){ window.__trackedEvents.push(o.path); } };
  });
}
function countOf(events, name){
  return events.filter(function(e){ return e === name; }).length;
}

exports.run = async function(ctx){
  // Scenario 1: personal statement analysis, a real 65-page PDF - the page-processed tally should
  // land on exactly 65, and the funnel-completion event should fire exactly once, not once per page.
  var page = await newPageAt(ctx.browser, '/index.html');
  try {
    await passConsentGate(page);
    await stubGoatcounter(page);
    await goToSessionByPill(page, 4); // finance2 = Income & bank statement analysis

    await page.setInputFiles('#stmtFile1', MANY_PAGES_STATEMENT);
    await page.waitForTimeout(500);
    await page.click('#btnAnalyzeStatements');
    await page.waitForFunction(function(){
      var el = document.getElementById('stmtAnalyzeMsg');
      return el && /Detected \d+ transaction/.test(el.textContent);
    }, { timeout: 30000 });
    await page.waitForTimeout(300);

    var events = await page.evaluate(function(){ return window.__trackedEvents; });
    assert.strictEqual(countOf(events, 'stmt_page_processed'), 65, 'Should tally exactly one stmt_page_processed event per page of a 65-page statement, got: ' + JSON.stringify(events));
    assert.strictEqual(countOf(events, 'statement_analysis:completed'), 1, 'The funnel-completion event should still fire exactly once regardless of page count, got: ' + JSON.stringify(events));

    // Never the filename, never a page's contents - only the fixed event name itself.
    events.forEach(function(name){
      assert.ok(!/many-pages-statement/i.test(name), 'Tracked event names must never contain a filename, got: ' + name);
    });
  } finally {
    await page.context().close();
  }

  // Scenario 2: business statement analysis, a 1-page fixture - same mechanism, different funnel.
  var page2 = await newPageAt(ctx.browser, '/index.html');
  try {
    await passConsentGate(page2);
    await stubGoatcounter(page2);
    await goToSessionByPill(page2, 3); // trip session - Work status lives here
    await page2.selectOption('#f_workStatus', 'selfEmployed');
    await page2.waitForTimeout(150);
    await goToSessionByPill(page2, 7); // cat:Financial evidence - business statement item lives here
    await page2.waitForSelector('#file_bizFinance', { timeout: 5000 });

    await page2.setInputFiles('#file_bizFinance', ONE_PAGE_STATEMENT);
    await page2.waitForTimeout(300);
    await page2.click('#scan_bizFinance');
    await page2.waitForTimeout(8000);

    var events2 = await page2.evaluate(function(){ return window.__trackedEvents; });
    assert.strictEqual(countOf(events2, 'stmt_page_processed'), 1, 'A 1-page business statement should tally exactly one stmt_page_processed event, got: ' + JSON.stringify(events2));
    assert.strictEqual(countOf(events2, 'business_statement_analysis:completed'), 1, 'The business funnel-completion event should fire exactly once, got: ' + JSON.stringify(events2));
  } finally {
    await page2.context().close();
  }
};
