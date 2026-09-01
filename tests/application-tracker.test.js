'use strict';
// Phase 2 of the same UNILAG street-test feedback that produced the opportunities directory
// (opportunities-directory.test.js): once students had a list of real programs, the natural next ask
// was somewhere to track their own applications. This checks the "My application tracker" card —
// adding/removing a curated program via its own toggle button, adding a free-typed custom entry for
// something not in the curated list, editing status/deadline/notes, and that the tracker survives a
// page reload (its own localStorage key, independent of the per-country autosave — see the
// #appTrackerCard HTML comment in index.html for why it isn't folded into buildPayload()).
const assert = require('assert');
const { newPageAt, passConsentGate, goToSessionByLabel } = require('./helpers');

exports.run = async function(ctx){
  var page = await newPageAt(ctx.browser, '/index.html');
  try {
    await passConsentGate(page);
    await goToSessionByLabel(page, 'Funded opportunities');
    await page.waitForSelector('#appTrackerCard');

    // Empty state before anything is tracked.
    var emptyText = await page.$eval('#trackerList', function(el){ return el.textContent; });
    assert.ok(/Nothing tracked yet/.test(emptyText), 'Should show an empty-state prompt before anything is tracked, got: ' + emptyText);

    // Adding a curated program from the directory above flips its own button to the tracked state
    // AND creates a matching row in the tracker below.
    var addBtn = await page.$('#opp_global-ugrad .opp-track-btn');
    assert.ok(addBtn, 'Global UGRAD card should have a track button');
    var beforeLabel = await page.$eval('#opp_global-ugrad .opp-track-btn', function(el){ return el.textContent; });
    assert.strictEqual(beforeLabel, '+ Add to my tracker');
    await addBtn.click();
    await page.waitForTimeout(50);
    var afterLabel = await page.$eval('#opp_global-ugrad .opp-track-btn', function(el){ return el.textContent; });
    assert.strictEqual(afterLabel, '✓ In my tracker', 'Track button should flip to the tracked state once clicked');
    var rowCount = await page.$$eval('#trackerList .tracker-row', function(els){ return els.length; });
    assert.strictEqual(rowCount, 1, 'A tracker row should appear for the newly tracked program');
    var rowName = await page.$eval('#trackerList .tracker-row h3', function(el){ return el.textContent; });
    assert.strictEqual(rowName, 'Global UGRAD (Global Undergraduate Exchange Program)');

    // Editing the status, deadline, and notes on that row.
    var statusSel = await page.$('#trackerList .tracker-status');
    await statusSel.selectOption('submitted');
    var deadlineInput = await page.$('#trackerList .tracker-deadline');
    await deadlineInput.fill('2027-01-15');
    var notesArea = await page.$('#trackerList .tracker-notes');
    await notesArea.fill('Submitted essay + 2 references, waiting to hear back.');
    await page.waitForTimeout(500); // debounced save

    // A free-typed custom entry, for a program not in the curated list at all.
    await page.fill('#trackerCustomName', 'State scholarship board — local award');
    await page.click('#btnAddCustomTracker');
    await page.waitForTimeout(50);
    var rowCountAfterCustom = await page.$$eval('#trackerList .tracker-row', function(els){ return els.length; });
    assert.strictEqual(rowCountAfterCustom, 2, 'Adding a custom entry should add a second tracker row without touching the first');
    var customNameCleared = await page.$eval('#trackerCustomName', function(el){ return el.value; });
    assert.strictEqual(customNameCleared, '', 'The custom-name input should clear itself after adding');
    // saveTrackerEntries() debounces its localStorage write by 400ms (see index.html) — the 50ms
    // wait above is only enough for the DOM/row-count checks just above, not for that write to have
    // actually landed yet. Give it the same margin as the status/deadline/notes edit above before
    // reloading, or the custom entry just added can lose the race against the reload and appear to
    // "not survive a reload" even though persistence itself is working correctly.
    await page.waitForTimeout(500);

    // Reload the page — the tracker (both entries, with the edited status/deadline/notes) should
    // survive, proving it persists independently of the rest of the app's per-country autosave.
    await page.reload();
    await passConsentGate(page);
    await goToSessionByLabel(page, 'Funded opportunities');
    await page.waitForSelector('#appTrackerCard');
    var rowCountAfterReload = await page.$$eval('#trackerList .tracker-row', function(els){ return els.length; });
    assert.strictEqual(rowCountAfterReload, 2, 'Both tracker entries should survive a page reload');
    var restoredStatus = await page.$eval('#trackerList .tracker-status', function(el){ return el.value; });
    assert.strictEqual(restoredStatus, 'submitted', 'The edited status should survive a reload');
    var restoredDeadline = await page.$eval('#trackerList .tracker-deadline', function(el){ return el.value; });
    assert.strictEqual(restoredDeadline, '2027-01-15', 'The edited deadline should survive a reload');
    var restoredNotes = await page.$eval('#trackerList .tracker-notes', function(el){ return el.value; });
    assert.strictEqual(restoredNotes, 'Submitted essay + 2 references, waiting to hear back.', 'The edited notes should survive a reload');
    var trackBtnStillTracked = await page.$eval('#opp_global-ugrad .opp-track-btn', function(el){ return el.textContent; });
    assert.strictEqual(trackBtnStillTracked, '✓ In my tracker', 'The directory button should still show the tracked state after reload');

    // Removing the curated entry flips its directory button back, and removes only that row.
    var removeBtn = await page.$('#trackerList .tracker-row:first-child [data-remove-id]');
    await removeBtn.click();
    await page.waitForTimeout(50);
    var rowCountAfterRemove = await page.$$eval('#trackerList .tracker-row', function(els){ return els.length; });
    assert.strictEqual(rowCountAfterRemove, 1, 'Removing one entry should leave the other in place');
    var trackBtnAfterRemove = await page.$eval('#opp_global-ugrad .opp-track-btn', function(el){ return el.textContent; });
    assert.strictEqual(trackBtnAfterRemove, '+ Add to my tracker', 'Removing a tracked program should flip its directory button back');
  } finally {
    await page.context().close();
  }
};
