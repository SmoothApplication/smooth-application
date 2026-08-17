'use strict';
const assert = require('assert');
const { newPageAt, passConsentGate } = require('./helpers');

exports.run = async function(ctx){
  var page = await newPageAt(ctx.browser, '/index.html');
  try {
    // The toggle lives in the app header, inside #appWrap, which stays hidden until the consent
    // gate is passed.
    await passConsentGate(page);
    await page.waitForSelector('#themeToggle');

    var initialLabel = await page.$eval('#themeToggle', function(el){ return el.textContent; });

    // No data-theme attribute is set until the first click, so any click before "dark" is assumed
    // non-dark — the first click always lands on 'dark'.
    await page.click('#themeToggle');
    var afterFirstClick = await page.evaluate(function(){ return document.documentElement.getAttribute('data-theme'); });
    var labelAfterFirstClick = await page.$eval('#themeToggle', function(el){ return el.textContent; });
    assert.strictEqual(afterFirstClick, 'dark', 'First click should switch to dark mode, got: ' + afterFirstClick);
    assert.notStrictEqual(labelAfterFirstClick, initialLabel, 'Toggle button label should change after clicking');
    assert.ok(/light mode/i.test(labelAfterFirstClick), 'Button should offer to switch to light mode while in dark mode, got: "' + labelAfterFirstClick + '"');

    await page.click('#themeToggle');
    var afterSecondClick = await page.evaluate(function(){ return document.documentElement.getAttribute('data-theme'); });
    var labelAfterSecondClick = await page.$eval('#themeToggle', function(el){ return el.textContent; });
    assert.strictEqual(afterSecondClick, 'light', 'Second click should switch back to light mode, got: ' + afterSecondClick);
    assert.ok(/dark mode/i.test(labelAfterSecondClick), 'Button should offer to switch to dark mode while in light mode, got: "' + labelAfterSecondClick + '"');

    // A third click should alternate back to dark, confirming the toggle keeps working (not a
    // one-shot fluke).
    await page.click('#themeToggle');
    var afterThirdClick = await page.evaluate(function(){ return document.documentElement.getAttribute('data-theme'); });
    assert.strictEqual(afterThirdClick, 'dark', 'Third click should alternate back to dark mode, got: ' + afterThirdClick);
  } finally {
    await page.context().close();
  }
};
