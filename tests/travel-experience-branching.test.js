'use strict';
// Session 2 ("Travel Experience"). The applicant's original spec phrased this as a "1st time
// traveler: YES/NO" checkbox with the recommendation/history boxes mapped to the literal
// YES/NO wording — which, read literally, has the two branches backward (a first-time traveler
// is the one with NO history, and needs the recommendation box; someone who's travelled before
// is the one who needs the history table). This implementation asks the un-inverted, plain
// question "Have you travelled outside Nigeria before?" instead, so "Yes" -> history table,
// "No" -> recommendation box.
const assert = require('assert');
const { newPageAt, passConsentGate, goToSessionByLabel } = require('./helpers');

exports.run = async function(ctx){
  var page = await newPageAt(ctx.browser, '/index.html');
  try {
    await passConsentGate(page);
    await goToSessionByLabel(page, 'Travel Experience');
    await page.waitForSelector('#te_firstTime');

    // Unanswered -> neither box shows.
    var noHistoryVisible0 = await page.$eval('#te_noHistoryBox', function(el){ return el.style.display !== 'none'; });
    var historyVisible0 = await page.$eval('#te_historyBox', function(el){ return el.style.display !== 'none'; });
    assert.strictEqual(noHistoryVisible0, false, 'Recommendation box should be hidden before the question is answered');
    assert.strictEqual(historyVisible0, false, 'History table should be hidden before the question is answered');

    // "No" (first-time traveller, no history) -> recommendation box, with named countries.
    await page.selectOption('#te_firstTime', 'no');
    await page.waitForFunction(function(){
      var el = document.getElementById('te_noHistoryBox');
      return el && el.style.display !== 'none';
    }, { timeout: 3000 });
    var recoText = await page.$eval('#te_noHistoryBox', function(el){ return el.textContent; });
    ['Ghana','Kenya','Ethiopia','Morocco','Egypt'].forEach(function(c){
      assert.ok(recoText.indexOf(c) !== -1, 'Recommendation box should mention ' + c + ', got: ' + recoText);
    });
    var assistanceMsgBefore = await page.$eval('#travelAssistanceMsg', function(el){ return el.style.display; });
    assert.strictEqual(assistanceMsgBefore, 'none', '"Click here for more assistance" detail should start collapsed');
    await page.click('#btnTravelAssistance');
    var assistanceMsgAfter = await page.$eval('#travelAssistanceMsg', function(el){ return el.style.display; });
    assert.notStrictEqual(assistanceMsgAfter, 'none', 'Clicking the assistance button should reveal the extra guidance');

    // "Yes" (has travelled before) -> history table + overstay question, not the recommendation box.
    await page.selectOption('#te_firstTime', 'yes');
    await page.waitForFunction(function(){
      var el = document.getElementById('te_historyBox');
      return el && el.style.display !== 'none';
    }, { timeout: 3000 });
    var noHistoryVisible1 = await page.$eval('#te_noHistoryBox', function(el){ return el.style.display !== 'none'; });
    assert.strictEqual(noHistoryVisible1, false, 'Recommendation box should hide once "Yes" is picked');

    // Add a country row and fill it in.
    await page.click('#btnAddTravelRow');
    await page.waitForSelector('#travelHistoryBody select[data-idx="0"][data-field="country"]');
    await page.selectOption('#travelHistoryBody select[data-idx="0"][data-field="country"]', 'Ghana');
    await page.fill('#travelHistoryBody input[data-idx="0"][data-field="days"]', '10');

    // Country grading + the closing "section complete" message should appear once at least one
    // country is filled. (Copy softened to informational-only framing — see
    // docs/terms-of-service-draft.md's resolved lawyer note — so this checks for the current
    // "Continue to Session 3" wording rather than the old "qualified for the next level" phrasing.)
    await page.waitForFunction(function(){
      var el = document.getElementById('travelExperienceGrade');
      return el && /Continue to/.test(el.textContent);
    }, { timeout: 3000 });
    var gradeText = await page.$eval('#travelExperienceGrade', function(el){ return el.textContent; });
    assert.ok(/completed this section/.test(gradeText), 'Should show the "completed this section" copy, got: ' + gradeText);
    assert.ok(/African country/.test(gradeText), 'Should mention the 1-African-country grading tier, got: ' + gradeText);

    // Overstay Y/N -> its own table only shows once "Yes" is ticked.
    var overstayVisibleBefore = await page.$eval('#te_overstayBox', function(el){ return el.style.display !== 'none'; });
    assert.strictEqual(overstayVisibleBefore, false, 'Overstay table should be hidden until the overstay question is ticked');
    await page.check('#te_hasOverstayed', { force: true });
    var overstayVisibleAfter = await page.$eval('#te_overstayBox', function(el){ return el.style.display !== 'none'; });
    assert.strictEqual(overstayVisibleAfter, true, 'Overstay table should show once ticked');
    await page.click('#btnAddOverstayRow');
    await page.waitForSelector('#overstayBody select[data-idx="0"][data-field="country"]');
  } finally {
    await page.context().close();
  }
};
