'use strict';
// User feedback: "If you choose NO under travel experience... Advice to Gather travel experience.
// direct with tabs to choose from the following countries. Create Plan visit to Ghana, Kenya,
// Ethiopia, Morocco, South Africa. After clicking any of the countries, redirect it to the steps
// needed." Answering "No" to "Have you travelled outside Nigeria before?" now shows 5 country tabs
// (see TE_NO_HISTORY_GUIDES in index.html); clicking one shows that country's specific entry
// requirements and application steps inline, right there on the page.
const assert = require('assert');
const { newPageAt, passConsentGate, goToSessionByPill } = require('./helpers');

exports.run = async function(ctx){
  var page = await newPageAt(ctx.browser, '/index.html');
  try {
    await passConsentGate(page);
    await goToSessionByPill(page, 1);
    await page.waitForSelector('#te_firstTime');

    // Before answering, no tabs and no guide box content.
    var tabsBefore = await page.$eval('#teCountryTabs', function(el){ return el.textContent.trim(); });
    assert.strictEqual(tabsBefore, '', 'No country tabs should show before "No" is picked, got: ' + tabsBefore);

    await page.selectOption('#te_firstTime', 'no');
    await page.waitForSelector('#te_noHistoryBox');
    await page.waitForFunction(function(){
      var el = document.getElementById('te_noHistoryBox');
      return el && getComputedStyle(el).display !== 'none';
    }, { timeout: 3000 });

    // All 5 country tabs should now be present.
    var tabLabels = await page.$$eval('.te-country-tab-btn', function(els){ return els.map(function(e){ return e.textContent.trim(); }); });
    assert.deepStrictEqual(tabLabels.sort(), ['Ethiopia','Ghana','Kenya','Morocco','South Africa'].sort(), 'Should show exactly the 5 expected country tabs, got: ' + JSON.stringify(tabLabels));

    // No guide shown until a tab is clicked.
    var guideBefore = await page.$eval('#teCountryGuide', function(el){ return el.textContent.trim(); });
    assert.strictEqual(guideBefore, '', 'No guide content should show before a country tab is clicked, got: ' + guideBefore);

    // Clicking "Ghana" should reveal its steps, and mark it visa-free (ECOWAS).
    await page.click('.te-country-tab-btn[data-country="Ghana"]');
    await page.waitForSelector('#teCountryGuide .scan-msg');
    var ghanaText = await page.$eval('#teCountryGuide', function(el){ return el.textContent; });
    assert.ok(/Visa-free/i.test(ghanaText), 'Ghana guide should mention it is visa-free, got: ' + ghanaText);
    assert.ok(/Yellow Fever/i.test(ghanaText), 'Ghana guide should mention the Yellow Fever requirement, got: ' + ghanaText);

    // The clicked tab should now show as the active/primary button.
    var ghanaActive = await page.$eval('.te-country-tab-btn[data-country="Ghana"]', function(el){ return el.classList.contains('primary'); });
    assert.strictEqual(ghanaActive, true, 'Ghana tab should be marked active/primary once selected');

    // Switching to South Africa should replace the guide content with South Africa's own steps.
    await page.click('.te-country-tab-btn[data-country="South Africa"]');
    await page.waitForFunction(function(){
      return /VFS Global/.test(document.getElementById('teCountryGuide').textContent);
    }, { timeout: 3000 });
    var saText = await page.$eval('#teCountryGuide', function(el){ return el.textContent; });
    assert.ok(!/Yellow Fever/.test(saText) || /South Africa/.test(saText), 'Guide should have switched to South Africa, got: ' + saText);
    assert.ok(/Visa required/i.test(saText), 'South Africa guide should say a visa is required, got: ' + saText);
  } finally {
    await page.context().close();
  }
};
