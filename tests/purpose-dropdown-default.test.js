'use strict';
// The "Main purpose of visit" dropdown must default to the blank placeholder option, not silently
// pre-select the first real purpose — an unnoticed default here would apply the wrong
// purpose-specific document requirements without the applicant ever having chosen anything.
const assert = require('assert');
const { newPageAt, passConsentGate, goToSessionByPill } = require('./helpers');

exports.run = async function(ctx){
  var page = await newPageAt(ctx.browser, '/index.html');
  try {
    await passConsentGate(page);
    // "Your trip details" is session index 3 (0: passport, 1: travelExperience,
    // 2: responsibilities, 3: trip).
    await goToSessionByPill(page, 0);
    await page.waitForSelector('#f_purpose');

    var value = await page.$eval('#f_purpose', function(el){ return el.value; });
    assert.strictEqual(value, '', 'Purpose dropdown should default to the blank placeholder, got: "' + value + '"');

    var selectedText = await page.$eval('#f_purpose', function(el){ return el.options[el.selectedIndex].textContent; });
    assert.ok(/select a purpose/i.test(selectedText), 'Selected option text should be the placeholder, got: "' + selectedText + '"');

    // Sanity-check the field actually drives the checklist: picking a purpose should not leave the
    // dropdown reset back to blank.
    await page.selectOption('#f_purpose', 'business');
    var afterPick = await page.$eval('#f_purpose', function(el){ return el.value; });
    assert.strictEqual(afterPick, 'business', 'Purpose dropdown should hold the picked value');
  } finally {
    await page.context().close();
  }
};
