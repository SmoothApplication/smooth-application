'use strict';
// User-reported gap, off a real statement: applying "Fix name" to correct a truncated sender ("Crisp
// N" -> "Crisp N Clean Exclusive Solutions Ltd") only ever changed how that ONE sender group displayed
// on the Income sources breakdown tab - the Workplace income tab kept showing empty until the
// applicant re-uploaded and re-ran "Analyze Statements" from scratch, even though
// findInflowsMatchingName already knows how to use a saved Fix Name correction (via
// resolveSenderNameCorrection - see workplace-income-fix-name-fallback.test.js) once one exists. User's
// own words, repeated more than once: "Automatically put all inflow from place of work to workplace
// income."
//
// Fixed by adding rerenderMatchedIncomeGroups() - the same cheap re-render pattern already used for
// "Top 10 most consistent senders" (rerenderTopConsistentSenders, off window.__lastConsistentSendersInput)
// - and calling it from the "Fix name" Save handler, so the Workplace/Business income tabs refresh
// immediately off the same cached statement, with no re-upload or re-analysis needed.
const assert = require('assert');
const { newPageAt } = require('./helpers');

exports.run = async function(ctx){
  var page = await newPageAt(ctx.browser, '/index.html');
  try {
    await page.waitForSelector('#quizIntro');

    var txns = [
      { narration: 'BANKNIP From 090405 PAYREF: - SENDER: CRISP N', credit: 350000, dateISO: '2026-04-04' },
      { narration: 'BANKNIP From 090405 PAYREF: - SENDER: CRISP N', credit: 350000, dateISO: '2026-05-04' },
      // Unrelated sender - must never show up in Workplace income just because a correction exists for
      // a completely different sender.
      { narration: 'BANKNIP From 000015 PAYREF: - SENDER: 41867 YARO REMARK: Ok', credit: 100000, dateISO: '2026-06-01' }
    ];
    var workAnswers = { f_employed: true, f_employerName: 'Crisp N Clean Exclusive Solutions Ltd' };

    // Before any "Fix name" correction is on file, the raw narration alone ("SENDER: CRISP N") only
    // ever supplies ONE of the declared name's distinctive words - Workplace income should stay empty,
    // same as a fresh "Analyze Statements" run would show.
    var before = await page.evaluate(function(args){
      return window.__testRerenderMatchedIncomeGroups(args.txns, args.workAnswers, {});
    }, { txns: txns, workAnswers: workAnswers });
    assert.ok(!/350,000/.test(before.employerHtml), 'Workplace income should not show the Crisp N payments before any Fix Name correction exists, got: ' + before.employerHtml);

    // Once the applicant has saved "Crisp N" -> "Crisp N Clean Exclusive Solutions Ltd" as a Fix Name
    // correction, Workplace income should refresh immediately (no re-analysis) to show both payments -
    // and the unrelated Yaro payment must still not appear.
    var after = await page.evaluate(function(args){
      return window.__testRerenderMatchedIncomeGroups(args.txns, args.workAnswers, args.corrections);
    }, { txns: txns, workAnswers: workAnswers, corrections: { 'Crisp N': 'Crisp N Clean Exclusive Solutions Ltd' } });
    var matchCount350k = (after.employerHtml.match(/350,000/g) || []).length;
    assert.strictEqual(matchCount350k, 2, 'Workplace income should show both ₦350,000 Crisp N payments immediately after the Fix Name correction, got html: ' + after.employerHtml);
    assert.ok(!/100,000/.test(after.employerHtml), 'The unrelated Yaro payment should never appear in Workplace income, got: ' + after.employerHtml);
    assert.ok(/Crisp N Clean Exclusive Solutions Ltd/.test(after.employerHtml), 'Should show the declared employer name in the tab, got: ' + after.employerHtml);
  } finally {
    await page.context().close();
  }
};
