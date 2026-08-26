'use strict';
// User feedback: "ask how many bedroom under 'Where do you live?' Create a dropdown menu... They
// populate the price section based on the area chosen and how many bedroom the person lives in."
// Adds a bedroom-count dropdown (rs_bedrooms) next to the existing state/LGA pickers, and scales
// the area-based rent estimate (see BEDROOM_RENT_MULTIPLIER/getEstimatedAnnualRent in index.html)
// up or down depending on which bedroom count is chosen, instead of always assuming the "typical
// 2-3 bedroom home" baseline that pre-dated this feature.
const assert = require('assert');
const { newPageAt, passConsentGate, goToSessionByPill } = require('./helpers');

exports.run = async function(ctx){
  var page = await newPageAt(ctx.browser, '/index.html');
  try {
    await passConsentGate(page);
    await goToSessionByPill(page, 2);
    await page.waitForSelector('#rs_state');

    // Lagos + Shomolu's own range is ₦1,200,000–₦1,800,000 (see yearly-cost-of-living-estimate.test.js).
    await page.selectOption('#rs_state', 'Lagos');
    await page.waitForFunction(function(){
      var el = document.getElementById('rs_lga');
      return el && el.options.length > 1;
    }, { timeout: 3000 });
    await page.selectOption('#rs_lga', 'Shomolu');
    await page.waitForFunction(function(){
      var el = document.getElementById('rs_annualRent');
      return el && el.value !== '';
    }, { timeout: 3000 });

    // No bedroom count picked yet — falls back to the un-scaled midpoint, same as before this
    // feature existed (₦1,200,000 + ₦1,800,000 → ₦1,500,000 midpoint).
    var rentNoBedrooms = await page.$eval('#rs_annualRent', function(el){ return el.value; });
    assert.strictEqual(rentNoBedrooms, '1500000', 'With no bedroom count picked, rent should stay the un-scaled midpoint, got: ' + rentNoBedrooms);

    // Picking "A room (self-contain)" (0.4x) should scale the estimate DOWN: midpoint of
    // [1,200,000*0.4, 1,800,000*0.4] = [480,000, 720,000] → 600,000.
    await page.selectOption('#rs_bedrooms', 'room');
    await page.waitForFunction(function(){
      return document.getElementById('rs_annualRent').value === '600000';
    }, { timeout: 3000 });

    // Switching to "3 bedroom" (1.15x) should scale the estimate back UP: midpoint of
    // [1,200,000*1.15, 1,800,000*1.15] = [1,380,000, 2,070,000] → 1,725,000.
    await page.selectOption('#rs_bedrooms', '3bed');
    await page.waitForFunction(function(){
      return document.getElementById('rs_annualRent').value === '1725000';
    }, { timeout: 3000 });
    var rent3Bed = await page.$eval('#rs_annualRent', function(el){ return el.value; });
    assert.strictEqual(rent3Bed, '1725000', '3-bedroom should scale the estimate up by 1.15x, got: ' + rent3Bed);

    // And "5 bedroom duplex" (2.4x) should scale it up further still: midpoint of
    // [1,200,000*2.4, 1,800,000*2.4] = [2,880,000, 4,320,000] → 3,600,000.
    await page.selectOption('#rs_bedrooms', '5bedDuplex');
    await page.waitForFunction(function(){
      return document.getElementById('rs_annualRent').value === '3600000';
    }, { timeout: 3000 });

    // A manually-typed rent figure is never clobbered by a later bedroom-count change, same
    // guarantee the existing auto-fill already gives for state/LGA changes.
    await page.fill('#rs_annualRent', '999999');
    await page.selectOption('#rs_bedrooms', 'room');
    await page.waitForTimeout(200);
    var rentAfterManualEdit = await page.$eval('#rs_annualRent', function(el){ return el.value; });
    assert.strictEqual(rentAfterManualEdit, '999999', 'A manually-entered rent figure should never be overwritten by a bedroom-count change, got: ' + rentAfterManualEdit);
  } finally {
    await page.context().close();
  }
};
