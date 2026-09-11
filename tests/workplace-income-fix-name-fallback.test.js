'use strict';
// User request, off a real statement: "AGBOOLA MARY OLUWAFUNMILAYO stated she works with Crisp N
// Clean Exclusive Solutions Ltd. Workplace should be populated with all inflows from the stated
// place of work... Extract all inflows from Crisp N Clean Exclusive Solutions Ltd into Work place."
//
// The Workplace income tab is populated by findInflowsMatchingName(declaredEmployerName, txns),
// which requires at least 2 of the declared name's distinctive words to appear in a transaction's
// OWN narration (a deliberate safety threshold — see false-positive-name-match.test.js, which guards
// against a single shared generic word wrongly attributing a payment to the wrong company). The real
// statement here narrates every one of these payments only as "SENDER: CRISP N" — just ONE of the
// full declared name's four distinctive words (Crisp/Clean/Exclusive/Solutions) — so no amount of
// typing the employer name correctly would ever clear that 2-word bar from the raw narration alone,
// and the tab stayed empty.
//
// Fix: the applicant has already confirmed this exact link themselves via "Fix name" on the Income
// sources breakdown (senderNameCorrections, keyed by the raw extracted name "Crisp N"). findInflows
// MatchingName now also checks the declared name against that CONFIRMED fuller name for any
// transaction whose own hitCount falls short — so once she's corrected the name, those payments
// populate Workplace income too, without loosening the general "one shared generic word" guard for
// everyone else (it only ever fires for a transaction she's personally relabelled).
const assert = require('assert');
const { newPageAt } = require('./helpers');

exports.run = async function(ctx){
  var page = await newPageAt(ctx.browser, '/index.html');
  try {
    await page.waitForSelector('#quizIntro');

    var txns = [
      { narration: 'BANKNIP From 090405 PAYREF: - SENDER: CRISP N', credit: 350000, dateISO: '2026-04-04' },
      { narration: 'BANKNIP From 090405 PAYREF: - SENDER: CRISP N', credit: 350000, dateISO: '2026-05-04' },
      // Different, unrelated sender — must never be swept in just because the declared name and this
      // payment happen to share nothing at all (negative control).
      { narration: 'BANKNIP From 000015 PAYREF: - SENDER: 41867 YARO REMARK: Ok', credit: 100000, dateISO: '2026-06-01' }
    ];

    // Without any "Fix name" correction on file, the raw narration alone ("CRISP N") only ever
    // supplies ONE of the declared name's distinctive words — should NOT match (guards against
    // loosening the general threshold).
    var withoutCorrection = await page.evaluate(function(args){
      return window.__testFindInflowsMatchingNameWithCorrections(args.name, args.txns, {});
    }, { name: 'Crisp N Clean Exclusive Solutions Ltd', txns: txns });
    assert.strictEqual(withoutCorrection.matchCount, 0,
      'Without a confirmed "Fix name" correction, the truncated narration alone should not match, got: ' + JSON.stringify(withoutCorrection));

    // With the applicant's own "Crisp N" -> "Crisp N Clean Exclusive Solutions Ltd" correction on
    // file, both genuine Crisp N payments should now populate Workplace income; the unrelated Yaro
    // payment still must not.
    var withCorrection = await page.evaluate(function(args){
      return window.__testFindInflowsMatchingNameWithCorrections(args.name, args.txns, args.corrections);
    }, { name: 'Crisp N Clean Exclusive Solutions Ltd', txns: txns, corrections: { 'Crisp N': 'Crisp N Clean Exclusive Solutions Ltd' } });
    assert.strictEqual(withCorrection.matchCount, 2,
      'Both "Crisp N" payments should match once the applicant has confirmed the fuller name, got: ' + JSON.stringify(withCorrection));
    assert.strictEqual(withCorrection.matchTotal, 700000,
      'Matched total should be 700000 (the two Crisp N payments only), got: ' + JSON.stringify(withCorrection));
  } finally {
    await page.context().close();
  }
};
