'use strict';
// Locks in the applicant's requested session order: Session 1 Validate your International
// Passport, Session 2 Travel Experience, Session 3 Your responsibilities, then every session that
// already existed before, unchanged and in its same relative order (Your trip details, Income &
// bank statement analysis, Financial readiness calculator, then the checklist categories, then
// Final review). See getVisibleSessionKeys()/sessionLabel() in index.html.
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

    var expectedStart = [
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
      'Travel details'
    ];
    assert.deepStrictEqual(titles.slice(0, expectedStart.length), expectedStart,
      'First ' + expectedStart.length + ' sessions should match the requested order, got: ' + titles.join(' | '));
    assert.strictEqual(titles[titles.length - 1], 'Final review', 'Last session should still be Final review, got: ' + titles[titles.length - 1]);

    // Session 1 should be the one showing open/current on first load.
    var firstPillActive = await page.$eval('.session-pill[data-idx="0"]', function(el){ return el.classList.contains('active'); });
    assert.strictEqual(firstPillActive, true, 'Session 1 (passport) should be the default landing session');
  } finally {
    await page.context().close();
  }
};
