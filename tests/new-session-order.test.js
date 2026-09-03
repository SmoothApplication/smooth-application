'use strict';
// Locks in the current session structure. This app briefly (one batch) folded 12 top-level sessions
// into 5 merged tabs — later user feedback was that stacking several cards on one long page was
// itself hard to use on mobile ("too much scrolling"), so it was reverted back to one topic per
// session. See the "History" comment above catGroupKey() and getVisibleSessionKeys() in index.html.
const assert = require('assert');
const { newPageAt, passConsentGate } = require('./helpers');

exports.run = async function(ctx){
  var page = await newPageAt(ctx.browser, '/index.html');
  try {
    await passConsentGate(page);
    await page.waitForSelector('.session-pill');

    var titles = await page.$$eval('.session-pill', function(pills){
      return pills.map(function(p){ return (p.getAttribute('title') || '').split(' - ')[0]; });
    });

    // 14 top-level sessions for a typical fresh UK applicant: the 6 fixed topics, then one session
    // per applicable checklist category (5 of the 9 possible categories apply with no answers yet —
    // Identity & application / Financial evidence / Ties to Nigeria / Accommodation & UK host /
    // Travel details — the other 4 are conditional and only add a session once they actually apply),
    // then the always-visible "Funded opportunities" directory (see opportunities-directory.test.js),
    // then review, then a dedicated "Reasons" session last (field feedback: "let it be broken down
    // from Quiz to session 14 why each step was taken" — see reasons-tab.test.js and the
    // getVisibleSessionKeys() comment in index.html for why it's appended last).
    assert.deepStrictEqual(titles, [
      'Validate your International Passport',
      'Travel Experience',
      'Your responsibilities',
      'Your trip details',
      'Income & bank statement analysis',
      'Financial readiness calculator',
      'Identity & application',
      'Financial evidence',
      'Ties to Nigeria',
      'Accommodation & UK host',
      'Travel details',
      'Funded opportunities',
      'Final review',
      'Reasons'
    ], 'Should show exactly these 14 top-level sessions in this order, got: ' + titles.join(' | '));

    // Session 1 (passport) should be the one showing open/current on first load.
    var firstPillActive = await page.$eval('.session-pill[data-idx="0"]', function(el){ return el.classList.contains('active'); });
    assert.strictEqual(firstPillActive, true, '"Validate your International Passport" should be the default landing session');

    // Each of the old merged group's cards is its own independent session again — the "About you"
    // wrapper is gone, so each of these 4 has its own distinct data-session-key.
    var soleCardKeys = ['passport', 'travelExperience', 'responsibilities', 'trip'];
    for (var i = 0; i < soleCardKeys.length; i++){
      var count = await page.$$eval('[data-session-key="'+soleCardKeys[i]+'"]', function(els){ return els.length; });
      assert.strictEqual(count, 1, '"'+soleCardKeys[i]+'" should tag exactly one card, got ' + count);
    }

    // Pills are always freely clickable, even on a completely fresh session where passport starts at
    // 0% complete — street-tested feedback ("why lock the pages, allow us to explore") pushed this
    // away from a hard pill-lock. The 70% readiness threshold still applies, but only to the Next
    // button (see below and session-readiness-gate.test.js).
    var pill2Disabled = await page.$eval('.session-pill[data-idx="1"]', function(el){ return el.disabled; });
    assert.strictEqual(pill2Disabled, false, 'Session 2 pill should be clickable even while session 1 is under 70% complete');
    var pill2Locked = await page.$eval('.session-pill[data-idx="1"]', function(el){ return el.classList.contains('locked'); });
    assert.strictEqual(pill2Locked, false, 'Session 2 pill should not carry a .locked class — pill locking was removed');

    // The section report card should show for a session with real content, explain the gate, and
    // link out to the same WhatsApp/email contact used elsewhere in the app.
    await page.waitForSelector('#sessionReportCard');
    var reportText = await page.$eval('#sessionReportCard', function(el){ return el.textContent; });
    assert.ok(/paused for this section/.test(reportText), 'Report card should explain why Next is paused, got: ' + reportText);
    var waHref = await page.$eval('#sessionReportCard a.btn', function(el){ return el.getAttribute('href'); });
    assert.ok(/^https:\/\/wa\.me\/2349081389969/.test(waHref), 'Report card should link the WhatsApp contact, got: ' + waHref);

    // Next (both the top nav button and the footer button) deliberately stays CLICKABLE while
    // gated — a disabled button can't highlight missing fields, scroll to the report card, or
    // record the block for analytics, so attemptAdvanceSession() does the actual blocking instead
    // (see session-readiness-gate.test.js for that behavior). Pills are never locked at all.
    var navNextDisabled = await page.$eval('#sessionNextBtn', function(el){ return el.disabled; });
    assert.strictEqual(navNextDisabled, false, 'Top "Next" button should stay clickable even under the readiness threshold');
    var footerNextDisabled = await page.$eval('#sessionFooterNextBtn', function(el){ return el.disabled; });
    assert.strictEqual(footerNextDisabled, false, 'Footer "Next" button should stay clickable even under the readiness threshold');

    // Clicking it anyway must not advance the session — the block itself is enforced inside
    // attemptAdvanceSession(), not by disabling the button.
    await page.click('#sessionFooterNextBtn');
    await page.waitForTimeout(200);
    var stillOnPassport = await page.$eval('.session-pill[data-idx="0"]', function(el){ return el.classList.contains('active'); });
    assert.strictEqual(stillOnPassport, true, 'Clicking Next while under the readiness threshold must not advance the session');
  } finally {
    await page.context().close();
  }
};
