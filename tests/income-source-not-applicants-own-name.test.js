'use strict';
// User feedback (with screenshots + their own manually-reconciled spreadsheet cross-check): a
// recurring inflow was misattributed to "SALARY" from the APPLICANT'S OWN NAME rather than the real,
// distinct person who actually sent the money — "All these are not SALARY", and a follow-up pointing
// to the real recurring sender's name and payment count/total as proof.
//
// Root cause: bank narrations typically name BOTH sides of a transfer ("...TRF TO <applicant> FROM
// <sender>..."), and extractNameCandidates() returned every name-shaped word run with no notion of
// which side is which. Since the applicant is the recipient on every single inflow, their own typed
// name recurred across nearly every narration and kept winning the "most recurring sender" vote in
// identifyIncomeSourceName(), getTopConsistentSenders(), and identifyTopIncomeSource() -- crowding out
// the real, distinct recurring sender.
//
// This fixture models exactly that shape: 4 identical-amount inflows narrated "TRF TO TEST APPLICANT
// FROM BLESSING NWOSU" (so the applicant's own typed name appears in every single narration, while
// "Blessing Nwosu" is the real, distinct, actually-recurring sender), plus one unrelated debit so the
// statement isn't suspiciously all-credits. Asserts the real sender -- not the applicant -- is the one
// identified as the dominant/most-consistent income source everywhere that check runs.
//
// Note: once a single dominant sender is confirmed consistent for a stable recurring amount, the
// "Income sources breakdown" (step 4) deliberately groups those transactions under a generic "Salary"
// label rather than the sender's own name (see buildIncomeSourceBreakdown's comment) — that's existing,
// intended behaviour, not something this test challenges. What this test guards against is the
// applicant's own name being used as that dominant sender, or appearing as a named group/sender
// anywhere the app draws its own conclusions (as opposed to merely quoting the raw statement narration
// verbatim inside the "Show individual payment(s)" detail, which legitimately contains both names).
const assert = require('assert');
const path = require('path');
const { newPageAt, passConsentGate, goToSessionByPill, goToFinanceStep } = require('./helpers');

var FIXTURE = path.join(__dirname, 'fixtures', 'own-name-vs-real-sender-statement.pdf');

// Pulls out just the app's own generated labels (bold group headings, "best-effort read" quotes,
// "Most frequent inflow source" quotes, the sender table's name cells) rather than the whole HTML
// blob, so assertions aren't tripped up by the raw statement narration being quoted verbatim inside
// "Show individual payment(s)" details (which legitimately contains the applicant's name, since
// that's what the real bank statement said).
function stripRawNarrationQuotes(html){
  return html.replace(/\("[^"]*"\)/g, '(raw narration omitted)');
}

exports.run = async function(ctx){
  var page = await newPageAt(ctx.browser, '/index.html');
  try {
    await passConsentGate(page);

    // Applicant types their own name in first -- this is the name the fix needs to exclude from
    // "sender candidate" consideration.
    await goToSessionByPill(page, 3);
    await page.fill('#f_name', 'Test Applicant');
    await goToSessionByPill(page, 4);

    await goToFinanceStep(page, 1);
    await page.setInputFiles('#stmtFile1', FIXTURE);
    await page.click('#btnAnalyzeStatements');
    await page.waitForFunction(function(){
      var el = document.getElementById('stmtAnalyzeMsg');
      return el && /Detected \d+ transaction/.test(el.textContent);
    }, { timeout: 20000 });
    await page.waitForTimeout(300);

    // Check 1: the "Recurring monthly income detected" / "Most frequent inflow source" messages
    // should name the real sender, and never claim the applicant is their own income source.
    var analyzeMsgHtml = stripRawNarrationQuotes(await page.$eval('#stmtAnalyzeMsg', function(el){ return el.innerHTML; }));
    assert.ok(/best-effort read:\s*"Blessing Nwosu"/i.test(analyzeMsgHtml),
      'Should identify "Blessing Nwosu" as the recurring source, got: ' + analyzeMsgHtml.slice(0, 2000));
    assert.ok(/Most frequent inflow source.*"Blessing Nwosu"/is.test(analyzeMsgHtml),
      'Should identify "Blessing Nwosu" as the most frequent inflow source, got: ' + analyzeMsgHtml.slice(0, 2000));
    assert.ok(!/best-effort read:\s*"Test Applicant"/i.test(analyzeMsgHtml),
      'Should NOT identify the applicant\'s own name as their own recurring income source, got: ' + analyzeMsgHtml.slice(0, 2000));
    assert.ok(!/Most frequent inflow source.*"Test Applicant"/is.test(analyzeMsgHtml),
      'Should NOT identify the applicant\'s own name as the most frequent inflow source, got: ' + analyzeMsgHtml.slice(0, 2000));

    // Check 2: "Top 10 most consistent senders" (step 3) should list the real sender by name, and
    // should never list the applicant's own name as a "sender."
    await goToFinanceStep(page, 3);
    await page.waitForTimeout(200);
    var sendersHtml = await page.$eval('#topConsistentSendersBox', function(el){ return el.innerHTML; });
    assert.ok(/<td>Blessing Nwosu<\/td>/i.test(sendersHtml),
      'Top 10 most consistent senders should list "Blessing Nwosu", got: ' + sendersHtml.slice(0, 1500));
    assert.ok(!/<td>Test Applicant<\/td>/i.test(sendersHtml),
      'Top 10 most consistent senders should NOT list the applicant\'s own name as a sender, got: ' + sendersHtml.slice(0, 1500));

    // Check 3: "Income sources breakdown" (step 4) group heading must never be the applicant's own
    // name (whether it lands in the generic "Salary" bucket, as it does once a single dominant sender
    // is confirmed, or its own named group).
    await goToFinanceStep(page, 4);
    await page.waitForTimeout(200);
    var breakdownHtml = await page.$eval('#incomeBreakdownBox', function(el){ return el.innerHTML; });
    var groupHeadings = (breakdownHtml.match(/<b>([^<]+)<\/b>/g) || []).map(function(m){ return m.replace(/<\/?b>/g, ''); });
    assert.ok(groupHeadings.length > 0, 'Should have at least one income source group heading, got: ' + breakdownHtml.slice(0, 1500));
    groupHeadings.forEach(function(h){
      assert.ok(!/^test applicant$/i.test(h.trim()),
        'No income source group should be headed with the applicant\'s own name, got heading: "' + h + '" in: ' + breakdownHtml.slice(0, 1500));
    });
  } finally {
    await page.context().close();
  }
};
