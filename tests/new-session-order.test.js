'use strict';
// Locks in the current 5-session structure. Originally this asserted a 12-session order (passport /
// travelExperience / responsibilities / trip / finance2 / finance / one session per checklist
// category / review) — later user feedback was "reduce the sessions from 12 sessions to 5 sessions,
// I have got a lot of complaints." Rather than removing any content, the old sessions were folded
// into 5 top-level ones, each holding several independently-collapsible cards (or, for the document
// checklist, several categories) at once — see the comment above catGroupKey() and
// getVisibleSessionKeys() in index.html for the full rationale and grouping.
const assert = require('assert');
const { newPageAt, passConsentGate } = require('./helpers');

exports.run = async function(ctx){
  var page = await newPageAt(ctx.browser, '/index.html');
  try {
    await passConsentGate(page);
    await page.waitForSelector('.session-pill');

    var titles = await page.$$eval('.session-pill', function(pills){
      return pills.map(function(p){ return (p.getAttribute('title') || '').split(' — ')[0]; });
    });

    // Exactly 5 top-level sessions for a typical UK applicant (5 of the 9 possible checklist
    // categories apply by default — Identity & application / Financial evidence / Ties to Nigeria /
    // Accommodation & UK host / Travel details — which is exactly what folds into the 2 document-
    // checklist sessions below; the conditional categories, when they apply, add extra content
    // inside 'Other required documents' without adding a new top-level session).
    assert.deepStrictEqual(titles, [
      'About you',
      'Financial readiness',
      'Identity & financial documents',
      'Other required documents',
      'Final review'
    ], 'Should show exactly these 5 top-level sessions in this order, got: ' + titles.join(' | '));

    // Session 1 ("About you") should be the one showing open/current on first load.
    var firstPillActive = await page.$eval('.session-pill[data-idx="0"]', function(el){ return el.classList.contains('active'); });
    assert.strictEqual(firstPillActive, true, '"About you" should be the default landing session');

    // 'About you' merges 4 previously-separate sessions into one — all 4 of their cards should be
    // showing (each independently collapsible) rather than just one of them.
    var aboutYouCardTitles = await page.$$eval('[data-session-key="aboutYou"] .card-summary h2', function(hs){
      return hs.map(function(h){ return h.textContent.trim(); });
    });
    assert.strictEqual(aboutYouCardTitles.length, 4, '"About you" should hold 4 cards (passport, travel experience, responsibilities, trip), got: ' + aboutYouCardTitles.join(' | '));

    // 'Financial readiness' merges the bank-statement-analysis card and the cost calculator card —
    // and the statement-analysis card should appear FIRST (see the comment in getVisibleSessionKeys):
    // an applicant should be able to upload a statement and see real feedback before working through
    // a full manual cost estimate.
    var financialReadinessCardTitles = await page.$$eval('[data-session-key="financialReadiness"] .card-summary h2', function(hs){
      return hs.map(function(h){ return h.textContent.trim(); });
    });
    assert.strictEqual(financialReadinessCardTitles.length, 2, '"Financial readiness" should hold 2 cards, got: ' + financialReadinessCardTitles.join(' | '));
    assert.ok(/Income & bank statement analysis/.test(financialReadinessCardTitles[0]),
      'The bank-statement-analysis card should come first in "Financial readiness", got: ' + financialReadinessCardTitles.join(' | '));
    assert.ok(/Financial readiness calculator/.test(financialReadinessCardTitles[1]),
      'The cost calculator card should come second in "Financial readiness", got: ' + financialReadinessCardTitles.join(' | '));
  } finally {
    await page.context().close();
  }
};
