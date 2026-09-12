'use strict';
// User request: "create a drop down for marital status and let it have a drop down menu of the
// following: Single, Married, Divorced. Not all applicants are married. Once applicants click Single,
// clear children and do not add the cost of school fees."
//
// Replaces the old "I'm married" checkbox with a real Single/Married/Divorced choice (getAnswers()
// still exposes a `married` boolean, derived as maritalStatus === 'married', so every other married-only
// toggle — spouse name row, maiden name row, spouse-sponsor section/checklist item — needed no changes).
// Picking "Single" specifically clears the children count, which in turn hides the school-fee row and
// zeroes it out of the yearly cost estimate (schoolPerTerm * 3 * numKids, see
// updateYearlyResponsibilitiesSummary), rather than leaving a stale child count sitting there.
const assert = require('assert');
const { newPageAt, passConsentGate, goToSessionByLabel } = require('./helpers');

exports.run = async function(ctx){
  var page = await newPageAt(ctx.browser, '/index.html');
  try {
    await passConsentGate(page);
    await goToSessionByLabel(page, 'Your responsibilities');

    // The dropdown offers exactly Select…/Single/Married/Divorced.
    var options = await page.$eval('#rs_maritalStatus', function(el){
      return Array.from(el.options).map(function(o){ return {value: o.value, label: o.textContent}; });
    });
    assert.deepStrictEqual(options.map(function(o){ return o.value; }), ['', 'single', 'married', 'divorced'],
      'Marital status dropdown should offer exactly Select…/Single/Married/Divorced, got: ' + JSON.stringify(options));
    assert.ok(options.some(function(o){ return o.value === 'single' && /Single/.test(o.label); }));
    assert.ok(options.some(function(o){ return o.value === 'married' && /Married/.test(o.label); }));
    assert.ok(options.some(function(o){ return o.value === 'divorced' && /Divorced/.test(o.label); }));

    // Married reveals the spouse name row; Single and Divorced must not.
    await page.selectOption('#rs_maritalStatus', 'married');
    var spouseRowMarried = await page.$eval('#rs_spouseRow', function(el){ return el.style.display !== 'none'; });
    assert.strictEqual(spouseRowMarried, true, 'Spouse name field should show for Married, got hidden');

    await page.selectOption('#rs_maritalStatus', 'divorced');
    var spouseRowDivorced = await page.$eval('#rs_spouseRow', function(el){ return el.style.display !== 'none'; });
    assert.strictEqual(spouseRowDivorced, false, 'Spouse name field should be hidden for Divorced, got shown');

    // Set a child count + school fee (+ enough else to make the yearly summary actually render) while
    // still Divorced, so the "clear on Single" behavior below is exercised against real values, not just
    // an already-blank field.
    await page.fill('#rs_monthlyUpkeep', '50000');
    await page.selectOption('#rs_numKids', '3');
    await page.fill('#rs_schoolFeePerTerm', '250000');
    await page.waitForFunction(function(){
      var row = document.getElementById('rs_schoolFeeRow');
      return row && row.style.display !== 'none';
    }, { timeout: 3000 });
    var summaryTextBefore = await page.$eval('#rs_yearlySummary', function(el){ return el.textContent; });
    assert.ok(/School fees/.test(summaryTextBefore), 'Sanity check: yearly summary should mention school fees while 3 kids + a fee are set, got: ' + summaryTextBefore);

    // Switching to Single clears the children count, which hides the school-fee row (schoolPerTerm is
    // multiplied by numKids in the yearly total, so this also zeroes its contribution, not just its
    // visibility).
    await page.selectOption('#rs_maritalStatus', 'single');
    await page.waitForFunction(function(){
      var el = document.getElementById('rs_numKids');
      return el && el.value === '';
    }, { timeout: 3000 });
    var schoolRowHiddenAfterSingle = await page.$eval('#rs_schoolFeeRow', function(el){ return el.style.display === 'none'; });
    assert.strictEqual(schoolRowHiddenAfterSingle, true, 'School fee row should hide once Single clears the children count, got shown');
    var spouseRowSingle = await page.$eval('#rs_spouseRow', function(el){ return el.style.display !== 'none'; });
    assert.strictEqual(spouseRowSingle, false, 'Spouse name field should be hidden for Single, got shown');

    // The yearly summary must not still be counting school fees for Single.
    var summaryText = await page.$eval('#rs_yearlySummary', function(el){ return el.textContent; });
    assert.ok(!/School fees/.test(summaryText), 'Yearly summary should not mention school fees once Single cleared the children count, got: ' + summaryText);
  } finally {
    await page.context().close();
  }
};
