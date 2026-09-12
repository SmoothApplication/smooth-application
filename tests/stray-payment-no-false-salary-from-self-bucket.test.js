'use strict';
// User-reported bug, off a real statement: a single, isolated ₦18,730 payment with a blank/coded
// narration ("AFRC - 080615544100155048 4891" - no sender name at all) got tagged "Salary", even
// though it has nothing to do with the declared employer (Crisp N Clean Exclusive Solutions Ltd).
// User's own words: "This cannot be salary. Salary from what she filled has to be from Crisp N Clean
// Exclusive Solutions Ltd."
//
// Root cause: the applicant's OWN recurring self-transfers (many ₦20,000 payments to herself, already
// correctly classified as Self — see self-inflow-holder-name-variants.test.js) rounded to the exact
// same ₦5,000 bucket as this stray payment. identifyStableIncome/identifyIncomeSourceName ran on ALL
// credits with no awareness of Self at all, so those self-transfers alone established ₦20,000 as "the"
// recurring stable-income amount — a bucket that then had room for the blank-narration payment to ride
// along for free (a transaction with no sender name is trusted as salary when its rounded amount
// matches the established pattern). Self-transfers aren't anyone's income and should never be able to
// manufacture a false "stable income" pattern — fixed by filtering them out of buildIncomeSourceBreakdown's
// stable-amount detection before it ever runs.
const assert = require('assert');
const { newPageAt, passConsentGate } = require('./helpers');

exports.run = async function(ctx){
  var page = await newPageAt(ctx.browser, '/index.html');
  try {
    await passConsentGate(page);

    var groups = await page.evaluate(function(){
      return window.__testBuildIncomeSourceBreakdown([
        // The applicant's own recurring self-transfers — several ₦20,000 payments, narrated with her
        // own full name as "sender" (a known channel quirk), across 3 distinct months.
        { narration: 'BANKNIP From 000014 PAYREF: - SENDER: AGBOOLA MARY OLUWAFUNMILAYO', credit: 20000, dateISO: '2026-02-04' },
        { narration: 'BANKNIP From 000014 PAYREF: - SENDER: AGBOOLA MARY OLUWAFUNMILAYO', credit: 20000, dateISO: '2026-03-04' },
        { narration: 'BANKNIP From 000014 PAYREF: - SENDER: AGBOOLA MARY OLUWAFUNMILAYO', credit: 20000, dateISO: '2026-04-04' },
        // Genuine recurring salary from the declared employer, in 3 different months, at a completely
        // different amount.
        { narration: 'BANKNIP From 090405 PAYREF: - SENDER: CRISP N', credit: 350000, dateISO: '2026-01-07' },
        { narration: 'BANKNIP From 090405 PAYREF: - SENDER: CRISP N', credit: 350000, dateISO: '2026-02-07' },
        { narration: 'BANKNIP From 090405 PAYREF: - SENDER: CRISP N', credit: 350000, dateISO: '2026-03-07' },
        // The stray, isolated, blank-narration payment in question — rounds to the same ₦20,000
        // bucket as the self-transfers above, but has nothing to do with either the self-transfers or
        // the declared employer.
        { narration: '3373260214/10000226 - AFRC - 080615544100155048 4891', credit: 18730, dateISO: '2026-08-06' }
      ], 'Agboola Mary Oluwafunmilayo');
    });

    var salaryGroups = groups.filter(function(g){ return g.type === 'salary'; });
    assert.strictEqual(salaryGroups.length, 1, 'Should still form exactly one Salary group off the genuine employer payments, got: ' + JSON.stringify(groups));
    assert.strictEqual(salaryGroups[0].total, 1050000, 'Salary total should be exactly the 3 genuine ₦350,000 Crisp N payments — the stray ₦18,730 payment must not be folded in, got: ' + salaryGroups[0].total);
    assert.strictEqual(salaryGroups[0].count, 3, 'Salary should count exactly the 3 genuine Crisp N payments, got: ' + salaryGroups[0].count);
    assert.ok(!/18,730|18730/.test(JSON.stringify(salaryGroups)), 'The stray ₦18,730 amount should not appear anywhere in the Salary group, got: ' + JSON.stringify(salaryGroups));

    var selfGroups = groups.filter(function(g){ return g.type === 'self'; });
    assert.strictEqual(selfGroups.length, 1, 'The 3 self-transfers should still be classified as Self, got: ' + JSON.stringify(groups));
    assert.strictEqual(selfGroups[0].total, 60000, 'Self total should be exactly the 3 ₦20,000 self-transfers, got: ' + selfGroups[0].total);
  } finally {
    await page.context().close();
  }
};
