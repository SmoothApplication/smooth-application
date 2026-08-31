'use strict';
// User feedback: the standalone "Trip length — 6 night(s), Under 6 weeks" row was redundant next to
// the "X night(s) — auto-filled into the financial calculator below" note already shown right under
// the return-date field, so it was removed. This checks it's actually gone (not just hidden), and
// that "Reset everything" — which used to write straight into that now-removed element — still runs
// cleanly instead of throwing.
const assert = require('assert');
const { newPageAt, passConsentGate, goToSessionByPill } = require('./helpers');

exports.run = async function(ctx){
  var page = await newPageAt(ctx.browser, '/index.html');
  var pageErrors = [];
  page.on('pageerror', function(e){ pageErrors.push(String(e)); });
  try {
    await passConsentGate(page);
    await goToSessionByPill(page, 3); // 'Your trip details'

    var lengthDisplayEl = await page.$('#f_lengthDisplay');
    assert.strictEqual(lengthDisplayEl, null, 'The standalone "Trip length" row should no longer exist in the DOM');

    var tripLengthLabelCount = await page.$$eval('label.field', function(els){
      return els.filter(function(el){ return el.textContent.trim() === 'Trip length'; }).length;
    });
    assert.strictEqual(tripLengthLabelCount, 0, 'No field should still be labelled bare "Trip length"');

    // The auto-fill note under Return date is a DIFFERENT element and should be untouched.
    await page.fill('#f_traveldate', '2027-06-01');
    await page.fill('#f_returndate', '2027-06-07');
    await page.waitForTimeout(300);
    var noteText = await page.$eval('#tripLengthNote', function(el){ return el.textContent; });
    assert.ok(/6 night\(s\) — auto-filled into the financial calculator below/.test(noteText),
      'The auto-fill note under Return date should still work, got: "' + noteText + '"');

    await page.fill('#f_appdate', '2027-05-01');
    await page.waitForTimeout(300);

    await page.click('#btnReset'); // dialog auto-accepted by newPageAt
    await page.waitForTimeout(300);

    var traveldateAfterReset = await page.$eval('#f_traveldate', function(el){ return el.value; });
    assert.strictEqual(traveldateAfterReset, '', 'Reset should still clear the travel date');
    assert.deepStrictEqual(pageErrors, [], 'Reset should not throw any page errors (e.g. from the removed #f_lengthDisplay element), got: ' + JSON.stringify(pageErrors));
  } finally {
    await page.context().close();
  }
};
