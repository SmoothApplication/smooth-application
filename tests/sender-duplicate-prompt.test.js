'use strict';
// User report, off their own live bank-statement testing of the "Top 10 most consistent senders"
// table: two rows were actually the SAME real person, just extracted with different word sets from
// different narration rows (e.g. a fuller name on some rows, a shorter one plus a trailing
// bank-code-shaped fragment on others). Splitting one genuinely consistent sender across two weaker
// rows undersells exactly the "steady month after month" signal this table exists to surface. Their
// explicit ask: "If you see a name with 2 or more similar names ask the user if it is the same
// person" — NOT auto-merge, since two different family members can legitimately share a surname.
//
// mergeNameVariants already handled the SAFE case (one extracted name is a full substring of
// another) before this batch. This covers the fuzzier, unsafe-to-auto-merge case: two names sharing
// 2+ significant words in some order — see applySenderDuplicateDecisions/sharedSignificantWords in
// index.html. The fixture (tests/fixtures/sender-duplicate-fixture.pdf) is entirely synthetic —
// fictional names, not the real applicant data that surfaced this report.
const assert = require('assert');
const path = require('path');
const { newPageAt, passConsentGate, goToSessionByPill, goToFinanceStep } = require('./helpers');

var FIXTURE = path.join(__dirname, 'fixtures', 'sender-duplicate-fixture.pdf');

