'use strict';
// The transport/sightseeing/currency "helper" panels are meant to collapse back down once their
// estimate has actually been applied, showing a one-line summary + "edit this estimate" link
// instead of leaving the full form sitting open and taking up space. Exercises the currency
// helper end-to-end as a representative case (all three share the same collapse pattern).
const assert = require('assert');
const { newPageAt, passConsentGate, goToSessionByPill } = require('./helpers');

exports.run = async function(ctx){
  var page = await newPageAt(ctx.browser, '/index.html');
  try {
    await passConsentGate(page);
    await goToSessionByPill(page, 1); // 'Financial readiness' holds the cost-calculator card, which has the currency helper.

    var panelHiddenInitially = await page.$eval('#currencyHelper', function(el){ return el.style.display === 'none'; });
    assert.strictEqual(panelHiddenInitially, true, 'Currency helper panel should start collapsed');

    await page.click('#btnCurrencyHelper');
    var panelOpenAfterClick = await page.$eval('#currencyHelper', function(el){ return el.style.display !== 'none'; });
    assert.strictEqual(panelOpenAfterClick, true, 'Currency helper panel should open on click');

    await page.fill('#cur_amount', '2000');
    await page.waitForSelector('#btnUseCurrencyEstimate');
    await page.click('#btnUseCurrencyEstimate');

    await page.waitForFunction(function(){
      var panel = document.getElementById('currencyHelper');
      var note = document.getElementById('currencyHelperCollapsedNote');
      return panel && panel.style.display === 'none' && note && note.style.display !== 'none';
    }, { timeout: 3000 });

    var noteText = await page.$eval('#currencyHelperCollapsedNote', function(el){ return el.textContent; });
    assert.ok(/added/i.test(noteText) && /edit this estimate/i.test(noteText), 'Collapsed note should summarize what was added and offer to edit it, got: "' + noteText + '"');

    var forexValue = await page.$eval('#fc_forexSavings', function(el){ return el.value; });
    assert.ok(parseInt(forexValue.replace(/[^0-9]/g, ''), 10) > 0, 'Foreign currency savings field should be populated after using the helper, got: "' + forexValue + '"');

    // Re-opening via the "edit this estimate" link should bring the form back and hide the note again.
    await page.click('#reopenCurrencyHelper');
    await page.waitForFunction(function(){
      var panel = document.getElementById('currencyHelper');
      var note = document.getElementById('currencyHelperCollapsedNote');
      return panel && panel.style.display !== 'none' && note && note.style.display === 'none';
    }, { timeout: 3000 });
  } finally {
    await page.context().close();
  }
};
