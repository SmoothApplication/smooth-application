'use strict';
// User request: pull the "Why?" explanations (and a curated handful of purely-framing paragraphs,
// marked data-reason="1") out of the main flow entirely, into one place reachable from a floating
// "Reasons" tab on every screen — see collectReasons()/renderReasonsModal()/initReasonsModal() in
// index.html. Covers: the tab is visible even before the consent gate is passed (it's a direct sibling
// of <body>, not nested inside any gate/session), opening/closing the modal, and that content is
// actually grouped under real session names rather than dumped flat.
const assert = require('assert');
const { newPageAt, passConsentGate } = require('./helpers');

exports.run = async function(ctx){
  var page = await newPageAt(ctx.browser, '/index.html');
  try {
    // Visible before the consent gate is even passed — "every page", not just inside the checklist.
    await page.waitForSelector('#quizSkipLink');
    var tabVisibleOnGate = await page.$eval('#reasonsTabBtn', function(el){ return getComputedStyle(el).display !== 'none'; });
    assert.strictEqual(tabVisibleOnGate, true, 'Reasons tab should be visible even on the pre-consent quiz screen');

    var overlayHiddenInitially = await page.$eval('#reasonsModalOverlay', function(el){ return el.hidden; });
    assert.strictEqual(overlayHiddenInitially, true, 'Reasons modal should start closed');

    await page.click('#reasonsTabBtn');
    await page.waitForSelector('#reasonsModalOverlay:not([hidden])');

    // Landing screen's own FAQ ("Why trust a free tool with this?" etc.) lives here now too, grouped
    // under a "Getting started" heading since it sits outside any [data-session-key] card.
    var htmlOnGate = await page.$eval('#reasonsModalBody', function(el){ return el.innerHTML; });
    assert.ok(/Getting started/.test(htmlOnGate), 'Pre-session content should be grouped under a fallback heading, got: ' + htmlOnGate.slice(0, 200));
    assert.ok(/Why trust a free tool with this\?/.test(htmlOnGate), 'Landing FAQ question should have moved into Reasons, got: ' + htmlOnGate.slice(0, 300));

    // Escape closes it.
    await page.keyboard.press('Escape');
    var overlayHiddenAfterEsc = await page.$eval('#reasonsModalOverlay', function(el){ return el.hidden; });
    assert.strictEqual(overlayHiddenAfterEsc, true, 'Escape should close the Reasons modal');

    // The FAQ question itself should no longer be sitting inline on the landing screen — it moved,
    // not just got duplicated.
    var faqStillOnPage = await page.$('.quiz-intro-faq details.tip-details');
    assert.strictEqual(faqStillOnPage, null, 'The landing FAQ "Why?" toggles should no longer be inline — only in the Reasons tab');

    // Proceed into the real app and check a real session's content shows up grouped correctly, using
    // the passport session's "Why?" tip on the full-name field as a known example.
    await passConsentGate(page);
    await page.click('#reasonsTabBtn');
    await page.waitForSelector('#reasonsModalOverlay:not([hidden])');
    var htmlInApp = await page.$eval('#reasonsModalBody', function(el){ return el.innerHTML; });
    assert.ok(/Validate your International Passport/.test(htmlInApp), 'Passport session\'s reasons should be grouped under its real session title, got: ' + htmlInApp.slice(0, 300));
    assert.ok(/OCR isn't perfect/.test(htmlInApp), 'The full-name field\'s "Why?" explanation should be present in Reasons, got: ' + htmlInApp.slice(0, 500));

    // The count badge on the tab itself should reflect a real, non-zero number.
    var count = await page.$eval('#reasonsTabCount', function(el){ return parseInt(el.textContent, 10); });
    assert.ok(count > 20, 'Should have collected a meaningful number of reasons app-wide, got: ' + count);
  } finally {
    await page.context().close();
  }
};