exports.run = async function(ctx){
  var page = await newPageAt(ctx.browser, '/index.html');
  try {
    await passConsentGate(page);
    await goToSessionByPill(page, 3);
    await page.fill('#f_name', 'Test Applicant Okafor');
    await page.selectOption('#f_workStatus', 'employed');
    await page.fill('#f_employerName', 'Some Employer Ltd');

    await goToSessionByPill(page, 4); // 'Financial readiness'
    await page.setInputFiles('#stmtFile1', FIXTURE);
    await page.click('#btnAnalyzeStatements');
    await page.waitForFunction(function(){
      var el = document.getElementById('stmtAnalyzeMsg');
      return el && /Detected \d+ transaction/.test(el.textContent);
    }, { timeout: 20000 });
    await page.waitForTimeout(400);
    // Analysis auto-advances to Step 2 (Cash flow & scores) — the consistent-senders table lives on
    // Step 3 (Detailed reports), so its buttons aren't clickable until that tab is actually active.
    await goToFinanceStep(page, 3);

    // --- Before any decision: both look-alike rows appear separately, plus a prompt asking about
    // them specifically (not about the genuinely unrelated third sender) ---------------------------
    var rowsBefore = await page.$$eval('#topConsistentSendersBox tbody tr', function(rows){
      return rows.map(function(r){ return Array.from(r.querySelectorAll('td')).map(function(td){ return td.textContent.trim(); }); });
    });
    var namesBefore = rowsBefore.map(function(r){ return r[1]; });
    assert.ok(namesBefore.some(function(n){ return /Tunde Bassey Ekpo/i.test(n); }), 'Should list "Tunde Bassey Ekpo" as its own row before any merge decision, got: ' + JSON.stringify(namesBefore));
    assert.ok(namesBefore.some(function(n){ return /Bassey Ekpo Onb/i.test(n); }), 'Should list "Bassey Ekpo Onb" as its own row before any merge decision, got: ' + JSON.stringify(namesBefore));
    assert.ok(namesBefore.some(function(n){ return /Chidi Ogbonna Traders/i.test(n); }), 'The unrelated contrast sender should also be listed, got: ' + JSON.stringify(namesBefore));

    var bannerHtml = await page.$eval('#topConsistentSendersBox', function(el){ return el.innerHTML; });
    assert.ok(/sender-dup-banner/.test(bannerHtml), 'A possible-duplicate prompt banner should render, got: ' + bannerHtml.slice(0, 400));
    assert.ok(/Tunde Bassey Ekpo/.test(bannerHtml) && /Bassey Ekpo Onb/.test(bannerHtml), 'The prompt should name both look-alike senders, got: ' + bannerHtml.slice(0, 800));
    // The genuinely unrelated sender shares no words with either look-alike name, so it should never
    // be pulled into a duplicate prompt of its own.
    var dupBannerCount = await page.$$eval('.sender-dup-banner', function(els){ return els.length; });
    assert.strictEqual(dupBannerCount, 1, 'Only the one genuine look-alike pair should prompt — the unrelated sender should not, got ' + dupBannerCount + ' banner(s)');

    // --- Track the decision, no PII in the tracked event name --------------------------------------
    await page.evaluate(function(){
      window.__trackedEvents = [];
      window.goatcounter = { count: function(o){ window.__trackedEvents.push(o.path); } };
    });

    // --- Click "Yes, same person" — the two rows should merge into one, combining distinct months --
    await page.click('.sender-dup-decision-btn[data-decision="merge"]');
    await page.waitForTimeout(200);

    var tracked = await page.evaluate(function(){ return window.__trackedEvents; });
    assert.ok(tracked.indexOf('sender_duplicate_decision:merge') !== -1, 'Should track the merge decision without any name in the event, got: ' + JSON.stringify(tracked));
    tracked.forEach(function(evt){
      assert.ok(!/Tunde|Bassey|Ekpo/i.test(evt), 'Tracked event names must never contain the sender name itself, got: ' + evt);
    });

    var rowsAfter = await page.$$eval('#topConsistentSendersBox tbody tr', function(rows){
      return rows.map(function(r){ return Array.from(r.querySelectorAll('td')).map(function(td){ return td.textContent.trim(); }); });
    });
    var mergedRow = rowsAfter.find(function(r){ return /Tunde Bassey Ekpo|Bassey Ekpo Onb/i.test(r[1]); });
    assert.ok(mergedRow, 'One merged row should remain after confirming "same person", got: ' + JSON.stringify(rowsAfter));
    assert.strictEqual(rowsAfter.filter(function(r){ return /Tunde Bassey Ekpo|Bassey Ekpo Onb/i.test(r[1]); }).length, 1, 'The two look-alike rows should have merged into exactly one row, got: ' + JSON.stringify(rowsAfter));
    assert.strictEqual(mergedRow[2], '5', 'Merged sender should show 5 distinct months (2 from one name + 3 from the other), got: ' + JSON.stringify(mergedRow));
    assert.strictEqual(mergedRow[3], '5', 'Merged sender should show 5 total payments, got: ' + JSON.stringify(mergedRow));

    var bannerAfterMerge = await page.$$eval('.sender-dup-banner', function(els){ return els.length; });
    assert.strictEqual(bannerAfterMerge, 0, 'The prompt should not reappear once answered, got ' + bannerAfterMerge + ' banner(s) still showing');
  } finally {
    await page.context().close();
  }

  // --- Separate page: clicking "No, different people" on the fresh prompt should keep both rows,
  // never merge them, and never show the prompt again for that pair ------------------------------
  var page2 = await newPageAt(ctx.browser, '/index.html');
  try {
    await passConsentGate(page2);
    await goToSessionByPill(page2, 3);
    await page2.fill('#f_name', 'Test Applicant Okafor');
    await page2.selectOption('#f_workStatus', 'employed');
    await page2.fill('#f_employerName', 'Some Employer Ltd');
    await goToSessionByPill(page2, 4);
    await page2.setInputFiles('#stmtFile1', FIXTURE);
    await page2.click('#btnAnalyzeStatements');
    await page2.waitForFunction(function(){
      var el = document.getElementById('stmtAnalyzeMsg');
      return el && /Detected \d+ transaction/.test(el.textContent);
    }, { timeout: 20000 });
    await page2.waitForTimeout(400);
    await goToFinanceStep(page2, 3);

    await page2.click('.sender-dup-decision-btn[data-decision="separate"]');
    await page2.waitForTimeout(200);

    var rowsAfterSeparate = await page2.$$eval('#topConsistentSendersBox tbody tr', function(rows){
      return rows.map(function(r){ return Array.from(r.querySelectorAll('td')).map(function(td){ return td.textContent.trim(); }); });
    });
    var namesAfterSeparate = rowsAfterSeparate.map(function(r){ return r[1]; });
    assert.ok(namesAfterSeparate.some(function(n){ return /Tunde Bassey Ekpo/i.test(n); }), 'Choosing "different people" should keep the first name as its own row, got: ' + JSON.stringify(namesAfterSeparate));
    assert.ok(namesAfterSeparate.some(function(n){ return /Bassey Ekpo Onb/i.test(n); }), 'Choosing "different people" should keep the second name as its own row, got: ' + JSON.stringify(namesAfterSeparate));

    var bannerAfterSeparate = await page2.$$eval('.sender-dup-banner', function(els){ return els.length; });
    assert.strictEqual(bannerAfterSeparate, 0, 'The prompt should not reappear once answered "different people" either, got ' + bannerAfterSeparate + ' banner(s) still showing');
  } finally {
    await page2.context().close();
  }
};
