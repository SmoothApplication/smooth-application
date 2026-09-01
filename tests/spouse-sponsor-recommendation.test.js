'use strict';
// Field-work insight, shared verbatim by the founder: "if his/her income can cover both of you, he/
// she becomes the main applicant. If he/she already has a UK visa, it can be stated he/she is taking
// you along on his/her next trip." Who actually applies — and whose money pays for it — is a real,
// open decision for a married applicant, not something this checklist should silently assume is
// always "you, self-funded". This checks the three follow-up questions under "I'm married" (is your
// spouse willing/employed/UK-experienced), the ONE clear recommendation they produce, and that only
// the "spouse becomes financial sponsor" branch offers an explicit confirm checkbox that adds a real
// checklist item — advisory only, never automatic (see renderSponsorRecommendation's own comment for
// why an explicit confirm matters).
const assert = require('assert');
const { newPageAt, passConsentGate, goToSessionByLabel } = require('./helpers');

exports.run = async function(ctx){
  var page = await newPageAt(ctx.browser, '/index.html');
  try {
    await passConsentGate(page);
    await goToSessionByLabel(page, 'Your responsibilities');

    // Not married yet — nothing shown.
    var boxEmpty = await page.$eval('#rs_sponsorRecommendationBox', function(el){ return el.innerHTML.trim(); });
    assert.strictEqual(boxEmpty, '', 'No recommendation should show before "I\'m married" is ticked');

    await page.check('#rs_married');
    await page.fill('#rs_spouseName', 'Ngozi Adeyemi');

    // Spouse already has UK history — narrative recommendation, no checklist change.
    await page.selectOption('#rs_spouseUkHistory', 'yes');
    await page.waitForTimeout(50);
    var ukHistoryText = await page.$eval('#rs_sponsorRecommendationBox', function(el){ return el.textContent; });
    assert.ok(/taking you along/i.test(ukHistoryText), 'Should suggest the "taking you along on their next UK trip" framing, got: ' + ukHistoryText);
    var confirmHiddenForHistory = await page.$eval('#rs_spouseSponsoringRow', function(el){ return el.style.display; });
    assert.strictEqual(confirmHiddenForHistory, 'none', 'This branch is narrative-only — no confirm checkbox should appear');
    var itemAbsent1 = await page.$('#item_spouseSponsorFinance');
    assert.ok(!itemAbsent1, 'No new checklist item should appear from the UK-history branch alone');

    // Reset that answer, then walk the "spouse sponsors" branch.
    await page.selectOption('#rs_spouseUkHistory', '');
    await page.selectOption('#rs_spouseWilling', 'yes');
    await page.selectOption('#rs_spouseEmployed', 'no');
    await page.waitForTimeout(50);
    var warnText = await page.$eval('#rs_sponsorRecommendationBox', function(el){ return el.textContent; });
    assert.ok(/genuine, provable income/i.test(warnText), 'Willing-but-unemployed should caution about weak sponsor evidence, got: ' + warnText);
    var confirmHiddenForWeak = await page.$eval('#rs_spouseSponsoringRow', function(el){ return el.style.display; });
    assert.strictEqual(confirmHiddenForWeak, 'none', 'No confirm checkbox for the weak-sponsor caution branch');

    await page.selectOption('#rs_spouseEmployed', 'yes');
    await page.waitForTimeout(50);
    var okText = await page.$eval('#rs_sponsorRecommendationBox', function(el){ return el.textContent; });
    assert.ok(/act as your financial sponsor/i.test(okText), 'Willing-and-employed should recommend the sponsor route, got: ' + okText);
    var confirmVisible = await page.$eval('#rs_spouseSponsoringRow', function(el){ return el.style.display; });
    assert.strictEqual(confirmVisible, 'flex', 'The confirm checkbox should appear for the willing-and-employed branch');

    // Nothing changes on the checklist until the applicant actively confirms — advisory, not automatic.
    var itemAbsent2 = await page.$('#item_spouseSponsorFinance');
    assert.ok(!itemAbsent2, 'Checklist should NOT change just from seeing the recommendation');

    await page.check('#rs_spouseSponsoring');
    await page.waitForTimeout(50);
    var itemPresent = await page.$('#item_spouseSponsorFinance');
    assert.ok(itemPresent, 'Ticking the confirm checkbox should add the spouse-sponsor document to the checklist');

    // Changing the answer out from under a ticked confirmation clears it, rather than leaving a
    // stale, hidden checkbox silently keeping the item required.
    await page.selectOption('#rs_spouseEmployed', 'no');
    await page.waitForTimeout(50);
    var uncheckedAfterChange = await page.$eval('#rs_spouseSponsoring', function(el){ return el.checked; });
    assert.strictEqual(uncheckedAfterChange, false, 'Confirmation should clear itself if the underlying answers no longer support it');
    var itemGone = await page.$('#item_spouseSponsorFinance');
    assert.ok(!itemGone, 'Checklist item should disappear once the confirmation is cleared');
  } finally {
    await page.context().close();
  }
};
