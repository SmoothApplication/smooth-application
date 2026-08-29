'use strict';
// User request: "If any applicant did not get 70% in [a section], they should not proceed to the
// next session — it can confuse the applicant to have access to other sessions." This is a genuine
// hard block on the "Next" button (not the older dismissible "proceed anyway?" nudge, which still
// applies between 70% and 100%) — see attemptAdvanceSession() in index.html.
//
// Session PILLS used to also hard-lock (disabled + a lock icon) until the current session cleared
// the threshold. That was removed after street-tested feedback (a marketer running the product past
// real applicants around banks/offices in Yaba) pushed back hard the other way: "why lock the pages,
// allow us to explore" — being unable to even preview an upcoming session read as the same
// restrictive, form-like experience applicants already have a phobia of. Pills are now always
// clickable; only the Next button's gate (tested below) remains.
//
// The Next buttons themselves deliberately stay CLICKABLE while gated, rather than disabled — an
// earlier version of this feature disabled them outright, which silently turned the whole
// hard-block experience (highlighting missing fields, scrolling to the report card, recording the
// block) into dead code, since a disabled element never fires a real click event in the first place.
const assert = require('assert');
const { newPageAt, passConsentGate } = require('./helpers');

exports.run = async function(ctx){
  var page = await newPageAt(ctx.browser, '/index.html');
  try {
    await passConsentGate(page);
    await page.waitForSelector('#f_passportNumber');

    // Stub the analytics transport so the two new tracked events (session_gate_blocked,
    // session_gate_help_clicked) can be observed without depending on network access to GoatCounter.
    await page.evaluate(function(){
      window.__trackedEvents = [];
      window.goatcounter = { count: function(o){ window.__trackedEvents.push(o.path); } };
    });

    // Fresh session: passport is 0% filled, well under 70%. The pill is freely clickable (see file
    // header), but Next should still hard-block and run the block logic.
    var pill2Clickable = await page.$eval('.session-pill[data-idx="1"]', function(el){ return !el.disabled; });
    assert.strictEqual(pill2Clickable, true, 'Session 2 pill should always be clickable, even while session 1 is under 70% complete');
    var footerNextBefore = await page.$eval('#sessionFooterNextBtn', function(el){ return el.disabled; });
    assert.strictEqual(footerNextBefore, false, 'Footer Next should stay clickable while gated, so the block logic actually runs');

    // Clicking Next must not navigate anywhere, must outline the missing fields in red, and must
    // record a session_gate_blocked event.
    await page.click('#sessionFooterNextBtn');
    await page.waitForTimeout(200);
    var stillOnPassport = await page.$eval('.session-pill[data-idx="0"]', function(el){ return el.classList.contains('active'); });
    assert.strictEqual(stillOnPassport, true, 'A gated Next click must not advance the session');
    var passportNumberFlagged = await page.$eval('#f_passportNumber', function(el){ return el.classList.contains('field-invalid'); });
    assert.strictEqual(passportNumberFlagged, true, 'The empty passport number field should be outlined in red after the blocked click');
    var trackedAfterBlock = await page.evaluate(function(){ return window.__trackedEvents.slice(); });
    assert.ok(trackedAfterBlock.indexOf('session_gate_blocked:passport') !== -1,
      'A blocked Next click should record session_gate_blocked:passport, got: ' + JSON.stringify(trackedAfterBlock));

    // Clicking the WhatsApp/email links in the gated report card should record which channel was used.
    await page.click('.session-report-gate-links a.btn');
    await page.waitForTimeout(150);
    var trackedAfterWa = await page.evaluate(function(){ return window.__trackedEvents.slice(); });
    assert.ok(trackedAfterWa.indexOf('session_gate_help_clicked:whatsapp') !== -1,
      'Clicking the WhatsApp link should record session_gate_help_clicked:whatsapp, got: ' + JSON.stringify(trackedAfterWa));

    // Fill in both passport fields — that's 2 of 2, 100% for this session, comfortably over 70%.
    await page.fill('#f_passportNumber', 'B50357981');
    await page.fill('#f_passportExpiry', '2030-01-01');
    await page.waitForFunction(function(){
      var el = document.getElementById('sessionReportCard');
      return el && /Congratulations/.test(el.textContent);
    }, { timeout: 3000 });

    // The now-filled passport number should no longer be flagged.
    var passportNumberFlaggedAfter = await page.$eval('#f_passportNumber', function(el){ return el.classList.contains('field-invalid'); });
    assert.strictEqual(passportNumberFlaggedAfter, false, 'A filled field should no longer be outlined once complete');

    // The report card should now read as "ready", not show the gated help block. Once a session
    // hits 100% it shows a "🎉 Congratulations" callout (see sessionReportCardHtml) rather than
    // the old plain "Next is unlocked" line — that's what "ready" looks like now.
    var reportText = await page.$eval('#sessionReportCard', function(el){ return el.textContent; });
    assert.ok(!/paused for this section/.test(reportText), 'Report card should no longer show the gated message once ready, got: ' + reportText);

    // Next should now genuinely work, and should NOT record another session_gate_blocked event
    // (advancing normally still fires its own unrelated session_view event, which is expected).
    await page.click('#sessionFooterNextBtn');
    await page.waitForFunction(function(){
      var pill = document.querySelector('.session-pill[data-idx="1"]');
      return pill && pill.classList.contains('active');
    }, { timeout: 3000 });
    var trackedAfterAdvance = await page.evaluate(function(){ return window.__trackedEvents.slice(); });
    var gateBlockedCount = trackedAfterAdvance.filter(function(name){ return name.indexOf('session_gate_blocked:') === 0; }).length;
    assert.strictEqual(gateBlockedCount, 1, 'A successful advance should not record any new gate-blocked event, got: ' + JSON.stringify(trackedAfterAdvance));

    // Going back to session 1 must always work.
    await page.click('#sessionBackBtn');
    var backOnPassport = await page.$eval('.session-pill[data-idx="0"]', function(el){ return el.classList.contains('active'); });
    assert.strictEqual(backOnPassport, true, 'Back should always reach an earlier session');
  } finally {
    await page.context().close();
  }
};
