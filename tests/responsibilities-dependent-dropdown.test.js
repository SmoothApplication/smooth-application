'use strict';
// Session 3 ("Your responsibilities") — married/aged-parents Y/N reveal their follow-up fields, and
// the state -> local government area dropdown is dependent (no LGA options until a state is picked,
// and picking a different state replaces the list rather than appending to it).
const assert = require('assert');
const { newPageAt, passConsentGate, goToSessionByPill } = require('./helpers');

exports.run = async function(ctx){
  var page = await newPageAt(ctx.browser, '/index.html');
  try {
    await passConsentGate(page);
    await goToSessionByPill(page, 2);
    await page.waitForSelector('#rs_state');

    // State dropdown should already be populated (built on load), LGA should not be yet.
    var stateOptionCount = await page.$eval('#rs_state', function(el){ return el.options.length; });
    assert.ok(stateOptionCount > 30, 'State dropdown should list all 36 states + FCT, got ' + (stateOptionCount - 1) + ' states');
    var lgaOptionCountBefore = await page.$eval('#rs_lga', function(el){ return el.options.length; });
    assert.strictEqual(lgaOptionCountBefore, 1, 'LGA dropdown should show only the placeholder before a state is picked');

    // Picking Lagos populates Lagos's own LGAs.
    await page.selectOption('#rs_state', 'Lagos');
    await page.waitForFunction(function(){
      var el = document.getElementById('rs_lga');
      return el && el.options.length > 1;
    }, { timeout: 3000 });
    var lagosLgas = await page.$eval('#rs_lga', function(el){ return Array.from(el.options).map(function(o){ return o.value; }); });
    assert.ok(lagosLgas.indexOf('Ikeja') !== -1, 'Lagos LGA list should include Ikeja, got: ' + lagosLgas.join(', '));
    assert.ok(lagosLgas.indexOf('Ikorodu') !== -1, 'Lagos LGA list should include Ikorodu, got: ' + lagosLgas.join(', '));

    // Switching to Kano replaces the list with Kano's own LGAs (not Lagos's).
    await page.selectOption('#rs_state', 'Kano');
    await page.waitForFunction(function(){
      var el = document.getElementById('rs_lga');
      var opts = Array.from(el.options).map(function(o){ return o.value; });
      return opts.indexOf('Dala') !== -1;
    }, { timeout: 3000 });
    var kanoLgas = await page.$eval('#rs_lga', function(el){ return Array.from(el.options).map(function(o){ return o.value; }); });
    assert.strictEqual(kanoLgas.indexOf('Ikeja'), -1, 'Switching states should replace the LGA list, not append to it — Lagos\'s Ikeja should be gone');

    // The state change above triggers its own render() pass; give it a beat to settle before the
    // next interaction (same reasoning as goToSessionByPill's blur+wait — clicking mid-render can
    // occasionally race a layout shift and miss the target, seen intermittently here otherwise).
    await page.waitForTimeout(100);

    // Married Y/N reveal.
    var spouseRowBefore = await page.$eval('#rs_spouseRow', function(el){ return el.style.display !== 'none'; });
    assert.strictEqual(spouseRowBefore, false, 'Spouse name field should be hidden before "married" is ticked');
    await page.check('#rs_married', { force: true });
    var spouseRowAfter = await page.$eval('#rs_spouseRow', function(el){ return el.style.display !== 'none'; });
    assert.strictEqual(spouseRowAfter, true, 'Spouse name field should show once "married" is ticked');
    await page.fill('#rs_spouseName', 'Chidinma Okafor');

    // Aged-parents Y/N reveal.
    var parentsRowBefore = await page.$eval('#rs_parentsRow', function(el){ return el.style.display !== 'none'; });
    assert.strictEqual(parentsRowBefore, false, 'Parents fields should be hidden before "aged parents" is ticked');
    await page.check('#rs_agedParents', { force: true });
    var parentsRowAfter = await page.$eval('#rs_parentsRow', function(el){ return el.style.display !== 'none'; });
    assert.strictEqual(parentsRowAfter, true, 'Parents fields should show once "aged parents" is ticked');
    await page.fill('#rs_fatherName', 'Emeka Okafor');
    await page.fill('#rs_motherName', 'Ngozi Okafor');
    await page.fill('#rs_remittance', '50000');
    await page.check('#rs_verifyConsent', { force: true });

    // Kids dropdown includes a 0/None option in addition to 1-10.
    var kidsOptions = await page.$eval('#rs_numKids', function(el){ return Array.from(el.options).map(function(o){ return o.value; }); });
    assert.deepStrictEqual(kidsOptions, ['', '0','1','2','3','4','5','6','7','8','9','10'], 'Kids dropdown should offer 0/None plus 1-10, got: ' + kidsOptions.join(','));
  } finally {
    await page.context().close();
  }
};
