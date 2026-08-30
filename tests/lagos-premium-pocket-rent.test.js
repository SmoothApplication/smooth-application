'use strict';
// Follow-up to eti-osa-sub-area-rent.test.js: the user separately flagged Ogudu (inside Kosofe LGA)
// and Ikeja GRA / Alausa / the Airport Road axis (inside Ikeja LGA) as the same shape of problem —
// a well-known, meaningfully pricier pocket getting silently averaged into the rest of its LGA's
// rent range. Both were verified against real listings (see LAGOS_PREMIUM_POCKET comment in
// index.html) before shipping: Ikeja GRA lists ₦15-35M for a 3-bed vs the ₦2-4.5M base Ikeja range;
// Ogudu averages ₦4M vs the ₦1.2-2.8M base Kosofe range. Unlike Eti Osa (3 genuinely different
// areas, no sensible single default), this is a binary distinction, so it's a checkbox rather than
// a dropdown, sharing one slot whose label text changes per-LGA.
const assert = require('assert');
const { newPageAt, passConsentGate, goToSessionByPill } = require('./helpers');

exports.run = async function(ctx){
  var page = await newPageAt(ctx.browser, '/index.html');
  try {
    await passConsentGate(page);
    await goToSessionByPill(page, 2);
    await page.waitForSelector('#rs_state');
    await page.selectOption('#rs_state', 'Lagos');
    await page.waitForFunction(function(){ return document.getElementById('rs_lga').options.length > 1; }, { timeout: 3000 });

    // Hidden for an LGA with no known premium pocket.
    await page.selectOption('#rs_lga', 'Surulere');
    await page.waitForTimeout(150);
    var hiddenElsewhere = await page.$eval('#rs_premiumPocketRow', function(el){ return el.style.display === 'none'; });
    assert.strictEqual(hiddenElsewhere, true, 'Premium-pocket checkbox should stay hidden for an LGA with no known pocket');

    // Shown for Ikeja, labelled for Ikeja GRA specifically.
    await page.selectOption('#rs_lga', 'Ikeja');
    await page.waitForTimeout(150);
    var ikejaLabel = await page.$eval('#rs_premiumPocketLabel', function(el){ return el.textContent; });
    assert.ok(/Ikeja GRA/.test(ikejaLabel), 'Checkbox label should mention Ikeja GRA, got: ' + ikejaLabel);

    await page.selectOption('#rs_bedrooms', '3bed');
    await page.waitForFunction(function(){ return document.getElementById('rs_annualRent').value !== ''; }, { timeout: 3000 });
    var ikejaBase = await page.$eval('#rs_annualRent', function(el){ return el.value; });

    await page.check('#rs_premiumPocket');
    await page.waitForFunction(function(base){
      return document.getElementById('rs_annualRent').value !== base;
    }, ikejaBase, { timeout: 3000 });
    var ikejaGra = await page.$eval('#rs_annualRent', function(el){ return el.value; });
    assert.ok(parseInt(ikejaGra, 10) > parseInt(ikejaBase, 10), 'Ticking Ikeja GRA should raise the estimate, got base=' + ikejaBase + ' GRA=' + ikejaGra);

    // Switching to Kosofe re-labels the same checkbox for Ogudu and re-estimates accordingly.
    await page.selectOption('#rs_lga', 'Kosofe');
    await page.waitForTimeout(150);
    var kosofeLabel = await page.$eval('#rs_premiumPocketLabel', function(el){ return el.textContent; });
    assert.ok(/Ogudu/.test(kosofeLabel), 'Checkbox label should mention Ogudu once Kosofe is picked, got: ' + kosofeLabel);
  } finally {
    await page.context().close();
  }
};
