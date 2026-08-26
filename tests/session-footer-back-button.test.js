'use strict';
// User feedback: "add back button after each session." The pill nav at the TOP of a session already
// had a ← Back button, but on a long session it can be scrolled well out of view by the time someone
// reaches the bottom — this adds a matching ← Back button down in the Save/Next footer too (see
// renderSessionFooter in index.html), hidden on the very first session (nothing to go back to).
const assert = require('assert');
const { newPageAt, passConsentGate, goToSessionByPill } = require('./helpers');

exports.run = async function(ctx){
  var page = await newPageAt(ctx.browser, '/index.html');
  try {
    await passConsentGate(page);

    // Session 0 (passport, open by default) — first session, no footer Back button.
    var backOnFirst = await page.$('#sessionFooterBackBtn');
    assert.strictEqual(backOnFirst, null, 'The very first session should NOT show a footer Back button');

    // Session 1 (Travel Experience) — footer Back button should now be present and functional.
    await goToSessionByPill(page, 1);
    await page.waitForSelector('#sessionFooterBackBtn');
    await page.click('#sessionFooterBackBtn');
    await page.waitForFunction(function(){
      var pill = document.querySelector('.session-pill.active');
      return pill && pill.getAttribute('data-idx') === '0';
    }, { timeout: 3000 });
    var activeIdx = await page.$eval('.session-pill.active', function(el){ return el.getAttribute('data-idx'); });
    assert.strictEqual(activeIdx, '0', 'Clicking the footer Back button should return to the previous session');
  } finally {
    await page.context().close();
  }
};
