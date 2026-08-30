'use strict';
// Real user report (two screenshots, same LGA): "26, Hunponu Wusu Street, Lekki Phase 1" and "26,
// Thomas Estate, Ajah" — both Lagos / Eti Osa / 3 bedroom — came back the exact same rent estimate,
// ₦10,350,000. Root cause: Eti Osa's own [3M, 15M] range was already the widest of any Lagos LGA in
// this table (a 5x spread, vs ~2-2.5x for most others), because it blends genuinely incomparable
// neighbourhoods — Ikoyi/VI, Lekki Phase 1, and the much cheaper Ajah/Sangotedo corridor — into one
// number, and the free-text house/street fields were never fed into the estimate to begin with.
// Fixed by adding a "Which part of Eti Osa?" sub-area picker (see ETI_OSA_SUB_AREA_RENT in
// index.html), shown only for that one LGA — every other LGA is unaffected.
const assert = require('assert');
const { newPageAt, passConsentGate, goToSessionByPill } = require('./helpers');

exports.run = async function(ctx){
  var page = await newPageAt(ctx.browser, '/index.html');
  try {
    await passConsentGate(page);
    await goToSessionByPill(page, 2);
    await page.waitForSelector('#rs_state');

    // Not shown at all for a different state.
    await page.selectOption('#rs_state', 'Oyo');
    await page.waitForFunction(function(){ return document.getElementById('rs_lga').options.length > 1; }, { timeout: 3000 });
    var hiddenForOtherState = await page.$eval('#rs_etiOsaAreaRow', function(el){ return el.style.display === 'none'; });
    assert.strictEqual(hiddenForOtherState, true, 'Sub-area row should stay hidden for a non-Lagos state');

    await page.selectOption('#rs_state', 'Lagos');
    await page.waitForFunction(function(){ return document.getElementById('rs_lga').options.length > 1; }, { timeout: 3000 });

    // Not shown for a different Lagos LGA either.
    await page.selectOption('#rs_lga', 'Ikeja');
    await page.waitForTimeout(150);
    var hiddenForOtherLga = await page.$eval('#rs_etiOsaAreaRow', function(el){ return el.style.display === 'none'; });
    assert.strictEqual(hiddenForOtherLga, true, 'Sub-area row should stay hidden for a Lagos LGA other than Eti Osa');

    // Shown once Eti Osa is picked.
    await page.selectOption('#rs_lga', 'Eti Osa');
    await page.waitForTimeout(150);
    var shownForEtiOsa = await page.$eval('#rs_etiOsaAreaRow', function(el){ return el.style.display !== 'none'; });
    assert.strictEqual(shownForEtiOsa, true, 'Sub-area row should appear once Eti Osa is picked');

    await page.selectOption('#rs_bedrooms', '3bed');
    await page.waitForFunction(function(){ return document.getElementById('rs_annualRent').value !== ''; }, { timeout: 3000 });

    // No sub-area picked yet — same blended figure as before this fix (the reported bug).
    var rentNoSubArea = await page.$eval('#rs_annualRent', function(el){ return el.value; });
    assert.strictEqual(rentNoSubArea, '10350000', 'With no sub-area picked, should still fall back to the old blended figure, got: ' + rentNoSubArea);

    // Lekki Phase 1 and Ajah must now give genuinely different figures — the whole point of the fix.
    await page.selectOption('#rs_etiOsaArea', 'Lekki Phase 1');
    await page.waitForFunction(function(){ return document.getElementById('rs_annualRent').value !== '10350000'; }, { timeout: 3000 });
    var rentLekki = await page.$eval('#rs_annualRent', function(el){ return el.value; });

    await page.selectOption('#rs_etiOsaArea', 'Ajah / Sangotedo / Lekki (Phase 2 and beyond)');
    await page.waitForFunction(function(){ return document.getElementById('rs_annualRent').value !== rentLekki; }, { timeout: 3000 });
    var rentAjah = await page.$eval('#rs_annualRent', function(el){ return el.value; });

    assert.notStrictEqual(rentLekki, rentAjah, 'Lekki Phase 1 and Ajah should no longer share the same rent estimate');
    assert.ok(parseInt(rentLekki, 10) > parseInt(rentAjah, 10), 'Lekki Phase 1 estimate should be higher than Ajah, got Lekki=' + rentLekki + ' Ajah=' + rentAjah);

    // A manually-typed rent figure is never clobbered by a sub-area change, same guarantee the
    // existing LGA/bedroom auto-fill already gives.
    await page.fill('#rs_annualRent', '999999');
    await page.selectOption('#rs_etiOsaArea', 'Ikoyi / Victoria Island');
    await page.waitForTimeout(200);
    var rentAfterManualEdit = await page.$eval('#rs_annualRent', function(el){ return el.value; });
    assert.strictEqual(rentAfterManualEdit, '999999', 'A manually-entered rent figure should never be overwritten by a sub-area change');
  } finally {
    await page.context().close();
  }
};
