'use strict';
// User feedback: "Can the system point out where I have not filled before proceeding." Clicking
// "Next →" on an incomplete session already showed a soft "you're only X% done" confirm, but never
// said WHICH field was still empty. It now names the specific missing field(s)/checklist item(s) in
// that same confirm message, and outlines each one in red (reusing the existing invalid-field style)
// with a scroll straight to the first one, so the applicant doesn't have to hunt for it themselves.
const assert = require('assert');
const path = require('path');
const { launchBrowser, PORT } = require('./helpers');

exports.run = async function(ctx){
  var context = await ctx.browser.newContext();
  var page = await context.newPage();
  var dialogMessages = [];
  var nextDialogAction = 'dismiss'; // flip to 'accept' for the later "now complete" check
  page.on('dialog', function(d){
    dialogMessages.push(d.message());
    if (nextDialogAction === 'accept') d.accept(); else d.dismiss();
  });
  try {
    await page.goto('http://127.0.0.1:' + PORT + '/index.html');
    await page.waitForSelector('#gateCountrySelect');
    await page.selectOption('#gateCountrySelect', 'UK');
    await page.check('#gateAgree', { force: true });
    await page.click('#gateContinue');
    await page.waitForFunction(function(){
      var el = document.getElementById('appWrap');
      return el && el.style.display !== 'none';
    }, { timeout: 5000 });

    // Fresh trip session: only the name filled in, everything else still blank. Blur the field first
    // (same reasoning as goToSessionByPill in helpers.js) so the render() triggered on blur settles
    // before the click, instead of racing a mid-rebuild DOM node.
    await page.fill('#f_name', 'Test Applicant');
    await page.evaluate(function(){ document.activeElement && document.activeElement.blur(); });
    await page.waitForTimeout(150);
    await page.click('#sessionFooterNextBtn');
    await page.waitForTimeout(200);

    assert.strictEqual(dialogMessages.length, 1, 'Clicking Next on an incomplete session should trigger the soft-nudge confirm');
    assert.ok(/Still needed:/.test(dialogMessages[0]), 'Confirm message should list what\'s still needed, got: ' + dialogMessages[0]);
    assert.ok(/Main purpose of visit/.test(dialogMessages[0]), 'Confirm message should name the missing purpose field, got: ' + dialogMessages[0]);
    assert.ok(/Planned travel date/.test(dialogMessages[0]), 'Confirm message should name the missing travel date field, got: ' + dialogMessages[0]);

    // Dismissing should keep the applicant on the same (still incomplete) session, with the missing
    // fields visibly outlined right on the page.
    var stillOnTrip = await page.$eval('.session-pill.active', function(el){ return el.getAttribute('data-idx'); });
    assert.strictEqual(stillOnTrip, '0', 'Dismissing the nudge should keep the applicant on the trip session');

    var purposeFlagged = await page.$eval('#f_purpose', function(el){ return el.classList.contains('field-invalid'); });
    assert.strictEqual(purposeFlagged, true, 'The empty "Main purpose of visit" field should be outlined in red');
    var travelDateFlagged = await page.$eval('#f_traveldate', function(el){ return el.classList.contains('field-invalid'); });
    assert.strictEqual(travelDateFlagged, true, 'The empty "Planned travel date" field should be outlined in red');
    var nameFlagged = await page.$eval('#f_name', function(el){ return el.classList.contains('field-invalid'); });
    assert.strictEqual(nameFlagged, false, 'The already-filled name field should NOT be flagged as missing');

    // Fill in the rest of the required trip fields, then Next should advance without any nudge at all.
    await page.selectOption('#f_purpose', { index: 1 });
    await page.fill('#f_traveldate', '2026-12-01');
    await page.fill('#f_returndate', '2026-12-06');
    await page.fill('#f_appdate', '2026-10-01');
    await page.evaluate(function(){ document.activeElement && document.activeElement.blur(); });
    await page.waitForTimeout(200);

    dialogMessages.length = 0;
    await page.click('#sessionFooterNextBtn');
    await page.waitForTimeout(200);
    assert.strictEqual(dialogMessages.length, 0, 'A fully-filled session should advance with no nudge dialog at all');
    var nowOnSession = await page.$eval('.session-pill.active', function(el){ return el.getAttribute('data-idx'); });
    assert.notStrictEqual(nowOnSession, '0', 'Should have actually advanced past the trip session');
  } finally {
    await page.context().close();
  }
};
