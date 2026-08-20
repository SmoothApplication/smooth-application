'use strict';
// User feedback: "the pages are too long" — scoped to individual sessions in general. Same
// "collapse once done" pattern already used for the inflow-explanation boxes: a checklist item
// tidies itself away to a one-line summary a moment after it's ticked, and always snaps straight
// back open the instant it's unticked. See wireChecklistItem/collapseChecklistItem/
// expandChecklistItem in index.html.
const assert = require('assert');
const { newPageAt, passConsentGate, goToSessionByPill } = require('./helpers');

exports.run = async function(ctx){
  var page = await newPageAt(ctx.browser, '/index.html');
  try {
    await passConsentGate(page);

    // "photo" is a plain checkbox item (no file upload) under Identity & application, session
    // index 3 (0: trip, 1: finance2, 2: finance, 3: cat:Identity & application) — same session
    // used by the passport-repetition-collapse test.
    await goToSessionByPill(page, 3);
    await page.waitForSelector('#item_photo');

    var collapsedBefore = await page.$eval('#item_photo', function(el){ return el.classList.contains('collapsed'); });
    assert.strictEqual(collapsedBefore, false, 'Should not start collapsed before it is ticked');
    var tipVisibleBefore = await page.$('#item_photo .item-tip');
    assert.ok(tipVisibleBefore, 'Full item (with its tip) should be showing before it is ticked');

    // Tick it — should NOT collapse immediately (long enough to register as a deliberate action).
    await page.check('#chk_photo', { force: true });
    var collapsedRightAfter = await page.$eval('#item_photo', function(el){ return el.classList.contains('collapsed'); });
    assert.strictEqual(collapsedRightAfter, false, 'Should still be expanded right after ticking, not collapse instantly');

    // ...then tidies itself away a moment later.
    await page.waitForFunction(function(){
      var el = document.getElementById('item_photo');
      return el && el.classList.contains('collapsed');
    }, { timeout: 3000 });

    var collapsedRow = await page.$('#itemcollapsed_photo');
    assert.ok(collapsedRow, 'Collapsed row should exist once tidied away');
    var editLinkText = await page.$eval('#itemcollapsed_photo .explain-edit-link', function(el){ return el.textContent; });
    assert.ok(/Edit/i.test(editLinkText), 'Collapsed row should show an Edit affordance, got: "' + editLinkText + '"');
    var stillCheckedCollapsed = await page.$eval('#chk_photo', function(el){ return el.checked; });
    assert.strictEqual(stillCheckedCollapsed, true, 'Checkbox should still read checked once collapsed');

    // Clicking "Edit" reopens the full item.
    await page.click('#itemcollapsed_photo .explain-edit-link');
    var collapsedAfterEdit = await page.$eval('#item_photo', function(el){ return el.classList.contains('collapsed'); });
    assert.strictEqual(collapsedAfterEdit, false, 'Clicking Edit should reopen the full item');
    var tipVisibleAfterEdit = await page.$('#item_photo .item-tip');
    assert.ok(tipVisibleAfterEdit, 'Full item (with its tip) should be showing again after Edit');
    var stillCheckedAfterEdit = await page.$eval('#chk_photo', function(el){ return el.checked; });
    assert.strictEqual(stillCheckedAfterEdit, true, 'Re-opening via Edit should not lose the checked state');

    // Unticking (from the expanded view) should never auto-collapse — nothing to tidy away.
    await page.uncheck('#chk_photo', { force: true });
    await page.waitForTimeout(1500);
    var collapsedAfterUncheck = await page.$eval('#item_photo', function(el){ return el.classList.contains('collapsed'); });
    assert.strictEqual(collapsedAfterUncheck, false, 'An unticked item should never collapse');

    // Re-tick, let it collapse again, then untick directly from the collapsed row's own checkbox —
    // should snap straight back open with no delay.
    await page.check('#chk_photo', { force: true });
    await page.waitForFunction(function(){
      var el = document.getElementById('item_photo');
      return el && el.classList.contains('collapsed');
    }, { timeout: 3000 });
    await page.uncheck('#chk_photo', { force: true });
    var collapsedAfterUncheckFromRow = await page.$eval('#item_photo', function(el){ return el.classList.contains('collapsed'); });
    assert.strictEqual(collapsedAfterUncheckFromRow, false, 'Unticking from the collapsed row should snap straight back open');
    var tipVisibleAfterUncheckFromRow = await page.$('#item_photo .item-tip');
    assert.ok(tipVisibleAfterUncheckFromRow, 'Full item should be showing again after unticking from the collapsed row');
  } finally {
    await page.context().close();
  }
};
