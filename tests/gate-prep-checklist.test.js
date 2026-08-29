'use strict';
// Regression test for street-tested feedback (a marketer running the product past real applicants
// around banks/offices in Yaba): "State it clearly that I need my international passport and 3-6
// months downloaded bank statement as we proceed." The "What you'll likely need to gather first"
// list used to be a click-to-expand <details> on the consent gate — easy to miss entirely. It's now
// a plain, always-visible block, so this test asserts the content is on screen with zero interaction
// rather than checking a toggle state.
const assert = require('assert');
const { newPageAt } = require('./helpers');

exports.run = async function(ctx){
  var page = await newPageAt(ctx.browser, '/index.html');
  try {
    await page.waitForSelector('#gateCountrySelect');
    // Default country (UK) loads with the prep list already visible — no click required.
    await page.waitForFunction(function(){
      var el = document.getElementById('gatePrepChecklist');
      return el && el.textContent.trim().length > 0;
    }, { timeout: 3000 });

    var isDetailsEl = await page.$eval('.gate-prep-details', function(el){ return el.tagName.toLowerCase(); });
    assert.strictEqual(isDetailsEl, 'div', 'The prep block should be a plain div, not a collapsible <details>, so it can never be left closed');

    var listVisible = await page.$eval('#gatePrepChecklist', function(el){
      return getComputedStyle(el).display !== 'none' && el.offsetParent !== null;
    });
    assert.strictEqual(listVisible, true, 'The prep checklist should be visible without any click');

    var text = await page.$eval('#gatePrepChecklist', function(el){ return el.textContent; });
    assert.ok(/passport/i.test(text), 'Prep list should mention the passport upfront, got: ' + text);
    assert.ok(/bank statement/i.test(text), 'Prep list should mention bank statements upfront, got: ' + text);

    // Switching country re-populates the same always-visible block (no re-collapsing).
    await page.selectOption('#gateCountrySelect', 'CA');
    await page.waitForTimeout(100);
    var textCA = await page.$eval('#gatePrepChecklist', function(el){ return el.textContent; });
    assert.ok(/passport/i.test(textCA), 'Prep list should still mention the passport after switching country, got: ' + textCA);
  } finally {
    await page.context().close();
  }
};
