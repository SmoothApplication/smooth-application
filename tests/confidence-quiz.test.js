'use strict';
// Regression test for the "confidence quiz" front door — street-tested feedback asked for "a one
// page quiz test that gives us a result within 2-3 mins" as a low-friction on-ramp ahead of the
// full checklist. This covers: the quiz loading first (consent gate hidden until the applicant gets
// there), scoring producing a result + gap list, the fake-door "notify me" interest capture, quiz
// answers carrying into the corresponding real checklist fields, and the skip-straight-through path
// other tests rely on via helpers.passConsentGate. See docs-gate.test.js for the "two documents"
// page this quiz now leads into (both the quiz's own Continue and its skip link land there, not on
// the consent gate directly).
const assert = require('assert');
const { newPageAt } = require('./helpers');

exports.run = async function(ctx){
  var page = await newPageAt(ctx.browser, '/index.html');
  try {
    await page.waitForSelector('#quizGate');

    // Quiz is the first thing shown; the consent gate underneath starts hidden.
    var quizVisible = await page.$eval('#quizGate', function(el){ return getComputedStyle(el).display !== 'none'; });
    assert.strictEqual(quizVisible, true, 'The quiz should be visible on first load');
    var gateHiddenInitially = await page.$eval('#consentGate', function(el){ return el.style.display === 'none'; });
    assert.strictEqual(gateHiddenInitially, true, 'The consent gate should stay hidden until the quiz is skipped or finished');

    // Stub analytics so quiz_* events can be observed.
    await page.evaluate(function(){
      window.__trackedEvents = [];
      window.goatcounter = { count: function(o){ window.__trackedEvents.push(o.path); } };
    });

    // Answer every question with values chosen to land in the "some gaps" tier and trigger at
    // least one gap message (no passport yet, statements not ready).
    await page.selectOption('#q_quizCountry', 'UK');
    await page.selectOption('#q_quizWork', 'employed');
    await page.selectOption('#q_quizIncome', 'steady');
    await page.selectOption('#q_quizSavings', 'to2m');
    await page.selectOption('#q_quizTravel', 'no');
    await page.selectOption('#q_quizRefusal', 'no');
    await page.selectOption('#q_quizTies', 'some');
    await page.selectOption('#q_quizHost', 'none');
    await page.selectOption('#q_quizPassport', 'no');
    await page.selectOption('#q_quizStatements', 'notyet');

    await page.click('#quizSeeResult');
    await page.waitForSelector('#quizResultPanel', { state: 'visible' });

    var tierText = await page.$eval('#quizResultTier', function(el){ return el.textContent; });
    assert.ok(tierText.length > 0, 'Result tier should render some text');
    var gapText = await page.$eval('#quizGapList', function(el){ return el.textContent; });
    assert.ok(/passport/i.test(gapText), 'Missing-passport gap should be listed, got: ' + gapText);
    assert.ok(/bank statement/i.test(gapText), 'Not-ready-statements gap should be listed, got: ' + gapText);

    var trackedAfterResult = await page.evaluate(function(){ return window.__trackedEvents.slice(); });
    assert.ok(trackedAfterResult.some(function(e){ return e.indexOf('quiz_completed:') === 0; }),
      'Completing the quiz should record a quiz_completed:<tier> event, got: ' + JSON.stringify(trackedAfterResult));

    // "Notify me" opens a mailto draft rather than actually charging anything — just confirm the
    // click is tracked and the href is a mailto (no real payment/backend call).
    await page.click('#quizNotifyBtn');
    var trackedAfterNotify = await page.evaluate(function(){ return window.__trackedEvents.slice(); });
    assert.ok(trackedAfterNotify.indexOf('quiz_notify_me_clicked') !== -1,
      'Clicking notify-me should record quiz_notify_me_clicked, got: ' + JSON.stringify(trackedAfterNotify));

    // Continuing hides the quiz and shows the "two documents" page next (see docs-gate.test.js) —
    // not the consent gate directly. The quiz's country choice is already sitting on the (still
    // hidden) consent gate underneath, ready for when docsGateContinue reveals it.
    await page.click('#quizContinueBtn');
    await page.waitForSelector('#docsGate', { state: 'visible' });
    var quizHiddenAfter = await page.$eval('#quizGate', function(el){ return el.style.display === 'none'; });
    assert.strictEqual(quizHiddenAfter, true, 'Quiz should be hidden after continuing');
    var preselectedCountry = await page.$eval('#gateCountrySelect', function(el){ return el.value; });
    assert.strictEqual(preselectedCountry, 'UK', 'Consent gate should have the quiz-chosen country pre-selected, even while still hidden behind the docs page');

    // The docs page's back link retraces to the quiz — and since hiding a gate never clears its
    // inputs, the applicant's answers should still be sitting there, not reset to blank.
    await page.click('#docsGateBack');
    await page.waitForSelector('#quizGate', { state: 'visible' });
    var workAnswerPreserved = await page.$eval('#q_quizWork', function(el){ return el.value; });
    assert.strictEqual(workAnswerPreserved, 'employed', 'Going back to the quiz should preserve previously-picked answers, not reset them');
    await page.click('#quizContinueBtn');
    await page.waitForSelector('#docsGate', { state: 'visible' });

    await page.click('#docsGateContinue');
    await page.waitForSelector('#consentGate', { state: 'visible' });

    await page.check('#gateAgree', { force: true });
    await page.click('#gateContinue');
    await page.waitForFunction(function(){
      var el = document.getElementById('appWrap');
      return el && el.style.display !== 'none';
    }, { timeout: 5000 });

    var workStatus = await page.$eval('#f_workStatus', function(el){ return el.value; });
    assert.strictEqual(workStatus, 'employed', 'Work status from the quiz should carry into the full checklist');
    var travelledBefore = await page.$eval('#te_firstTime', function(el){ return el.value; });
    assert.strictEqual(travelledBefore, 'no', 'Travel history from the quiz should carry into the full checklist');
    var hasRefusal = await page.$eval('#f_hasRefusal', function(el){ return el.checked; });
    assert.strictEqual(hasRefusal, false, 'No-past-refusal answer from the quiz should carry into the full checklist');
    var hasHost = await page.$eval('#f_hasHost', function(el){ return el.checked; });
    assert.strictEqual(hasHost, false, 'Self-funded answer from the quiz should leave the host checkbox unticked');
  } finally {
    await page.context().close();
  }

  // Part 2: the skip link (used by every other test via helpers.passConsentGate) bypasses only the
  // quiz's own questions — it still lands on the docs page next, with no quiz answers applied.
  var page2 = await newPageAt(ctx.browser, '/index.html');
  try {
    await page2.waitForSelector('#quizSkipLink');
    await page2.click('#quizSkipLink');
    await page2.waitForSelector('#docsGate', { state: 'visible' });
    var quizHiddenAfterSkip = await page2.$eval('#quizGate', function(el){ return el.style.display === 'none'; });
    assert.strictEqual(quizHiddenAfterSkip, true, 'Quiz should be hidden after skipping');
  } finally {
    await page2.context().close();
  }
};
