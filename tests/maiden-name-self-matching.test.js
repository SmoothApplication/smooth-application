'use strict';
// User request: "Create female and ask if the applicant is married ask for maiden name. Use maiden
// name and married name to trace all inflows. All inflows in maiden name and married name should be
// taken to self." A married woman's bank statement can carry her maiden name on some transactions (an
// account opened before marriage, a recipient-side name never updated, a relative still using the old
// name) and her married/current name on others — both are genuinely her own money moving between her
// own accounts.
//
// Added a "Gender" select and a "Maiden name" field (shown only when Female + Married), threaded
// through getAnswers/session-restore/reset, and buildIncomeSourceBreakdown now takes an optional
// maidenName parameter, folding it in as one more holder-name variant alongside the auto-detected ones
// — so a sender-side candidate matching EITHER the typed passport name or the maiden name routes to
// Self.
const assert = require('assert');
const { newPageAt, passConsentGate, goToSessionByLabel } = require('./helpers');

exports.run = async function(ctx){
  var page = await newPageAt(ctx.browser, '/index.html');
  try {
    await passConsentGate(page);
    // #rs_gender/#rs_married live inside the collapsed "Your responsibilities" session card —
    // Playwright's actionability checks require the element to be visible for selectOption/check
    // (unlike $eval, which works on hidden elements), so the card must be opened first.
    await goToSessionByLabel(page, 'Your responsibilities');

    // ---- UI: the maiden-name field only appears for a married female applicant ----
    await page.selectOption('#rs_gender', 'female');
    await page.check('#rs_married');
    await page.waitForSelector('#rs_maidenNameRow:not([style*="display: none"])');
    var maidenRowVisible = await page.$eval('#rs_maidenNameRow', function(el){ return el.style.display !== 'none'; });
    assert.strictEqual(maidenRowVisible, true, 'Maiden name field should show once Female + Married are both set');

    // Unchecking married (still Female) should hide it again.
    await page.uncheck('#rs_married');
    await page.waitForFunction(function(){
      var el = document.getElementById('rs_maidenNameRow');
      return el && el.style.display === 'none';
    }, { timeout: 3000 });

    // Male + married should NOT show the maiden name field.
    await page.selectOption('#rs_gender', 'male');
    await page.check('#rs_married');
    await page.waitForTimeout(200);
    var maidenRowHiddenForMale = await page.$eval('#rs_maidenNameRow', function(el){ return el.style.display === 'none'; });
    assert.strictEqual(maidenRowHiddenForMale, true, 'Maiden name field should stay hidden for a male applicant even if married');

    // ---- Logic: buildIncomeSourceBreakdown routes a maiden-name-matching sender to Self ----
    var withMaidenName = await page.evaluate(function(){
      return window.__testBuildIncomeSourceBreakdown([
        { narration: 'NIP TRF GOOD EMPLOYER LTD IFO CHIDINMA EZE', credit: 300000, dateISO: '2026-01-15' },
        { narration: 'NIP TRF GOOD EMPLOYER LTD IFO CHIDINMA EZE', credit: 300000, dateISO: '2026-02-15' },
        { narration: 'NIP TRF GOOD EMPLOYER LTD IFO CHIDINMA EZE', credit: 300000, dateISO: '2026-03-15' },
        // Same person, narrated under her MAIDEN name — a bank account opened before marriage.
        { narration: 'BANKNIP From 000014 PAYREF: - SENDER: CHIDINMA OKAFOR', credit: 15000, dateISO: '2026-04-01' }
      ], 'Chidinma Eze', 'Chidinma Okafor');
    });
    var selfWithMaiden = withMaidenName.filter(function(g){ return g.type === 'self'; });
    assert.strictEqual(selfWithMaiden.length, 1, 'The maiden-name payment should be classified as Self when the maiden name is supplied, got: ' + JSON.stringify(withMaidenName));
    assert.strictEqual(selfWithMaiden[0].total, 15000, 'Self total should be exactly the maiden-name payment, got: ' + selfWithMaiden[0].total);

    // Negative control: WITHOUT passing the maiden name, the same payment has no way to be recognized
    // as the applicant's own money (nothing on this statement establishes "Chidinma Okafor" as a
    // recurring recipient-side variant) — it should NOT land in Self.
    var withoutMaidenName = await page.evaluate(function(){
      return window.__testBuildIncomeSourceBreakdown([
        { narration: 'NIP TRF GOOD EMPLOYER LTD IFO CHIDINMA EZE', credit: 300000, dateISO: '2026-01-15' },
        { narration: 'NIP TRF GOOD EMPLOYER LTD IFO CHIDINMA EZE', credit: 300000, dateISO: '2026-02-15' },
        { narration: 'NIP TRF GOOD EMPLOYER LTD IFO CHIDINMA EZE', credit: 300000, dateISO: '2026-03-15' },
        { narration: 'BANKNIP From 000014 PAYREF: - SENDER: CHIDINMA OKAFOR', credit: 15000, dateISO: '2026-04-01' }
      ], 'Chidinma Eze');
    });
    var selfWithoutMaiden = withoutMaidenName.filter(function(g){ return g.type === 'self'; });
    assert.strictEqual(selfWithoutMaiden.length, 0, 'Without the maiden name on file, that payment should not be classified as Self, got: ' + JSON.stringify(withoutMaidenName));
  } finally {
    await page.context().close();
  }
};
