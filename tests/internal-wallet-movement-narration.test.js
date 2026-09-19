'use strict';
// Real-data finding (two genuine Opay wallet/savings statements for the same applicant, reviewed
// after the OWealth-interest fix in interest-earned-narration.test.js): beyond "OWealth Interest
// Earned", Opay's auto-save/sub-balance feature produces several OTHER credit narrations that are
// just as clearly not income - the applicant's own money moving between their main wallet and its
// OWealth/Targets/SafeBox sub-balances - but none of them contain the word "interest", so
// isInterestEarnedNarration doesn't catch them:
//   "Auto-save to OWealth Balance"
//   "OWealth Withdrawal(Transaction Payment)"
//   "OWealth Deposit(from Targets)"
//   "OWealth Deposit(from Fixed)"
//   "OWealth Deposit(Transaction Refund)"
//   "Targets Deposit"
//   "SafeBox Deposit" / "SafeBox Withdrawal"
// None of these name a sender at all, so before this fix they fell through to candidate-name
// extraction (finding nothing) and landed in "Other / one-off inflows (no clear sender name)" -
// never mislabeled as a person, but still surfaced to the applicant as an unexplained inflow needing
// a reason/category, when it's actually just internal wallet bookkeeping.
//
// Fixed by: detecting this internal-movement vocabulary in the narration before name extraction
// runs (same priority tier as the interest-earned check) and routing it to its own dedicated
// 'internal' group, so it never needs an explanation and never dilutes "Other".
const assert = require('assert');
const { newPageAt, passConsentGate } = require('./helpers');

exports.run = async function(ctx){
  var page = await newPageAt(ctx.browser, '/index.html');
  try {
    await passConsentGate(page);

    var groups = await page.evaluate(function(){
      return window.__testBuildIncomeSourceBreakdown([
        { narration: '12 May 2026 09:03:10 Auto-save to OWealth Balance -- Mobile aB 260512001xYZ', credit: 5000, dateISO: '2026-05-12' },
        { narration: '13 May 2026 10:00:00 OWealth Withdrawal(Transaction Payment) -- Mobile cD 260513002xYZ', credit: 3000, dateISO: '2026-05-13' },
        { narration: '14 May 2026 11:15:00 OWealth Deposit(from Targets) -- Mobile eF 260514003xYZ', credit: 2000, dateISO: '2026-05-14' },
        { narration: '15 May 2026 12:20:00 OWealth Deposit(from Fixed) -- Mobile gH 260515004xYZ', credit: 10000, dateISO: '2026-05-15' },
        { narration: '16 May 2026 13:25:00 OWealth Deposit(Transaction Refund) -- Mobile iJ 260516005xYZ', credit: 1500, dateISO: '2026-05-16' },
        { narration: '17 May 2026 14:30:00 Targets Deposit -- Mobile kL 260517006xYZ', credit: 4000, dateISO: '2026-05-17' },
        { narration: '18 May 2026 15:35:00 SafeBox Deposit -- Mobile mN 260518007xYZ', credit: 6000, dateISO: '2026-05-18' },
        { narration: '19 May 2026 16:40:00 SafeBox Withdrawal -- Mobile oP 260519008xYZ', credit: 6000, dateISO: '2026-05-19' },
        // A genuine, real-named payment must be completely unaffected - still its own "personal" group.
        { narration: 'NIP TRF FROM ADISA BILIKIS ABIOLA', credit: 960000, dateISO: '2026-07-30' }
      ], 'AGBOOLA MARY OLUWAFUNMILAYO', '');
    });

    // None of the eight internal-movement credits should produce a garbled "personal"/"other" sender group.
    var garbled = groups.filter(function(g){ return g.type !== 'internal' && /Owealth|Safebox|Targets|Auto-?save/i.test(g.name || ''); });
    assert.strictEqual(garbled.length, 0, 'Internal wallet-movement credits must never be extracted as a name or leak into another group, got groups: ' + JSON.stringify(groups));

    // They should instead land in one dedicated 'internal' group, all eight payments merged together.
    var internalGroups = groups.filter(function(g){ return g.type === 'internal'; });
    assert.strictEqual(internalGroups.length, 1, 'Expected exactly one internal group, got: ' + JSON.stringify(groups));
    assert.strictEqual(internalGroups[0].count, 8, 'All eight internal wallet-movement credits should be grouped together, got: ' + JSON.stringify(internalGroups[0]));

    // None of them should have piled into "Other / one-off inflows" instead.
    var otherGroups = groups.filter(function(g){ return g.type === 'other'; });
    assert.strictEqual(otherGroups.length, 0, 'Internal wallet-movement credits must not land in the "Other" bucket, got: ' + JSON.stringify(groups));

    // A real named sender elsewhere in the same statement must still come through untouched.
    var adisa = groups.filter(function(g){ return g.type === 'personal' && /ADISA BILIKIS ABIOLA/i.test(g.name); });
    assert.strictEqual(adisa.length, 1, 'A genuine real-named sender must still be grouped normally alongside the internal bucket, got: ' + JSON.stringify(groups));
  } finally {
    await page.context().close();
  }
};
