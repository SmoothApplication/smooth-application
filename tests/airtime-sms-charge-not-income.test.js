'use strict';
// User-reported bug, off a real statement (screenshot of the live "Salary" box): 13 small credits -
// recurring "Mobile USSDAirtime N500.00 to ..." top-ups, "SMS NOTIFICATION CHARGE FOR ..." bank fees,
// and one stray ₦2,000 NIP transfer IFO a named third party - were all swept into the auto-detected
// "Salary" bucket (₦7,077 total across 13 payments). Every one of these amounts is under ₦2,500, so
// identifyStableIncome's round-to-nearest-₦5,000 bucketing collapsed them all into the SAME rounded
// figure (₦0), which then looked like the best-recurring "stable income" bucket purely by coincidence
// of rounding - completely unrelated small amounts piling into one meaningless bucket. User's own
// words: "This cannot be salary, this is airtime & SMS charge."
//
// Fixed two ways: (1) isNonIncomeChargeNarration excludes narrations that are unmistakably a bank fee
// or self-service purchase (SMS alert charge, airtime top-up, etc.) from every income-classification
// entry point - these are dropped entirely, not even shown as an unexplained inflow needing a reason;
// (2) identifyStableIncome now refuses to treat the "rounds to ₦0" bucket as a stable-income candidate
// at all, regardless of narration content - a structural safeguard for whatever the narration-based
// exclusion doesn't happen to catch (like the stray ₦2,000 IFO-a-named-person transfer in the real
// report, which carries no charge keyword but is just as clearly not a recurring salary).
const assert = require('assert');
const { newPageAt, passConsentGate } = require('./helpers');

exports.run = async function(ctx){
  var page = await newPageAt(ctx.browser, '/index.html');
  try {
    await passConsentGate(page);

    // Reproduces the real report: airtime/SMS-charge credits recurring across 3 months, all under
    // ₦2,500, alongside one non-charge-keyword stray small credit (the ₦2,000 IFO-Lukuma case) that
    // also rounds to ₦0 - plus a genuine ₦300,000/month salary from a real employer, to confirm real
    // income still comes through unaffected.
    var groups = await page.evaluate(function(){
      return window.__testBuildIncomeSourceBreakdown([
        { narration: 'NIP TRF GOOD EMPLOYER LTD IFO TEST APPLICANT SMITH', credit: 300000, dateISO: '2026-01-15' },
        { narration: 'NIP TRF GOOD EMPLOYER LTD IFO TEST APPLICANT SMITH', credit: 300000, dateISO: '2026-02-15' },
        { narration: 'NIP TRF GOOD EMPLOYER LTD IFO TEST APPLICANT SMITH', credit: 300000, dateISO: '2026-03-15' },
        { narration: '2026-04-27 2849426152/0000012 Mobile USSDAirtime N500.00 to 6042621510383314428 07084198281 RefId 4277', credit: 500, dateISO: '2026-04-27' },
        { narration: '2026-05-20 2972146169/00000126 Mobile USSDAirtime N200.00 to 0519231725737762055 07084198281 RefId 788', credit: 200, dateISO: '2026-05-20' },
        { narration: '2026-06-09 3074749739 - SMS NOTIFICATION CHARGE FOR 2026 MAY 8TH-14TH MAY 2026', credit: 561, dateISO: '2026-06-09' },
        { narration: '2026-06-22 3129822207 - SMS NOTIFICATION CHARGE FOR 2026 JUNE 8TH-14TH JUNE 2026', credit: 406, dateISO: '2026-06-22' },
        { narration: '2026-03-03 000001260302141709177814546 864 NIP ROE IFO LUKUMA KAYODE ADEYEMI 2,000.00', credit: 2000, dateISO: '2026-03-03' }
      ], 'Test Applicant Smith');
    });

    var salaryGroup = groups.filter(function(g){ return g.type === 'salary'; });
    assert.strictEqual(salaryGroup.length, 1, 'The genuine recurring employer income should still form exactly one Salary group, got: ' + JSON.stringify(groups));
    assert.strictEqual(salaryGroup[0].total, 900000, 'Salary total should be exactly the 3 genuine ₦300,000 employer payments, with none of the airtime/SMS/stray amounts folded in, got: ' + salaryGroup[0].total);
    assert.strictEqual(salaryGroup[0].count, 3, 'Salary should count exactly the 3 genuine employer payments, got: ' + salaryGroup[0].count);

    // The stray ₦2,000 IFO-a-named-person credit carries no charge keyword, so it's still shown
    // somewhere (unlike the charge-narration ones) - the assertions above already confirm it wasn't
    // swept into Salary (total/count pinned to exactly the 3 genuine employer payments). Total of
    // everything OTHER than Salary should only ever account for that stray ₦2,000 credit -
    // never any of the 4 airtime/SMS-charge amounts (which sum to 1,667).
    var nonSalaryTotal = groups.filter(function(g){ return g.type !== 'salary'; }).reduce(function(sum, g){ return sum + g.total; }, 0);
    assert.strictEqual(nonSalaryTotal, 2000, 'Only the stray ₦2,000 credit should appear outside Salary - none of the airtime/SMS-charge amounts, got total: ' + nonSalaryTotal + ', groups: ' + JSON.stringify(groups));
  } finally {
    await page.context().close();
  }
};
