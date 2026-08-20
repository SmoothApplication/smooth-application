'use strict';
// User feedback: "I feel the % of progress should also be before or under save to unable the
// applicant have an idea of how far they have gone filling the form" — the fill-progress % used to
// only show up in the pill nav at the TOP of a session, which can be scrolled out of view by the
// time someone reaches the Save/Next buttons at the bottom. It now also shows directly above those
// buttons, and updates live as fields are filled, same as the top one.
const assert = require('assert');
const { newPageAt, passConsentGate, goToSessionByPill } = require('./helpers');

exports.run = async function(ctx){
  var page = await newPageAt(ctx.browser, '/index.html');
  try {
    await passConsentGate(page);
    await goToSessionByPill(page, 2); // 'finance' is session index 2: ['trip','finance2','finance',...]

    var footerPctText = function(){
      return page.$eval('#sessionFooterProgress', function(el){ return el.textContent; }).catch(function(){ return null; });
    };

    // Sits directly above the Save/Next buttons in the footer, not just up in the pill nav.
    var order = await page.$eval('#sessionFooter', function(el){
      var progress = el.querySelector('#sessionFooterProgress');
      var saveBtn = el.querySelector('#sessionSaveBtn');
      if (!progress || !saveBtn) return null;
      var pos = progress.compareDocumentPosition(saveBtn);
      return (pos & Node.DOCUMENT_POSITION_FOLLOWING) ? 'progress-before-save' : 'other';
    });
    assert.strictEqual(order, 'progress-before-save', 'The footer progress line should appear before the Save button');

    var before = await footerPctText();
    assert.ok(before && before.indexOf('0%') !== -1, 'Finance section footer should start at 0% filled, got: ' + before);

    // sessionProgress('finance') counts exactly these 4 fields.
    await page.fill('#fc_flight', '1020762');
    await page.fill('#fc_accom', '60000');
    await page.fill('#fc_transport', '150000');
    await page.fill('#fc_closing', '3000000');

    // No navigation, no blur, no explicit save — the footer line must reflect this immediately, same
    // as the top pill nav already does.
    await page.waitForFunction(function(){
      var el = document.getElementById('sessionFooterProgress');
      return el && el.textContent.indexOf('100%') !== -1;
    }, { timeout: 3000 });

    var after = await footerPctText();
    assert.ok(after.indexOf('100%') !== -1, 'Finance section footer should read 100% filled immediately after typing all 4 fields, got: ' + after);
    assert.ok(/4 of 4/.test(after), 'Should show the raw filled-vs-total count too, got: ' + after);
  } finally {
    await page.context().close();
  }
};
