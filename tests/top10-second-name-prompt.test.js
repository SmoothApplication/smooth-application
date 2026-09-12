'use strict';
// User-reported gap, off a real statement's "Top 10 most consistent senders" table: some rows showed
// only a single word (e.g. "Mary") extracted from a bank narration. User's own words: "Ask for the 2nd
// name. each person must have at least 2 names."
//
// A single word isn't enough to trust as a real identified sender, and can't reliably distinguish two
// different people who happen to share a first name. Rather than silently displaying a bare single
// word, a row whose name is only one word now shows an inline "please add the second name" prompt right
// there in the table - saved the same way as an existing "Fix name" correction (senderNameCorrections,
// keyed by the raw extracted name), so the corrected full name then displays wherever else that sender
// shows up too. The Save button requires at least 2 words before accepting the correction.
const assert = require('assert');
const { newPageAt, passConsentGate, goToSessionByPill, goToFinanceStep } = require('./helpers');

exports.run = async function(ctx){
  var page = await newPageAt(ctx.browser, '/index.html');
  try {
    await passConsentGate(page);
    await goToSessionByPill(page, 4); // Income & bank statement analysis
    await goToFinanceStep(page, 5); // Report - #topConsistentSendersBox lives here

    await page.evaluate(function(){
      window.__testRenderTopConsistentSenders([
        // A single-word sender, recurring across 2 distinct months - should get the "add 2nd name"
        // prompt despite being a real, recurring sender.
        { date: '2026-01-05', amount: 20000, narration: 'BANKNIP From 000014 PAYREF: - SENDER: MARY' },
        { date: '2026-02-05', amount: 20000, narration: 'BANKNIP From 000014 PAYREF: - SENDER: MARY' },
        // A normal two-word sender - must NOT get the prompt. Narrated sender-side (SENDER:, not
        // IFO/TO) - a recipient-side name is excluded entirely by senderSideCandidates and would never
        // reach this table at all, which isn't what this row is testing.
        { date: '2026-01-10', amount: 50000, narration: 'BANKNIP From 000020 PAYREF: - SENDER: CHIDINMA EZE' },
        { date: '2026-02-10', amount: 50000, narration: 'BANKNIP From 000020 PAYREF: - SENDER: CHIDINMA EZE' }
      ], 'Agboola Mary Oluwafunmilayo');
    });

    var rowsBefore = await page.$$eval('#topConsistentSendersBox tbody tr', function(trs){
      return trs.map(function(tr){ return tr.textContent; });
    });
    // The single-word "Mary" row must show the prompt text; the two-word "Chidinma Eze" row must not.
    var maryRowHtml = await page.$eval('#topConsistentSendersBox tbody tr:has-text("Mary")', function(tr){ return tr.innerHTML; }).catch(function(){ return null; });
    assert.ok(maryRowHtml, 'The single-word Mary row should be present, got rows: ' + JSON.stringify(rowsBefore));
    assert.ok(/add the second name/i.test(maryRowHtml), 'The single-word sender row should show the "add second name" prompt, got: ' + maryRowHtml);
    assert.ok(/top10-secondname-input/.test(maryRowHtml), 'The single-word sender row should include the second-name input, got: ' + maryRowHtml);

    var chidinmaRowHtml = await page.$eval('#topConsistentSendersBox tbody tr:has-text("Chidinma")', function(tr){ return tr.innerHTML; });
    assert.ok(!/add the second name/i.test(chidinmaRowHtml), 'A normal two-word sender row must not show the "add second name" prompt, got: ' + chidinmaRowHtml);

    // Try Save with only one word - should be rejected with an inline warning, not accepted.
    await page.fill('#topConsistentSendersBox .top10-secondname-input', 'Solo');
    await page.click('#topConsistentSendersBox .top10-secondname-save');
    await page.waitForSelector('#topConsistentSendersBox .scan-msg.warn');
    var stillMaryRowHtml = await page.$eval('#topConsistentSendersBox tbody tr:has-text("Mary")', function(tr){ return tr.innerHTML; });
    assert.ok(/at least two names/i.test(stillMaryRowHtml), 'A single-word entry should be rejected with an inline warning, got: ' + stillMaryRowHtml);

    // Now provide a real two-word full name and Save - the table should re-render showing the
    // corrected full name, and the prompt should be gone for that row.
    await page.fill('#topConsistentSendersBox .top10-secondname-input', 'Mary Chukwu');
    await page.click('#topConsistentSendersBox .top10-secondname-save');
    await page.waitForFunction(function(){
      var box = document.getElementById('topConsistentSendersBox');
      return box && /Mary Chukwu/.test(box.textContent);
    }, { timeout: 5000 });
    var correctedRowHtml = await page.$eval('#topConsistentSendersBox tbody tr:has-text("Mary Chukwu")', function(tr){ return tr.innerHTML; });
    assert.ok(!/add the second name/i.test(correctedRowHtml), 'Once corrected to a real 2-word name, the prompt should no longer show, got: ' + correctedRowHtml);
  } finally {
    await page.context().close();
  }
};
