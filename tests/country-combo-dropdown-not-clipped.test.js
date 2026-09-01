'use strict';
// Real user report: "when I type the country, the dropdown menu drops down and I cannot see the
// list of the country." Root cause: .cf-table-scroll (added earlier to fix the travel-history
// table's horizontal overflow on mobile — see its own CSS comment) sets overflow-x:auto, but per
// the CSS spec that forces its computed overflow-y to 'auto' too, not just visually on mobile —
// silently turning it into a vertical clipping box as well. The country dropdown was a normal
// position:absolute descendant of that container, so it got clipped down to a couple of pixels
// the moment it had more than a tiny handful of matches (which is most of the time — an empty
// query shows 50+ countries). Fixed by making the list position:fixed, placed from the input's
// own getBoundingClientRect() when it opens, escaping the clipping ancestor entirely.
//
// A plain Playwright .click() on a clipped option isn't a reliable regression test here — Playwright
// auto-scrolls an element's scrollable ancestors into view before clicking, which can silently paper
// over exactly this kind of clipping bug. This instead asserts the actual visual symptom directly:
// the open list's real rendered height (not just its DOM child count) and its CSS position.
const assert = require('assert');
const { newPageAt, passConsentGate, goToSessionByPill } = require('./helpers');

exports.run = async function(ctx){
  var page = await newPageAt(ctx.browser, '/index.html');
  try {
    await passConsentGate(page);
    await goToSessionByPill(page, 1);
    await page.waitForSelector('#te_firstTime');
    await page.selectOption('#te_firstTime', 'yes');
    await page.click('#btnAddTravelRow');

    var inputSel = '#travelHistoryBody input[data-idx="0"][data-field="country"]';
    var listSel = '#travelHistoryBody .country-combo-list[data-idx="0"]';
    await page.waitForSelector(inputSel);

    // Focusing the empty field opens the full 50+ country list — this is the case that made the
    // clipping obvious in the field report (a single filtered match could accidentally still fall
    // inside the clipped sliver, but the full list never could).
    await page.click(inputSel);
    await page.waitForFunction(function(sel){
      var opts = document.querySelectorAll(sel + ' .country-combo-option');
      return opts.length > 50;
    }, listSel, { timeout: 3000 });

    var listBox = await page.$eval(listSel, function(el){
      var r = el.getBoundingClientRect();
      var cs = getComputedStyle(el);
      return { height: r.height, position: cs.position };
    });
    assert.strictEqual(listBox.position, 'fixed', 'The open dropdown should be position:fixed so it escapes .cf-table-scroll\'s clipping, got: ' + listBox.position);
    assert.ok(listBox.height > 100, 'The open dropdown with 50+ matches should render at a real height, not be clipped down to a sliver — got ' + listBox.height + 'px');

    // End-to-end: "Other" always sorts to the very end of the list (see sortedMatches), so picking
    // it specifically exercises an option that would have sat inside the clipped-away region.
    await page.click(listSel + ' .country-combo-option[data-value="Other"]');
    var committedValue = await page.$eval(inputSel, function(el){ return el.value; });
    assert.strictEqual(committedValue, 'Other', 'Picking the last option in the list should still commit correctly, got: ' + committedValue);
  } finally {
    await page.context().close();
  }
};
