'use strict';
// Real feedback from an in-person street test (office demo): the checklist "looks as long as an
// embassy form." Investigation showed every optional panel on the Financial readiness calculator
// (flight breakdown, transport helper, shopping/sightseeing, currency helper) was ALREADY collapsed
// by default — the actual bulk was several always-shown explanatory paragraphs sitting under
// individual fields, not open optional sections. First fix: collapse the two purely-explanatory ones
// (accommodation cost, opening balance) behind a "Why?" <details> disclosure. Later user request:
// pull every "Why?" disclosure out of the main flow entirely, into a single "Reasons" tab reachable
// from anywhere (see collectReasons()/initReasonsModal() in index.html) — so these two no longer sit
// inline at all, collapsed or otherwise; their text now lives in that modal instead. The
// closing-balance tip (an actual validation rule, not rationale) and the short one-line foreign-
// currency note were deliberately left inline, uncollapsed, throughout both changes — see the
// .tip-details CSS comment in index.html for that distinction.
const assert = require('assert');
const { newPageAt, passConsentGate, goToSessionByLabel } = require('./helpers');

exports.run = async function(ctx){
  var page = await newPageAt(ctx.browser, '/index.html');
  try {
    await passConsentGate(page);
    await goToSessionByLabel(page, 'Financial readiness calculator');
    await page.waitForSelector('#fc_accom');

    // Moved out entirely now — no "Why?" toggle left sitting next to either field.
    var accomHasTipDetails = await page.$eval('#fc_accom', function(el){
      return !!el.parentElement.querySelector('details.tip-details');
    });
    assert.strictEqual(accomHasTipDetails, false, 'Accommodation "Why?" toggle should no longer sit inline — moved to the Reasons tab');
    var openingHasTipDetails = await page.$eval('#fc_opening', function(el){
      return !!el.parentElement.querySelector('details.tip-details');
    });
    assert.strictEqual(openingHasTipDetails, false, 'Opening balance "Why?" toggle should no longer sit inline — moved to the Reasons tab');

    // A load-bearing rule (not just rationale) still stays visible, uncollapsed, by design.
    var closingRuleVisible = await page.$eval('#fc_closing', function(el){
      var wrap = el.parentElement;
      return /must equal/.test(wrap.textContent) && !wrap.querySelector('#fc_closing ~ details.tip-details');
    });
    assert.ok(closingRuleVisible, 'The closing-balance validation rule should stay inline, not collapsed or moved');

    // The accommodation explanation is still reachable — just from the Reasons tab now, grouped
    // under this session's heading, rather than a click right next to the field.
    await page.click('#reasonsTabBtn');
    await page.waitForSelector('#reasonsModalOverlay:not([hidden])');
    var reasonsHtml = await page.$eval('#reasonsModalBody', function(el){ return el.innerHTML; });
    assert.ok(/nightly rate/.test(reasonsHtml), 'The accommodation "Why?" explanation should still exist, now inside the Reasons tab, got: ' + reasonsHtml.slice(0, 300));
    assert.ok(/Financial readiness calculator/.test(reasonsHtml), 'Reasons entries should be grouped under their session\'s real name, got: ' + reasonsHtml.slice(0, 300));
    await page.click('#reasonsModalClose');

    // Wrapping the tip in <details> (and later moving it) must not have broken the field itself.
    await page.fill('#fc_accom', '65,000');
    var accomVal = await page.$eval('#fc_accom', function(el){ return el.value; });
    assert.strictEqual(accomVal, '65,000', 'Accommodation field should still accept input normally');
  } finally {
    await page.context().close();
  }
};
