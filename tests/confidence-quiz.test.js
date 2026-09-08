'use strict';
// Regression test for the "confidence quiz" front door — street-tested feedback asked for "a one
// page quiz test that gives us a result within 2-3 mins" as a low-friction on-ramp ahead of the
// full checklist. This covers: the quiz loading first (consent gate hidden until the applicant gets
// there), the #quizIntro screen (added after GoatCounter data showed ~87% of visits never started a
// session — Start and Skip now both visible with zero scrolling, before any question is asked), the
// 2-step paged quiz (originally 4 — field feedback said that read as too long) that replaced the old
// single stacked form, scoring producing a result + gap list, the fake-door "notify me" interest
// capture, quiz answers carrying into the corresponding real checklist fields, and the
// skip-straight-through path other tests rely on via helpers.passConsentGate. See docs-gate.test.js
// for the "two documents" page this quiz now leads into (both the quiz's own Continue and its skip
// link land there, not on the consent gate directly).
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

    // The intro screen is what actually loads first — states the payoff and that it's free, with
    // Start and Skip both visible with no scrolling — the quiz's own questions stay hidden until
    // Start is clicked.
    var introVisible = await page.$eval('#quizIntro', function(el){ return getComputedStyle(el).display !== 'none'; });
    assert.strictEqual(introVisible, true, 'The intro screen should be visible on first load');
    var formHiddenInitially = await page.$eval('#quizFormWrap', function(el){ return getComputedStyle(el).display === 'none'; });
    assert.strictEqual(formHiddenInitially, true, 'The paged quiz form should stay hidden until Start is clicked');

    // Stub analytics so quiz_* events can be observed.
    await page.evaluate(function(){
      window.__trackedEvents = [];
      window.goatcounter = { count: function(o){ window.__trackedEvents.push(o.path); } };
    });

    await page.click('#quizStartBtn');
    await page.waitForSelector('#quizFormWrap', { state: 'visible' });
    var introHiddenAfterStart = await page.$eval('#quizIntro', function(el){ return getComputedStyle(el).display === 'none'; });
    assert.strictEqual(introHiddenAfterStart, true, 'Starting the quiz should hide the intro screen');
    var trackedAfterStart = await page.evaluate(function(){ return window.__trackedEvents.slice(); });
    assert.ok(trackedAfterStart.indexOf('quiz_start') !== -1, 'Clicking Start should record a quiz_start event, got: ' + JSON.stringify(trackedAfterStart));

    // Answer every question with values chosen to land in the "some gaps" tier and trigger at
    // least one gap message (no passport yet, statements not ready) — paging through both steps,
    // since each step's questions are hidden until its own step is showing. 10 questions across 2
    // steps of 5 (originally 4 steps — field feedback said that read as too long for a "quick" check).
    var stepLabel = await page.$eval('#quizProgressLabel', function(el){ return el.textContent; });
    assert.strictEqual(stepLabel, 'Step 1 of 2', 'Should start on step 1 of 2, got: ' + stepLabel);
    var backHiddenOnStep1 = await page.$eval('#quizBackBtn', function(el){ return getComputedStyle(el).display === 'none'; });
    assert.strictEqual(backHiddenOnStep1, true, 'Back button should be hidden on the first step');

    await page.selectOption('#q_quizCountry', 'UK');
    await page.selectOption('#q_quizWork', 'employed');
    await page.selectOption('#q_quizIncome', 'steady');
    await page.selectOption('#q_quizSavings', 'to2m');
    await page.selectOption('#q_quizTravel', 'no');
    await page.click('#quizNextBtn');
    await page.waitForFunction(function(){ return document.getElementById('quizProgressLabel').textContent === 'Step 2 of 2'; });

    // Last step: Next is gone, "See my result" takes its place — and Back still works, preserving
    // earlier answers rather than resetting them.
    var nextHiddenOnLastStep = await page.$eval('#quizNextBtn', function(el){ return getComputedStyle(el).display === 'none'; });
    assert.strictEqual(nextHiddenOnLastStep, true, 'Next button should be hidden on the last step');
    await page.selectOption('#q_quizTies', 'few');
    await page.click('#quizBackBtn');
    await page.waitForFunction(function(){ return document.getElementById('quizProgressLabel').textContent === 'Step 1 of 2'; });
    var savingsPreserved = await page.$eval('#q_quizSavings', function(el){ return el.value; });
    assert.strictEqual(savingsPreserved, 'to2m', 'Going back a step should preserve the previously-picked answer, not reset it');
    await page.click('#quizNextBtn');
    await page.waitForFunction(function(){ return document.getElementById('quizProgressLabel').textContent === 'Step 2 of 2'; });
    var tiesPreserved = await page.$eval('#q_quizTies', function(el){ return el.value; });
    assert.strictEqual(tiesPreserved, 'few', 'Answers on the step just left should also be preserved, not reset');

    await page.selectOption('#q_quizRefusal', 'no');
    await page.selectOption('#q_quizHost', 'none');
    await page.selectOption('#q_quizPassport', 'no');
    await page.selectOption('#q_quizStatements', 'notyet');

    await page.click('#quizSeeResult');
    await page.waitForSelector('#quizResultPanel', { state: 'visible' });

    // Field feedback: the result should be its own page after the quiz, not the questions still
    // sitting there above it — the form must actually be hidden, not just scrolled past.
    var formHiddenAtResult = await page.$eval('#quizFormWrap', function(el){ return getComputedStyle(el).display === 'none'; });
    assert.strictEqual(formHiddenAtResult, true, 'The quiz questions should be hidden once the result page shows');

    var tierText = await page.$eval('#quizResultTier', function(el){ return el.textContent; });
    assert.ok(tierText.length > 0, 'Result tier should render some text');
    var gapText = await page.$eval('#quizGapList', function(el){ return el.textContent; });
    assert.ok(/passport/i.test(gapText), 'Missing-passport gap should be listed, got: ' + gapText);
    assert.ok(/bank statement/i.test(gapText), 'Not-ready-statements gap should be listed, got: ' + gapText);

    var trackedAfterResult = await page.evaluate(function(){ return window.__trackedEvents.slice(); });
    assert.ok(trackedAfterResult.some(function(e){ return e.indexOf('quiz_completed:') === 0; }),
      'Completing the quiz should record a quiz_completed:<tier> event, got: ' + JSON.stringify(trackedAfterResult));

    // "Get full report" — the on-screen list caps at the 3 "biggest gaps" (quizGapMessages), but
    // this answer set actually matches a 4th check too (ties === 'few', which never gets reached in
    // the capped loop since 3 earlier checks already matched first). The email should carry ALL of
    // them (quizAllGapMessages, uncapped), proving it's genuinely "full" and not just a copy of
    // what's already on screen. Real <a href>, kept live as the applicant types their email in
    // (updateQuizReasonsEmailHref), same reasoning as the WhatsApp/email notify links checked below.
    var tiesPhraseOnScreen = /Strengthening your documented ties/.test(gapText);
    assert.strictEqual(tiesPhraseOnScreen, false, 'The on-screen capped gap list should NOT include the 4th matching reason (ties), got: ' + gapText);
    // Before typing an email: falls back to an unaddressed draft, same as before this field existed.
    var emailReasonsHref = await page.$eval('#quizEmailReasonsBtn', function(el){ return el.getAttribute('href'); });
    assert.ok(/^mailto:\?subject=/.test(emailReasonsHref), 'Full-report link should default to an unaddressed mailto before an email is typed, got: ' + emailReasonsHref);
    var emailReasonsBody = decodeURIComponent(emailReasonsHref.split('&body=')[1] || '');
    assert.ok(/passport/i.test(emailReasonsBody), 'Full-report email should include the missing-passport reason, got: ' + emailReasonsBody.slice(0, 400));
    assert.ok(/bank statement/i.test(emailReasonsBody), 'Full-report email should include the not-ready-statements reason, got: ' + emailReasonsBody.slice(0, 400));
    assert.ok(/Strengthening your documented ties/.test(emailReasonsBody), 'Full-report email should include the ties reason the on-screen list left out, got: ' + emailReasonsBody);
    assert.ok(/Continue with the full checklist/.test(emailReasonsBody), 'Full-report email should link back to the checklist, got: ' + emailReasonsBody.slice(-300));

    // Typing an email into the field should pre-fill it as the draft's "To" address, live, without
    // needing a click first.
    await page.fill('#quizReasonsEmail', 'adaeze.okafor@gmail.com');
    await page.waitForFunction(function(){
      var href = document.getElementById('quizEmailReasonsBtn').getAttribute('href');
      return /^mailto:adaeze\.okafor@gmail\.com\?subject=/.test(href);
    }, { timeout: 3000 });
    // A half-typed, not-yet-a-real-address value should fall back to unaddressed rather than handing
    // the mail app something malformed.
    await page.fill('#quizReasonsEmail', 'adaeze.okafor@');
    await page.waitForFunction(function(){
      return /^mailto:\?subject=/.test(document.getElementById('quizEmailReasonsBtn').getAttribute('href'));
    }, { timeout: 3000 });
    await page.fill('#quizReasonsEmail', 'adaeze.okafor@gmail.com');
    await page.waitForFunction(function(){
      return /^mailto:adaeze\.okafor@gmail\.com\?subject=/.test(document.getElementById('quizEmailReasonsBtn').getAttribute('href'));
    }, { timeout: 3000 });

    await page.evaluate(function(){
      document.getElementById('quizEmailReasonsBtn').dispatchEvent(new MouseEvent('click', {bubbles:true, cancelable:true}));
    });
    var trackedAfterEmailReasons = await page.evaluate(function(){ return window.__trackedEvents.slice(); });
    assert.ok(trackedAfterEmailReasons.indexOf('quiz_email_reasons_clicked') !== -1,
      'Clicking "Get full report" should record quiz_email_reasons_clicked, got: ' + JSON.stringify(trackedAfterEmailReasons));

    // "Notify me" opens WhatsApp (primary) or email (secondary) rather than actually charging
    // anything — real <a> links, not a JS redirect, since a mailto-only JS redirect was reported to
    // silently do nothing on a phone with no mail app configured. Check the hrefs are correctly
    // built, and that a click is tracked, without triggering a real external navigation: a genuine
    // Playwright .click() on a target="_blank" link would actually try to open WhatsApp/mail, so
    // this dispatches a synthetic click instead — enough to fire the tracking listener, not enough
    // to trigger the link's own default navigation.
    var waHref = await page.$eval('#quizNotifyWhatsApp', function(el){ return el.getAttribute('href'); });
    assert.ok(/^https:\/\/wa\.me\/2349081389969\?text=/.test(waHref), 'WhatsApp notify link should point at wa.me with a prefilled message, got: ' + waHref);
    var emailHref = await page.$eval('#quizNotifyEmail', function(el){ return el.getAttribute('href'); });
    assert.ok(/^mailto:lalasionline@gmail\.com\?subject=/.test(emailHref), 'Email notify link should be a real mailto, got: ' + emailHref);

    await page.evaluate(function(){
      document.getElementById('quizNotifyWhatsApp').dispatchEvent(new MouseEvent('click', {bubbles:true, cancelable:true}));
    });
    var trackedAfterNotify = await page.evaluate(function(){ return window.__trackedEvents.slice(); });
    assert.ok(trackedAfterNotify.indexOf('quiz_notify_me_clicked:whatsapp') !== -1,
      'Clicking the WhatsApp notify link should record quiz_notify_me_clicked:whatsapp, got: ' + JSON.stringify(trackedAfterNotify));

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
    // One more screen now sits between country selection and the checklist — "Where are you in the
    // process?" (see #situationGate in index.html) — before appWrap shows.
    await page.waitForSelector('#situationOptFresh', { state: 'visible' });
    await page.click('#situationOptFresh');
    await page.click('#situationContinue');
    await page.waitForFunction(function(){
      var el = document.getElementById('appWrap');
      return el && el.style.display !== 'none';
    }, { timeout: 5000 });

    var workStatus = await page.$eval('#f_workStatus', function(el){ return el.value; });
    assert.strictEqual(workStatus, 'employed', 'Work status from the quiz should carry into the full checklist');
    // Field feedback: unlike the other quiz answers checked around this, "Have you travelled outside
    // Nigeria before?" deliberately does NOT carry over - landing pre-answered on the real session
    // read as the tool deciding for the applicant. It should still be sitting on its own blank
    // "Select…" placeholder here, even though the quiz answered the same question moments ago.
    var travelledBefore = await page.$eval('#te_firstTime', function(el){ return el.value; });
    assert.strictEqual(travelledBefore, '', 'Travel history should NOT carry over from the quiz - the applicant should answer it fresh on the real session');
    var hasRefusal = await page.$eval('#f_hasRefusal', function(el){ return el.checked; });
    assert.strictEqual(hasRefusal, false, 'No-past-refusal answer from the quiz should carry into the full checklist');
    var hasHost = await page.$eval('#f_hasHost', function(el){ return el.checked; });
    assert.strictEqual(hasHost, false, 'Self-funded answer from the quiz should leave the host checkbox unticked');
  } finally {
    await page.context().close();
  }

  // Part 2: field feedback removed the real "Skip straight to the checklist" button from this
  // screen entirely — completing the quiz is now the only path through it for a real applicant (the
  // quiz gives a genuine preview of what's ahead, which a visible skip link undercut). What used to
  // be that button's behavior lives on only as window.__testSkipQuiz(), a test-only escape hatch
  // (used by helpers.passConsentGate and most other tests) so the suite isn't forced to answer all
  // 10 questions before every test that just needs to get past this screen. This checks the escape
  // hatch itself still does what it's meant to: skip only the quiz's own questions, still landing on
  // the docs page next, with no quiz answers applied.
  var page2 = await newPageAt(ctx.browser, '/index.html');
  try {
    await page2.waitForSelector('#quizIntro');
    var skipLinkGone = await page2.$('#quizSkipLink');
    assert.strictEqual(skipLinkGone, null, 'The real "Skip straight to the checklist" button should no longer exist on the quiz screen');
    await page2.evaluate(function(){ window.__testSkipQuiz(); });
    await page2.waitForSelector('#docsGate', { state: 'visible' });
    var quizHiddenAfterSkip = await page2.$eval('#quizGate', function(el){ return el.style.display === 'none'; });
    assert.strictEqual(quizHiddenAfterSkip, true, 'Quiz should be hidden after skipping');
  } finally {
    await page2.context().close();
  }
};
