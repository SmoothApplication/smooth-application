'use strict';
// User feedback, off Session 3 ("Your responsibilities"): "Depending on the local government do a
// price research on house rent and school fees within the area. After this give a yearly summary
// on your responsibilities." Adds an "Estimated yearly cost of living" box that pre-fills a
// starting rent figure from the selected state/LGA (see LAGOS_LGA_ANNUAL_RENT/STATE_RENT_TIER in
// index.html for the sourcing and the honest caveat that this is a rough starting estimate, not an
// appraisal), a generic upkeep default, and — only once at least one child is declared — a
// per-term school-fee default, then totals them into a yearly figure. Everything stays fully
// editable and a typed-in value is never silently overwritten by the auto-fill.
const assert = require('assert');
const { newPageAt, passConsentGate, goToSessionByPill } = require('./helpers');

exports.run = async function(ctx){
  var page = await newPageAt(ctx.browser, '/index.html');
  try {
    await passConsentGate(page);
    await goToSessionByPill(page, 0);
    await page.waitForSelector('#rs_state');

    // Before any state is picked, no summary should render yet.
    var summaryBefore = await page.$eval('#rs_yearlySummary', function(el){ return el.textContent.trim(); });
    assert.strictEqual(summaryBefore, '', 'Summary should be empty before a state is picked, got: ' + summaryBefore);

    // Picking Lagos + Shomolu should pre-fill rent to the midpoint of the Shomolu-specific range
    // (₦1,200,000–₦1,800,000 → ₦1,500,000), matching the real figures the applicant themselves
    // reported for that LGA.
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
    var rentValue = await page.$eval('#rs_annualRent', function(el){ return el.value; });
    assert.strictEqual(rentValue, '1500000', 'Shomolu should pre-fill the midpoint of its rent range, got: ' + rentValue);
    var upkeepValue = await page.$eval('#rs_monthlyUpkeep', function(el){ return el.value; });
    assert.strictEqual(upkeepValue, '120000', 'Upkeep should pre-fill the generic starting figure, got: ' + upkeepValue);

    // School fee row is hidden until at least one child is declared.
    var schoolRowBefore = await page.$eval('#rs_schoolFeeRow', function(el){ return el.style.display !== 'none'; });
    assert.strictEqual(schoolRowBefore, false, 'School fee row should be hidden with no children declared');

    // Declaring 2 children reveals the school-fee row, pre-filled with the default per-term figure,
    // and the yearly summary totals rent + (upkeep*12) + (schoolFee*3*numKids).
    await page.selectOption('#rs_numKids', '2');
    await page.waitForFunction(function(){
      var el = document.getElementById('rs_schoolFeeRow');
      return el && el.style.display !== 'none';
    }, { timeout: 3000 });
    var schoolValue = await page.$eval('#rs_schoolFeePerTerm', function(el){ return el.value; });
    assert.strictEqual(schoolValue, '300000', 'School fee should pre-fill the default per-term figure, got: ' + schoolValue);

    var summaryText = await page.$eval('#rs_yearlySummary', function(el){ return el.textContent; });
    // 1,500,000 + (120,000*12=1,440,000) + (300,000*3*2=1,800,000) = 4,740,000
    assert.ok(/4,740,000/.test(summaryText), 'Yearly total should be ₦4,740,000, got: ' + summaryText);
    assert.ok(/School fees/.test(summaryText), 'Summary should show the school-fee line once children are declared, got: ' + summaryText);

    // A value the applicant types in themselves is never clobbered by the auto-fill, even when
    // something else on the page re-renders afterward.
    await page.fill('#rs_annualRent', '900000');
    await page.selectOption('#rs_numKids', '3'); // triggers another render() pass
    await page.waitForTimeout(150);
    var rentAfterEdit = await page.$eval('#rs_annualRent', function(el){ return el.value; });
    assert.strictEqual(rentAfterEdit, '900000', 'A manually-entered rent figure should never be overwritten by the auto-fill, got: ' + rentAfterEdit);
    var summaryAfterEdit = await page.$eval('#rs_yearlySummary', function(el){ return el.textContent; });
    assert.ok(/Rent: 900,000/.test(summaryAfterEdit) || /900,000/.test(summaryAfterEdit), 'Summary should reflect the manually-entered rent, got: ' + summaryAfterEdit);

    // Dropping back to 0 children hides the school-fee row again.
    await page.selectOption('#rs_numKids', '0');
    await page.waitForFunction(function(){
      var el = document.getElementById('rs_schoolFeeRow');
      return el && el.style.display === 'none';
    }, { timeout: 3000 });
  } finally {
    await page.context().close();
  }
};
