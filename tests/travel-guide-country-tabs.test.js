'use strict';
// User feedback: "If you choose NO under travel experience... Advice to Gather travel experience.
// direct with tabs to choose from the following countries. Create Plan visit to Ghana, Kenya,
// Ethiopia, Morocco, South Africa. After clicking any of the countries, redirect it to the steps
// needed." Answering "No" to "Have you travelled outside Nigeria before?" shows 5 country tabs (see
// TE_NO_HISTORY_GUIDES in index.html); clicking one opens that country's entry requirements and
// application steps in a modal.
//
// Update: this originally rendered the guide inline, right under the tabs on the same page — later
// field feedback said that made the Travel Experience page feel cluttered, and pointed back at the
// original ask above ("redirect... to the steps needed", not stack more content on the same
// screen). Moved into a modal (reusing the exact .legal-modal-* pattern the Reasons tab already
// uses) so the page itself stays short and the guide gets its own focused view.
const assert = require('assert');
const { newPageAt, passConsentGate, goToSessionByPill } = require('./helpers');

exports.run = async function(ctx){
  var page = await newPageAt(ctx.browser, '/index.html');
  try {
    await passConsentGate(page);
    await goToSessionByPill(page, 1);
    await page.waitForSelector('#te_firstTime');

    // Before answering, no tabs, and the guide modal stays hidden.
    var tabsBefore = await page.$eval('#teCountryTabs', function(el){ return el.textContent.trim(); });
    assert.strictEqual(tabsBefore, '', 'No country tabs should show before "No" is picked, got: ' + tabsBefore);
    var modalHiddenBefore = await page.$eval('#teCountryGuideModalOverlay', function(el){ return el.hidden; });
    assert.strictEqual(modalHiddenBefore, true, 'Guide modal should start hidden');

    await page.selectOption('#te_firstTime', 'no');
    await page.waitForSelector('#te_noHistoryBox');
    await page.waitForFunction(function(){
      var el = document.getElementById('te_noHistoryBox');
      return el && getComputedStyle(el).display !== 'none';
    }, { timeout: 3000 });

    // All 5 country tabs should now be present, right on the page — the page itself stays short;
    // nothing about the guide content shows here yet.
    var tabLabels = await page.$$eval('.te-country-tab-btn', function(els){ return els.map(function(e){ return e.textContent.trim(); }); });
    assert.deepStrictEqual(tabLabels.sort(), ['Ethiopia','Ghana','Kenya','Morocco','South Africa'].sort(), 'Should show exactly the 5 expected country tabs, got: ' + JSON.stringify(tabLabels));

    // Clicking "Ghana" should open the modal with its steps, and mark it visa-free (ECOWAS).
    await page.click('.te-country-tab-btn[data-country="Ghana"]');
    await page.waitForFunction(function(){
      var el = document.getElementById('teCountryGuideModalOverlay');
      return el && !el.hidden;
    }, { timeout: 3000 });
    var ghanaTitle = await page.$eval('#teCountryGuideModalTitle', function(el){ return el.textContent; });
    assert.strictEqual(ghanaTitle, 'Ghana', 'Modal title should name the selected country, got: ' + ghanaTitle);
    var ghanaText = await page.$eval('#teCountryGuideModalBody', function(el){ return el.textContent; });
    assert.ok(/Visa-free/i.test(ghanaText), 'Ghana guide should mention it is visa-free, got: ' + ghanaText);
    assert.ok(/Yellow Fever/i.test(ghanaText), 'Ghana guide should mention the Yellow Fever requirement, got: ' + ghanaText);

    // The clicked tab should now show as the active/primary button, even after the modal is closed.
    var ghanaActive = await page.$eval('.te-country-tab-btn[data-country="Ghana"]', function(el){ return el.classList.contains('primary'); });
    assert.strictEqual(ghanaActive, true, 'Ghana tab should be marked active/primary once selected');

    // Closing the modal returns to the (still short) Travel Experience page — country tabs still
    // there, nothing about the guide content left showing on the page itself.
    await page.click('#teCountryGuideModalClose');
    var modalHiddenAfterClose = await page.$eval('#teCountryGuideModalOverlay', function(el){ return el.hidden; });
    assert.strictEqual(modalHiddenAfterClose, true, 'Closing should hide the modal again');
    var pageBodyText = await page.$eval('#te_noHistoryBox', function(el){ return el.textContent; });
    assert.ok(!/Yellow Fever/.test(pageBodyText), 'The guide content itself should not leak onto the page behind the modal, got: ' + pageBodyText);

    // Switching to South Africa should replace the modal's content with South Africa's own steps.
    await page.click('.te-country-tab-btn[data-country="South Africa"]');
    await page.waitForFunction(function(){
      var el = document.getElementById('teCountryGuideModalOverlay');
      return el && !el.hidden && /VFS Global/.test(document.getElementById('teCountryGuideModalBody').textContent);
    }, { timeout: 3000 });
    var saTitle = await page.$eval('#teCountryGuideModalTitle', function(el){ return el.textContent; });
    assert.strictEqual(saTitle, 'South Africa', 'Modal title should have switched to South Africa, got: ' + saTitle);
    var saText = await page.$eval('#teCountryGuideModalBody', function(el){ return el.textContent; });
    // Both countries' guides mention Yellow Fever (a real shared requirement), so that's not a
    // useful "did it switch" signal — Ghana being visa-free vs. South Africa requiring one is:
    // mutually exclusive, and proves the modal actually swapped content rather than just re-showing
    // Ghana's under a new title.
    assert.ok(!/Visa-free/i.test(saText), 'Guide should have switched away from Ghana\'s visa-free content, got: ' + saText);
    assert.ok(/Visa required/i.test(saText), 'South Africa guide should say a visa is required, got: ' + saText);
  } finally {
    await page.context().close();
  }
};
