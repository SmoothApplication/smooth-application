'use strict';
// User-reported bug, off a real Opay statement: automatic daily interest credits on Opay's "OWealth"
// savings wallet narrate with no sender name at all, just a timestamp, the product name, and a long
// opaque reference token — e.g. "07 Aug 2026 01:40:30 OWealth Interest Earned -- Mobile uJ
// 260808994uHYYGJHzJblKYq3Jmt1". The name-extraction logic (built and tuned against Sterling Bank
// narrations) had never seen this shape before, so it swept "Earned"/"Mobile"/"Owealth" plus the
// reference token in as if they were a person's name, producing garbled "sender" groups like "Earned
// Mobile Rtntgkunklgbaieworixg Yfu Otxcrrmj Ebk D" — which the user correctly flagged: "do not
// acknowledge these ... as names". Real narrations pulled from the user's own screenshot of the app
// (via "Show individual payment(s)"):
//   "07 Aug 2026 01:40:30 OWealth Interest Earned -- Mobile uJ 260808994uHYYGJHzJblKYq3Jmt1"
//   "04 Aug 2026 01:26:50 OWealth Interest Earned -- Mobile yA 26080599uWFN9Q3pwd06IcukCo"
//
// Fixed by: detecting "interest earned" in the narration BEFORE name extraction ever runs (same
// priority as the existing reversal/self checks) and routing it to its own dedicated, clearly-labelled
// 'interest' group instead — same treatment as Reversals and Self, since this is the applicant's own
// money growing automatically, not income from a person or company.
const assert = require('assert');
const { newPageAt, passConsentGate } = require('./helpers');

exports.run = async function(ctx){
  var page = await newPageAt(ctx.browser, '/index.html');
  try {
    await passConsentGate(page);

    var groups = await page.evaluate(function(){
      return window.__testBuildIncomeSourceBreakdown([
        // The two real OWealth interest narrations from the user's own statement.
        { narration: '07 Aug 2026 01:40:30 OWealth Interest Earned -- Mobile uJ 260808994uHYYGJHzJblKYq3Jmt1', credit: 1, dateISO: '2026-08-07' },
        { narration: '04 Aug 2026 01:26:50 OWealth Interest Earned -- Mobile yA 26080599uWFN9Q3pwd06IcukCo', credit: 1, dateISO: '2026-08-04' },
        // A third, shorter one to make sure a short reference token doesn't dodge detection either.
        { narration: '09 Aug 2026 02:10:00 OWealth Interest Earned -- Mobile Sm 26080999xYZ1', credit: 1, dateISO: '2026-08-09' },
        // A genuine, real-named payment must be completely unaffected — still its own "personal" group.
        { narration: 'NIP TRF FROM ADISA BILIKIS ABIOLA', credit: 960000, dateISO: '2026-07-30' }
      ], 'AGBOOLA MARY OLUWAFUNMILAYO', '');
    });

    // None of the three interest credits should produce a garbled "personal" sender group.
    var garbled = groups.filter(function(g){ return g.type === 'personal' && /Earned|Owealth|Mobile/i.test(g.name); });
    assert.strictEqual(garbled.length, 0, 'OWealth interest credits must never be extracted as a personal sender name, got groups: ' + JSON.stringify(groups));

    // They should instead land in one dedicated 'interest' group, all three payments merged together.
    var interestGroups = groups.filter(function(g){ return g.type === 'interest'; });
    assert.strictEqual(interestGroups.length, 1, 'Expected exactly one interest group, got: ' + JSON.stringify(groups));
    assert.strictEqual(interestGroups[0].count, 3, 'All three OWealth interest credits should be grouped together, got: ' + JSON.stringify(interestGroups[0]));

    // A real named sender elsewhere in the same statement must still come through untouched.
    var adisa = groups.filter(function(g){ return g.type === 'personal' && /ADISA BILIKIS ABIOLA/i.test(g.name); });
    assert.strictEqual(adisa.length, 1, 'A genuine real-named sender must still be grouped normally alongside the interest bucket, got: ' + JSON.stringify(groups));
  } finally {
    await page.context().close();
  }
};
