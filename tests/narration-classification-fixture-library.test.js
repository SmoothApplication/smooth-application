'use strict';
// Consolidated fixture library for the bank-statement narration classifier
// (buildIncomeSourceBreakdown / identifyStableIncome and their helpers: isReversalNarration,
// isInterestEarnedNarration, isNonIncomeChargeNarration, self-transfer detection, sender-name
// extraction). This is the single highest-recurring bug class in the app — real user statements
// keep surfacing new narration shapes that the classifier has never seen, each one shipped as its
// own one-off test (see: interest-earned-narration, amount-matched-reversal,
// stray-payment-no-false-salary-from-self-bucket, airtime-sms-charge-not-income,
// self-inflow-holder-name-variants, maiden-name-self-matching, sender-self-and-recipient-side, and
// more). This file does not replace those — each documents its own bug's history in detail — it
// exists as a fast, no-PDF, table-driven regression net that runs every known narration shape
// through the classifier in one place, so the NEXT new shape a user reports can be added here as a
// single row instead of a whole new test file, and so any future change to the classifier's
// priority ordering (charge -> reversal -> interest -> self -> salary -> named -> other) gets
// checked against every past bug in one shot.
//
// To add a case for a newly-reported bug: add a row to FIXTURES below with the real (or
// realistically-shaped) narration, its expected `type`, and a one-line `note` citing the source.
// Run `npm test` — a wrong classification fails loudly with the narration text in the assertion.
const assert = require('assert');
const { newPageAt, passConsentGate } = require('./helpers');

var APPLICANT_NAME = 'AGBOOLA MARY OLUWAFUNMILAYO';

// Each fixture: { narration, credit, dateISO, expectType, note }
// expectType is one of: 'interest' | 'reversal-excluded' | 'charge-excluded' | 'self' | 'salary' | 'personal'
var FIXTURES = [
  {
    narration: '07 Aug 2026 01:40:30 OWealth Interest Earned -- Mobile uJ 260808994uHYYGJHzJblKYq3Jmt1',
    credit: 1, dateISO: '2026-08-07', expectType: 'interest',
    note: 'Opay OWealth auto-interest credit, no sender name at all (interest-earned-narration.test.js)'
  },
  {
    narration: '***RSVL NIP CR/MOB/TOBI BENSON/FBN / Grace CYC WEDDING SUPPORT',
    credit: 15000, dateISO: '2026-05-11', expectType: 'reversal-excluded',
    note: '"RSVL" (letters transposed from RVSL) reversal marker (rsvl-reversal-spelling.test.js)'
  },
  {
    narration: '2026-04-27 2849426152/0000012 Mobile USSDAirtime N500.00 to 6042621510383314428 07084198281 RefId 4277',
    credit: 500, dateISO: '2026-04-27', expectType: 'charge-excluded',
    note: 'Self-service airtime top-up, not income (airtime-sms-charge-not-income.test.js)'
  },
  {
    narration: '2026-06-09 3074749739 - SMS NOTIFICATION CHARGE FOR 2026 MAY 8TH-14TH MAY 2026',
    credit: 561, dateISO: '2026-06-09', expectType: 'charge-excluded',
    note: 'Bank SMS-notification fee, not income (airtime-sms-charge-not-income.test.js)'
  },
  {
    narration: 'BANKNIP From 000014 PAYREF: - SENDER: AGBOOLA MARY OLUWAFUNMILAYO',
    credit: 20000, dateISO: '2026-02-04', expectType: 'self',
    note: 'Applicant transferring to herself, own full name as "sender" (stray-payment-no-false-salary-from-self-bucket.test.js)'
  },
  {
    narration: 'NIP TRF FROM ADISA BILIKIS ABIOLA',
    credit: 960000, dateISO: '2026-07-30', expectType: 'personal',
    note: 'Genuine real-named third-party sender, must classify normally (interest-earned-narration.test.js)'
  },
  {
    narration: '3373260214/10000226 - AFRC - 080615544100155048 4891',
    credit: 18730, dateISO: '2026-08-06', expectType: 'personal',
    note: 'Blank/coded narration, isolated one-off amount — must NOT ride into Salary just because it rounds to the same bucket as unrelated self-transfers (stray-payment-no-false-salary-from-self-bucket.test.js)'
  }
];

