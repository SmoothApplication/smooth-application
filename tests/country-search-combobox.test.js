'use strict';
// User request: make the Travel Experience "Country" field easier to use on mobile by letting
// people type to search instead of scrolling a long native <select>. This covers the combobox
// itself — filtering as you type, keyboard selection, click selection, and the "typed text that
// doesn't match a real country reverts on blur" guard (the grading logic further down keys off
// an exact string match against a fixed country list, so a half-typed value must never stick).
const assert = require('assert');
const { newPageAt, passConsentGate, goToSessionByPill, pickTravelCountry } = require('./helpers');

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

    // Focusing an empty field shows the full list (browsable by tap, same as the old <select>).
    await page.click(inputSel);
    var optionCountOnFocus = await page.$$eval(listSel + ' .country-combo-option', function(els){ return els.length; });
    assert.ok(optionCountOnFocus > 50, 'Focusing the empty field should show the full country list, got ' + optionCountOnFocus + ' options');

    // Typing filters the list to matching countries only.
    await page.fill(inputSel, 'mor');
    await page.waitForFunction(function(sel){
      var opts = document.querySelectorAll(sel + ' .country-combo-option');
      return opts.length > 0 && opts.length < 5;
    }, listSel, { timeout: 3000 });
    var filteredNames = await page.$$eval(listSel + ' .country-combo-option', function(els){
      return els.map(function(el){ return el.getAttribute('data-value'); });
    });
    assert.ok(filteredNames.indexOf('Morocco') !== -1, 'Typing "mor" should list Morocco, got: ' + filteredNames.join(', '));
    assert.ok(filteredNames.every(function(n){ return n.toLowerCase().indexOf('mor') !== -1; }), 'Every listed option should actually match "mor", got: ' + filteredNames.join(', '));

    // Clicking a result commits it and closes the list.
    await page.click(listSel + ' .country-combo-option[data-value="Morocco"]');
    var committedValue = await page.$eval(inputSel, function(el){ return el.value; });
    assert.strictEqual(committedValue, 'Morocco', 'Clicking Morocco should fill the field with "Morocco", got: ' + committedValue);
    var listHiddenAfterClick = await page.$eval(listSel, function(el){ return el.hasAttribute('hidden'); });
    assert.strictEqual(listHiddenAfterClick, true, 'The list should close after picking a country');

    // Keyboard selection: focus, type to narrow to one match, Enter commits it.
    await page.click(inputSel);
    await page.fill(inputSel, 'ken');
    await page.waitForFunction(function(sel){
      return document.querySelectorAll(sel + ' .country-combo-option').length === 1;
    }, listSel, { timeout: 3000 });
    await page.keyboard.press('Enter');
    var keyboardCommitted = await page.$eval(inputSel, function(el){ return el.value; });
    assert.strictEqual(keyboardCommitted, 'Kenya', 'Enter on a single filtered match should commit it, got: ' + keyboardCommitted);

    // Typing garbage that matches nothing, then clicking away, reverts to the last valid value
    // instead of saving unusable text (which would silently break the EU/African-country grading
    // further down, since that compares this value with exact string equality).
    await page.click(inputSel);
    await page.fill(inputSel, 'Not A Real Country');
    var emptyStateVisible = await page.$eval(listSel, function(el){ return el.textContent.indexOf('No matching country') !== -1; });
    assert.strictEqual(emptyStateVisible, true, 'Typing an unmatched country should show the "no matching country" state');
    await page.click('#te_hasOverstayed', { force: true }); // click elsewhere to blur
    await page.waitForFunction(function(sel){
      return document.querySelector(sel).value === 'Kenya';
    }, inputSel, { timeout: 3000 });
    var revertedValue = await page.$eval(inputSel, function(el){ return el.value; });
    assert.strictEqual(revertedValue, 'Kenya', 'Blurring with unmatched text should revert to the last valid country, got: ' + revertedValue);

    // The overstay table's country field uses the exact same combobox — spot-check it works there
    // too rather than assuming, since it's a second, separately-wired instance.
    await page.click('#btnAddOverstayRow');
    await pickTravelCountry(page, 'overstayBody', 0, 'Ghana');
    var overstayValue = await page.$eval('#overstayBody input[data-idx="0"][data-field="country"]', function(el){ return el.value; });
    assert.strictEqual(overstayValue, 'Ghana', 'The overstay table\'s country combobox should work the same way, got: ' + overstayValue);
  } finally {
    await page.context().close();
  }
};
