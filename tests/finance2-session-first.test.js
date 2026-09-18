'use strict';
// Founder decision: Income & bank statement analysis (finance2) moves to be the FIRST session,
// ahead of Passport — bank-statement readiness is the one requirement with real calendar lead
// time (passport renewal is parallelizable, this isn't). See scripts/reorder-finance2-first.js
// (run once against index.html + the test suite's hardcoded pill indices) and the matching
// CHANGELOG entry. This test guards the two user-visible parts of that change: session order
// itself, and the "why this comes first" line that explains an otherwise-abrupt hard opener.
const assert = require('assert');
const { newPageAt, passConsentGate, goToSessionByPill } = require('./helpers');

exports.run = async function(ctx){
  var page = await newPageAt(ctx.browser, '/index.html');
  try {
    await passConsentGate(page);

    // Session pill order: finance2 first, passport second.
    var pillLabels = await page.$$eval('.session-pill', function(pills){
      return pills.map(function(p){ return p.textContent.trim(); });
    });
    assert.ok(/Income|bank statement/i.test(pillLabels[0] || ''),
      'First session pill should be Income & bank statement analysis, got: ' + JSON.stringify(pillLabels.slice(0, 3)));
    assert.ok(/passport/i.test(pillLabels[1] || ''),
      'Second session pill should be Passport, got: ' + JSON.stringify(pillLabels.slice(0, 3)));

    // finance2 card should be open (auto-expanded) as the landing session; passport should not be.
    var openState = await page.evaluate(function(){
      var f2 = document.querySelector('[data-session-key="finance2"]');
      var pp = document.querySelector('[data-session-key="passport"]');
      return { finance2Open: f2 ? f2.hasAttribute('open') : null, passportOpen: pp ? pp.hasAttribute('open') : null };
    });
    assert.strictEqual(openState.finance2Open, true, 'finance2 should be the auto-expanded first session');
    assert.strictEqual(openState.passportOpen, false, 'passport should no longer be auto-expanded');

    // The "why this comes first" line should be visible right at the top of the finance2 tab.
    var whyFirstText = await page.evaluate(function(){
      var card = document.querySelector('[data-session-key="finance2"] .card-body');
      return card ? card.textContent : '';
    });
    assert.ok(/takes real time to fix|face it first|renew in parallel/i.test(whyFirstText),
      'finance2 should explain why it comes first before anything else on the tab');
  } finally {
    await page.context().close();
  }
};
