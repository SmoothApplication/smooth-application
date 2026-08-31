'use strict';
// Direct mobile report, with screenshots from a Redmi phone: the travel-history table (Country
// combobox, 2 date dropdowns, Reason, Days spent, delete button — 5 real columns) didn't fit a
// narrow phone screen "properly seated" — content was cut off past the right edge with no visible
// sign there was more, and the existing no-horizontal-overflow.test.js never actually caught this
// because it checks the 'finance' session (index 5), never visits 'travelExperience' (index 1), and
// never adds a travel-history row — an EMPTY table (just short header text) is nowhere near wide
// enough to overflow; only a populated row full of real inputs is. Fixed by wrapping the table in a
// horizontally-scrollable .cf-table-scroll box (min-width:480px on the table itself) rather than
// letting it silently spill past the page. This test drives both #travelHistoryTable and
// #overstayTable (which got the same wrapper for consistency) at a real narrow-phone width, checks a
// row's inputs are all genuinely reachable, and — the same page-level check
// no-horizontal-overflow.test.js already does elsewhere — that the PAGE itself still never scrolls
// horizontally, confirming the overflow is contained to the table's own scroll box, not leaking out.
const assert = require('assert');
const { newPageAt, passConsentGate, goToSessionByPill, pickTravelCountry } = require('./helpers');

function pageScrollWidth(page){
  return page.evaluate(function(){
    return { scrollWidth: document.documentElement.scrollWidth, clientWidth: document.documentElement.clientWidth };
  });
}

exports.run = async function(ctx){
  // Redmi 15C's own reported viewport width, per the screenshots — a real, currently-shipping
  // narrow-Android width, not just a round number.
  var page = await newPageAt(ctx.browser, '/index.html', { viewport: { width: 360, height: 780 } });
  try {
    await passConsentGate(page);
    await goToSessionByPill(page, 1); // travelExperience
    await page.selectOption('#te_firstTime', 'yes');
    await page.waitForSelector('#btnAddTravelRow');
    await page.click('#btnAddTravelRow');
    await page.waitForSelector('#travelHistoryBody select[data-idx="0"][data-field="dateMonth"]');
    await pickTravelCountry(page, 'travelHistoryBody', 0, 'Spain');
    await page.fill('#travelHistoryBody input[data-idx="0"][data-field="reason"]', 'Tourism');
    await page.fill('#travelHistoryBody input[data-idx="0"][data-field="days"]', '10');

    // The table now genuinely doesn't fit — that's expected and fine, as long as it's contained to
    // its own scroll box (a real scrollable overflow) rather than left to sit clipped/unreachable.
    var travelScroll = await page.$eval('#travelHistoryTable', function(table){
      var wrap = table.closest('.cf-table-scroll');
      return wrap ? { scrollWidth: wrap.scrollWidth, clientWidth: wrap.clientWidth } : null;
    });
    assert.ok(travelScroll, '#travelHistoryTable should sit inside a .cf-table-scroll wrapper');
    assert.ok(travelScroll.scrollWidth > travelScroll.clientWidth,
      'The populated row should genuinely need more width than a 360px phone offers — got scrollWidth ' + travelScroll.scrollWidth + ' vs clientWidth ' + travelScroll.clientWidth);

    // Scrolling the wrapper itself should be enough to reach every column, including the delete
    // button on the far right — nothing should require the whole page to scroll sideways to reach it.
    await page.$eval('#travelHistoryTable', function(table){
      var wrap = table.closest('.cf-table-scroll');
      wrap.scrollLeft = wrap.scrollWidth;
    });
    var deleteBtnVisible = await page.$eval('#travelHistoryBody button.te-remove-row[data-idx="0"]', function(btn){
      var r = btn.getBoundingClientRect();
      var wrapR = btn.closest('.cf-table-scroll').getBoundingClientRect();
      return r.right > wrapR.left && r.left < wrapR.right;
    });
    assert.strictEqual(deleteBtnVisible, true, 'Scrolling the table\'s own box to the end should bring the delete button into view');

    // The whole page must still never scroll horizontally — the overflow is fully contained to the
    // table's own box, exactly like no-horizontal-overflow.test.js already checks elsewhere.
    var pageSizes = await pageScrollWidth(page);
    assert.ok(pageSizes.scrollWidth <= pageSizes.clientWidth + 1,
      'Page should not scroll horizontally even with a populated travel-history row — scrollWidth ' + pageSizes.scrollWidth + ' vs clientWidth ' + pageSizes.clientWidth);

    // The overstay table (fewer columns, but same wrapper for consistency) should also be wrapped.
    await page.check('#te_hasOverstayed', { force: true });
    await page.waitForSelector('#btnAddOverstayRow');
    await page.click('#btnAddOverstayRow');
    await page.waitForSelector('#overstayBody input[data-idx="0"][data-field="days"]');
    var overstayWrapped = await page.$eval('#overstayTable', function(table){ return !!table.closest('.cf-table-scroll'); });
    assert.strictEqual(overstayWrapped, true, '#overstayTable should also sit inside a .cf-table-scroll wrapper');

    var pageSizesAfterOverstay = await pageScrollWidth(page);
    assert.ok(pageSizesAfterOverstay.scrollWidth <= pageSizesAfterOverstay.clientWidth + 1,
      'Page should still not scroll horizontally after adding an overstay row too');
  } finally {
    await page.context().close();
  }
};