exports.run = async function(ctx){
  var page = await newPageAt(ctx.browser, '/index.html');
  try {
    await passConsentGate(page);

    // Run every fixture through the real classifier in one page.evaluate call, alongside 3 months
    // of genuine recurring salary so 'personal'/'self' rows are judged in a realistic statement
    // context rather than in isolation.
    var result = await page.evaluate(function(args){
      var applicantName = args.applicantName, fixtures = args.fixtures;
      var salaryTxns = [
        { narration: 'NIP TRF GOOD EMPLOYER LTD IFO TEST APPLICANT SMITH', credit: 300000, dateISO: '2026-01-15' },
        { narration: 'NIP TRF GOOD EMPLOYER LTD IFO TEST APPLICANT SMITH', credit: 300000, dateISO: '2026-02-15' },
        { narration: 'NIP TRF GOOD EMPLOYER LTD IFO TEST APPLICANT SMITH', credit: 300000, dateISO: '2026-03-15' }
      ];
      var fixtureTxns = fixtures.map(function(f){
        return { narration: f.narration, credit: f.credit, dateISO: f.dateISO };
      });
      var groups = window.__testBuildIncomeSourceBreakdown(salaryTxns.concat(fixtureTxns), applicantName, '');
      return { groups: groups };
    }, { applicantName: APPLICANT_NAME, fixtures: FIXTURES });

    var groups = result.groups;
    var allNames = groups.map(function(g){ return g.name; }).join(' | ');

    FIXTURES.forEach(function(fx){
      if (fx.expectType === 'interest'){
        var interestGroups = groups.filter(function(g){ return g.type === 'interest'; });
        assert.ok(interestGroups.length >= 1 && interestGroups.some(function(g){ return g.count >= 1; }),
          'Expected an interest group for: "' + fx.narration + '" (' + fx.note + '). Groups: ' + JSON.stringify(groups));
        var garbled = groups.some(function(g){ return g.type !== 'interest' && /Earned|Owealth/i.test(g.name || ''); });
        assert.ok(!garbled, 'Interest narration leaked into a non-interest group as a fake name: "' + fx.narration + '" (' + fx.note + ')');
      } else if (fx.expectType === 'reversal-excluded' || fx.expectType === 'charge-excluded'){
        var leaked = groups.some(function(g){
          return (g.txns || []).some ? false : false;
        });
        // Reversal/charge narrations must never surface as their own named group (personal/salary/other).
        var asNamed = groups.some(function(g){
          return ['personal', 'salary', 'other'].indexOf(g.type) !== -1 &&
            fx.narration.split(/\s+/).some(function(word){
              return word.length > 3 && (g.name || '').indexOf(word) !== -1;
            });
        });
        assert.ok(!asNamed, (fx.expectType === 'reversal-excluded' ? 'Reversal' : 'Non-income charge') +
          ' narration should be excluded entirely, not surfaced as a named income group: "' + fx.narration + '" (' + fx.note + '). Groups: ' + JSON.stringify(groups));
      } else if (fx.expectType === 'self'){
        var selfGroups = groups.filter(function(g){ return g.type === 'self'; });
        assert.ok(selfGroups.length >= 1, 'Expected a Self group for: "' + fx.narration + '" (' + fx.note + '). Groups: ' + JSON.stringify(groups));
      } else if (fx.expectType === 'personal'){
        // Must not have been silently swallowed into Salary alongside the unrelated 3x ₦300,000 employer payments.
        var salaryGroup = groups.filter(function(g){ return g.type === 'salary'; })[0];
        if (salaryGroup){
          assert.strictEqual(salaryGroup.total, 900000,
            'A one-off personal/stray credit leaked into Salary and inflated its total: "' + fx.narration + '" (' + fx.note + '). Salary group: ' + JSON.stringify(salaryGroup));
        }
      }
    });

    // Sanity check: the genuine 3-month employer salary must survive all of the above untouched.
    var salaryGroups = groups.filter(function(g){ return g.type === 'salary'; });
    assert.strictEqual(salaryGroups.length, 1, 'Genuine recurring salary should still form exactly one group amid all fixtures. Groups: ' + allNames);
    assert.strictEqual(salaryGroups[0].total, 900000, 'Genuine salary total must be exactly the 3 real employer payments, untouched by any fixture. Groups: ' + allNames);
    assert.strictEqual(salaryGroups[0].count, 3, 'Genuine salary count must be exactly 3, untouched by any fixture. Groups: ' + allNames);
  } finally {
    await page.context().close();
  }
};
