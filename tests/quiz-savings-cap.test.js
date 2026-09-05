'use strict';
// Real user report: someone who answered "₦500,000-₦2,000,000" saved, but scored well on every
// other question (employed, steady income, travelled before, no past refusal, strong ties,
// passport in hand, statements ready), landed on "Strong starting position" - because savings is
// only 1 of 8 additive factors, a thin cushion was fully offset by unrelated strengths. That's not
// how a real visa decision works (an officer can refuse on insufficient funds alone regardless of
// how good everything else looks), so quizScore() now caps the tier below "strong" whenever
// savings is "under500k" or "to2m", no matter how many points the other 7 answers earn - see the
// comment above quizScore() in index.html for the full reasoning. This also checks the new
// to2m-specific gap message (previously that bracket got no gap message at all).
const assert = require('assert');
const { newPageAt } = require('./helpers');

exports.run = async function(ctx){
  var page = await newPageAt(ctx.browser, '/index.html');
  try {
    await page.waitForSelector('#quizIntro');
    await page.evaluate(function(){
      window.__trackedEvents = [];
      window.goatcounter = { count: function(o){ window.__trackedEvents.push(o.path); } };
    });
    await page.click('#quizStartBtn');
    await page.waitForSelector('#quizFormWrap', { state: 'visible' });

    // Every other answer maxed out (17 of 19 possible points, well past the 13-point "strong"
    // cutoff on its own) - only savings is thin.
    await page.selectOption('#q_quizCountry', 'UK');
    await page.selectOption('#q_quizWork', 'employed');
    await page.selectOption('#q_quizIncome', 'steady');
    await page.selectOption('#q_quizSavings', 'to2m');
    await page.selectOption('#q_quizTravel', 'yes');
    await page.click('#quizNextBtn');
    await page.waitForFunction(function(){ return document.getElementById('quizProgressLabel').textContent === 'Step 2 of 2'; });

    await page.selectOption('#q_quizTies', 'strong');
    await page.selectOption('#q_quizRefusal', 'no');
    await page.selectOption('#q_quizHost', 'none');
    await page.selectOption('#q_quizPassport', 'yes');
    await page.selectOption('#q_quizStatements', 'yes');

    await page.click('#quizSeeResult');
    await page.waitForSelector('#quizResultPanel', { state: 'visible' });

    var tierText = await page.$eval('#quizResultTier', function(el){ return el.textContent; });
    assert.ok(!/Strong starting position/.test(tierText), 'A thin (₦500k-₦2M) savings answer should never allow "Strong starting position", regardless of how strong every other answer is, got: ' + tierText);
    assert.ok(/A few gaps to close/.test(tierText), 'Should show the capped "some gaps" tier instead, got: ' + tierText);

    var gapText = await page.$eval('#quizGapList', function(el){ return el.textContent; });
    assert.ok(/depends heavily on your trip length/i.test(gapText), 'The ₦500k-₦2M bracket should now surface its own gap message pointing to the real Financial readiness calculator, got: ' + gapText);

    var tracked = await page.evaluate(function(){ return window.__trackedEvents.slice(); });
    assert.ok(tracked.indexOf('quiz_completed:some') !== -1, 'Should track quiz_completed:some (not :strong) for this answer set, got: ' + JSON.stringify(tracked));
  } finally {
    await page.context().close();
  }
};
