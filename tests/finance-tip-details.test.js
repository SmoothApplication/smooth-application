'use strict';
// Real feedback from an in-person street test (office demo): the checklist "looks as long as an
// embassy form." Investigation showed every optional panel on the Financial readiness calculator
// (flight breakdown, transport helper, shopping/sightseeing, currency helper) was ALREADY collapsed
// by default — the actual bulk was several always-shown explanatory paragraphs sitting under
// individual fields, not open optional sections. Fixed by collapsing the two purely-explanatory
// ones (accommodation cost, opening balance — both explain WHAT HAPPENS LATER, not a rule the
// applicant needs before typing) behind a "Why?" <details> disclosure, reusing the same collapse
// pattern already used for the consent-gate's "Read the full disclaimer" toggle. The closing-balance
// tip (states an actual validation rule — must sum to the uploaded statements' total) and the short
// one-line foreign-currency note were deliberately left inline, uncollapsed — see the .tip-details
// CSS comment in index.html for that same distinction.
const assert = require('assert');
const { newPageAt, passConsentGate, goToSessionByLabel } = require('./helpers');

exports.run = async function(ctx){
  var page = await newPageAt(ctx.browser, '/index.html');
  try {
    await passConsentGate(page);
    await goToSessionByLabel(page, 'Financial readiness calculator');
    await page.waitForSelector('#fc_accom');

    // Collapsed by default — the whole point of the fix.
    var accomOpen = await page.$eval('#fc_accom', function(el){
      var d = el.parentElement.querySelector('details.tip-details');
      return d ? d.open : null;
    });
    assert.strictEqual(accomOpen, false, 'Accommodation "Why?" tip should be collapsed by default');
    var openingOpen = await page.$eval('#fc_opening', function(el){
      var d = el.parentElement.querySelector('details.tip-details');
      return d ? d.open : null;
    });
    assert.strictEqual(openingOpen, false, 'Opening balance "Why?" tip should be collapsed by default');

    // The tip text itself is still there (not deleted, just collapsed) and reachable by clicking.
    var accomSummary = await page.$eval('#fc_accom', function(el){
      var d = el.parentElement.querySelector('details.tip-details summary');
      return d ? d.textContent.trim() : null;
    });
    assert.strictEqual(accomSummary, 'Why?', 'Accommodation field should have a "Why?" toggle');
    await page.click('#fc_accom ~ details.tip-details summary');
    var accomTipVisible = await page.$eval('#fc_accom', function(el){
      var d = el.parentElement.querySelector('details.tip-details');
      return d && d.open && /nightly rate/.test(d.textContent);
    });
    assert.ok(accomTipVisible, 'Clicking "Why?" should reveal the accommodation explanation text');

    // A load-bearing rule (not just rationale) stays visible, uncollapsed, by design.
    var closingRuleVisible = await page.$eval('#fc_closing', function(el){
      var wrap = el.parentElement;
      return /must equal/.test(wrap.textContent) && !wrap.querySelector('#fc_closing ~ details.tip-details');
    });
    assert.ok(closingRuleVisible, 'The closing-balance validation rule should stay inline, not collapsed');

    // Wrapping the tip in <details> must not have broken the field itself.
    await page.fill('#fc_accom', '65,000');
    var accomVal = await page.$eval('#fc_accom', function(el){ return el.value; });
    assert.strictEqual(accomVal, '65,000', 'Accommodation field should still accept input normally');
  } finally {
    await page.context().close();
  }
};
