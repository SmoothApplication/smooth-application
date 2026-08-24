'use strict';
// User feedback: "I do not want the page to be too busy, i want it user friendly. After clicking
// 'How many people are travelling on this application?' the following Adults (18+)/Adolescents
// (12-17)/Children (2-11) once filled should be collapsible." Same collapse-after-use pattern already
// used by the transport/sightseeing/currency helpers on this page: a "✓ Done" button tucks the three
// number fields away behind a one-line summary + "edit breakdown" link.
const assert = require('assert');
const { newPageAt, passConsentGate, goToSessionByPill } = require('./helpers');

exports.run = async function(ctx){
  var page = await newPageAt(ctx.browser, '/index.html');
  try {
    await passConsentGate(page);
    await goToSessionByPill(page, 0); // trip session

    // Picking more than 1 traveller reveals the breakdown fields, expanded (not pre-collapsed).
    await page.selectOption('#f_travelerCount', '3');
    var fieldsVisible = await page.$eval('#travelerBreakdownFields', function(el){ return el.style.display !== 'none'; });
    assert.strictEqual(fieldsVisible, true, 'Breakdown fields should be visible/expanded right after picking a traveller count');
    var noteHiddenInitially = await page.$eval('#travelerBreakdownCollapsedNote', function(el){ return el.style.display === 'none'; });
    assert.strictEqual(noteHiddenInitially, true, 'Collapsed summary note should not show before the fields have been collapsed');

    // Adjust the split, then collapse.
    await page.fill('#f_adults', '2');
    await page.fill('#f_adolescents', '1');
    await page.fill('#f_children', '0');
    await page.click('#btnCollapseTravelerBreakdown');

    await page.waitForFunction(function(){
      var fields = document.getElementById('travelerBreakdownFields');
      var note = document.getElementById('travelerBreakdownCollapsedNote');
      return fields && fields.style.display === 'none' && note && note.style.display !== 'none';
    }, { timeout: 3000 });

    var noteText = await page.$eval('#travelerBreakdownCollapsedNote', function(el){ return el.textContent; });
    assert.ok(/2 adults/.test(noteText) && /1 adolescent/.test(noteText) && /edit breakdown/i.test(noteText),
      'Collapsed note should summarize the split and offer to edit it, got: "' + noteText + '"');

    // The actual data fields are untouched by collapsing — still feed the rest of the app.
    var adultsVal = await page.$eval('#f_adults', function(el){ return el.value; });
    assert.strictEqual(adultsVal, '2', 'Collapsing should not clear the underlying adults field');

    // "edit breakdown" reopens the fields and hides the note again.
    await page.click('#reopenTravelerBreakdown');
    await page.waitForFunction(function(){
      var fields = document.getElementById('travelerBreakdownFields');
      var note = document.getElementById('travelerBreakdownCollapsedNote');
      return fields && fields.style.display !== 'none' && note && note.style.display === 'none';
    }, { timeout: 3000 });

    // Picking a new traveller count re-expands the fields rather than leaving a stale collapsed note.
    await page.click('#btnCollapseTravelerBreakdown');
    await page.waitForTimeout(200);
    await page.selectOption('#f_travelerCount', '4');
    var fieldsVisibleAfterRecount = await page.$eval('#travelerBreakdownFields', function(el){ return el.style.display !== 'none'; });
    assert.strictEqual(fieldsVisibleAfterRecount, true, 'Changing the traveller count should re-expand the breakdown fields');
  } finally {
    await page.context().close();
  }
};
