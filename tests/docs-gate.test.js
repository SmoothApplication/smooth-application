'use strict';
// Regression test for the "two documents" page — a dedicated screen between the confidence quiz and
// the consent gate. Direct user request: "create a separate page after the quiz page. the page
// should state clearly that you need these 2 documents... the current 2nd page [the consent gate]
// is too busy." Previously the consent gate carried a full, country-specific "what you'll need"
// list (gate-prep-details/gatePrepChecklist) alongside the country picker, disclaimer, and checkbox
// all at once — that list has been removed from the consent gate and replaced by this focused page,
// which states just the two documents almost every applicant needs (passport, bank statements)
// regardless of country. Also covers the "← Back" links added across all three gate screens so
// nobody's stuck moving only forward — same reasoning as unlocking the session pills.
const assert = require('assert');
const { newPageAt } = require('./helpers');

exports.run = async function(ctx){
  var page = await newPageAt(ctx.browser, '/index.html');
  try {
    // Reach the docs page via the quiz's skip path (the shortest path — confidence-quiz.test.js
    // covers reaching it via "Continue" after finishing the quiz itself). The real "Skip" button was
    // removed from the quiz screen (field feedback) — window.__testSkipQuiz() is the test-only
    // escape hatch left in its place.
    await page.waitForSelector('#quizIntro');
    await page.evaluate(function(){ window.__testSkipQuiz(); });
    await page.waitForSelector('#docsGate', { state: 'visible' });

    var quizHidden = await page.$eval('#quizGate', function(el){ return el.style.display === 'none'; });
    assert.strictEqual(quizHidden, true, 'Quiz should be hidden once the docs page is showing');
    var gateHidden = await page.$eval('#consentGate', function(el){ return el.style.display === 'none'; });
    assert.strictEqual(gateHidden, true, 'The consent gate should stay hidden until the docs page is continued past');

    var pageText = await page.$eval('#docsGate', function(el){ return el.textContent; });
    assert.ok(/passport/i.test(pageText), 'Docs page should clearly mention the passport, got: ' + pageText);
    assert.ok(/bank statement/i.test(pageText), 'Docs page should clearly mention bank statements, got: ' + pageText);

    // Exactly two document callouts — the whole point is this page states just the two, not a long
    // country-specific list (that job now belongs to the checklist itself, one page later).
    var itemCount = await page.$$eval('#docsGate .docs-gate-item', function(els){ return els.length; });
    assert.strictEqual(itemCount, 2, 'Docs page should highlight exactly two documents, got ' + itemCount);

    // The consent gate itself should no longer carry the old "what you'll need to gather" block —
    // that content moved to this page, decluttering the gate per the original feedback.
    var oldBlockGone = await page.$('#gatePrepChecklist');
    assert.strictEqual(oldBlockGone, null, 'The old prep-checklist block should no longer exist on the consent gate');

    // Continuing hides the docs page and reveals the (now decluttered) consent gate.
    await page.click('#docsGateContinue');
    await page.waitForSelector('#consentGate', { state: 'visible' });
    var docsHiddenAfter = await page.$eval('#docsGate', function(el){ return el.style.display === 'none'; });
    assert.strictEqual(docsHiddenAfter, true, 'Docs page should be hidden after continuing');

    // Consent gate → back → docs page → back → quiz — the full retrace, one step at a time.
    await page.click('#consentGateBack');
    await page.waitForSelector('#docsGate', { state: 'visible' });
    var consentHiddenAfterBack = await page.$eval('#consentGate', function(el){ return el.style.display === 'none'; });
    assert.strictEqual(consentHiddenAfterBack, true, 'Consent gate should be hidden after going back');

    await page.click('#docsGateBack');
    await page.waitForSelector('#quizGate', { state: 'visible' });
    var docsHiddenAfterBack = await page.$eval('#docsGate', function(el){ return el.style.display === 'none'; });
    assert.strictEqual(docsHiddenAfterBack, true, 'Docs page should be hidden after going back to the quiz');
  } finally {
    await page.context().close();
  }
};
