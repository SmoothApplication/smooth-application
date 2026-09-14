'use strict';
// Companion to statement-recall-without-reupload.test.js: that E2E reload test only exercises the
// "needs an explanation" box (blank-narration inflows). This drives rebuildStatementItemizedViews()
// directly, off a hand-built transaction list, to cover the employer/business matched-inflow branch
// (findInflowsMatchingName + window.__lastNameChecks) that a restored session also needs to rebuild
// correctly - without needing a real PDF fixture or a full page-reload round-trip just for that.
const assert = require('assert');
const { newPageAt, passConsentGate } = require('./helpers');

exports.run = async function(ctx){
  var page = await newPageAt(ctx.browser, '/index.html');
  try {
    await passConsentGate(page);

    // Declared employer "Acme Global" has one real matching inflow; declared business "Zenith
    // Traders" has none in this same transaction list at all.
    var result = await page.evaluate(function(){
      return window.__testRebuildStatementItemizedViews([
        { narration: 'BANKNIP From 000020 SENDER: ACME GLOBAL SALARY', credit: 300000, dateISO: '2026-03-01' },
        { narration: 'SOME OTHER UNRELATED TRANSFER', credit: 15000, dateISO: '2026-03-05' }
      ], { employed: true, employerName: 'Acme Global', selfEmployed: true, businessName: 'Zenith Traders', name: 'Test Applicant' });
    });

    var employerCheck = result.nameChecks.filter(function(c){ return c.label === 'employer'; })[0];
    assert.ok(employerCheck, 'Should have a nameChecks entry for the declared employer, got: ' + JSON.stringify(result.nameChecks));
    assert.strictEqual(employerCheck.found, true, 'The employer inflow should be found, got: ' + JSON.stringify(employerCheck));
    assert.strictEqual(employerCheck.inflowCount, 1, 'Exactly one inflow should match the declared employer, got: ' + JSON.stringify(employerCheck));

    var businessCheck = result.nameChecks.filter(function(c){ return c.label === 'business'; })[0];
    assert.ok(businessCheck, 'Should have a nameChecks entry for the declared business, got: ' + JSON.stringify(result.nameChecks));
    assert.strictEqual(businessCheck.found, false, 'The declared business has no matching inflow here, so it should read as not found, got: ' + JSON.stringify(businessCheck));
    assert.strictEqual(businessCheck.inflowCount, 0, 'The declared business should have zero matched inflows, got: ' + JSON.stringify(businessCheck));

    assert.strictEqual(result.employerBoxHasContent, true, 'The employer-matched box should be populated for the found employer inflow');
    assert.strictEqual(result.matchedBoxHasContent, false, 'The business-matched box should stay empty since nothing matched the declared business');
    assert.strictEqual(result.unexplainedCount, 0, 'Neither transaction here is large/blank enough to also need a separate explanation');
  } finally {
    await page.context().close();
  }
};
