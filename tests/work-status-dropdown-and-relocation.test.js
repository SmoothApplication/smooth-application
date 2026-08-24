'use strict';
// User feedback: "I do not want the page to be too busy... WORK STATUS should have a collapsible
// drop-down menu" listing employed / self-employed / student / applying for a child (or travelling
// with one) / employed & self-employed combined — replacing four separate checkboxes with one compact
// select. The underlying f_employed/f_selfEmployed/f_student/f_hasChild fields (and every reveal row
// tied to them) are unchanged and still driven the same way — the dropdown just sets their checked
// state programmatically instead of the user ticking them directly.
//
// Also per the same feedback: "Some of my documents are not in English", "I've gathered my supporting
// documents and I'm ready to start the formal application steps...", and "I've been refused a visa..."
// move out of "Your trip details" (session 1) into "Identity & application" (session 4), where they
// now live in their own small card ahead of the document checklist for that category.
const assert = require('assert');
const { newPageAt, passConsentGate, goToSessionByPill } = require('./helpers');

exports.run = async function(ctx){
  var page = await newPageAt(ctx.browser, '/index.html');
  try {
    await passConsentGate(page);
    await goToSessionByPill(page, 0); // trip session

    // Default: nothing selected, no reveal rows showing.
    var defaultValue = await page.$eval('#f_workStatus', function(el){ return el.value; });
    assert.strictEqual(defaultValue, '', 'Work status dropdown should start unselected');
    var employerRowHiddenInitially = await page.$eval('#employerNameRow', function(el){ return el.style.display === 'none'; });
    assert.strictEqual(employerRowHiddenInitially, true, 'Employer name row should be hidden before any status is picked');

    // Picking "employed" checks the underlying field and reveals the employer name row (but not business).
    await page.selectOption('#f_workStatus', 'employed');
    await page.waitForTimeout(150);
    var employedChecked = await page.$eval('#f_employed', function(el){ return el.checked; });
    assert.strictEqual(employedChecked, true, 'Choosing "employed" should check the underlying f_employed field');
    var employerRowVisible = await page.$eval('#employerNameRow', function(el){ return el.style.display !== 'none'; });
    assert.strictEqual(employerRowVisible, true, 'Employer name row should show once "employed" is chosen');
    var businessRowStillHidden = await page.$eval('#businessNameRow', function(el){ return el.style.display === 'none'; });
    assert.strictEqual(businessRowStillHidden, true, 'Business name row should stay hidden while only "employed" is chosen');

    // Picking "both" checks BOTH underlying fields and reveals both name rows + the "both" note.
    await page.selectOption('#f_workStatus', 'both');
    await page.waitForTimeout(150);
    var bothChecked = await page.evaluate(function(){
      return document.getElementById('f_employed').checked && document.getElementById('f_selfEmployed').checked;
    });
    assert.strictEqual(bothChecked, true, 'Choosing the combined option should check both f_employed and f_selfEmployed');
    var bothNoteVisible = await page.$eval('#workStatusBothNote', function(el){ return el.style.display !== 'none'; });
    assert.strictEqual(bothNoteVisible, true, 'The "both" note should show once the combined option is chosen');

    // Switching to "student" clears employed/selfEmployed and reveals the student sponsor block instead.
    await page.selectOption('#f_workStatus', 'student');
    await page.waitForTimeout(150);
    var afterStudent = await page.evaluate(function(){
      return {
        employed: document.getElementById('f_employed').checked,
        selfEmployed: document.getElementById('f_selfEmployed').checked,
        student: document.getElementById('f_student').checked
      };
    });
    assert.deepStrictEqual(afterStudent, { employed: false, selfEmployed: false, student: true },
      'Choosing "student" should clear employed/self-employed and check only student, got: ' + JSON.stringify(afterStudent));
    var studentBlockVisible = await page.$eval('#studentSponsorBlock', function(el){ return el.style.display !== 'none'; });
    assert.strictEqual(studentBlockVisible, true, 'Student sponsor block should show once "student" is chosen');

    // The four checkboxes themselves are no longer directly visible on the page (driven by the dropdown).
    var checkboxesHidden = await page.evaluate(function(){
      return ['f_employed','f_selfEmployed','f_student','f_hasChild'].every(function(id){
        var row = document.getElementById(id).closest('.checkrow');
        return row && row.style.display === 'none';
      });
    });
    assert.strictEqual(checkboxesHidden, true, 'The raw Work status checkboxes should be visually hidden, driven only by the dropdown');

    // The three relocated items still exist on the page (single-page app), but should now live inside
    // the new identityStatusCard rather than the trip session's own card.
    var translationLivesInIdentityCard = await page.evaluate(function(){
      var el = document.getElementById('f_translation');
      return !!(el && el.closest('#identityStatusCard'));
    });
    assert.strictEqual(translationLivesInIdentityCard, true, 'The translation checkbox should now live inside identityStatusCard, not the trip session markup');

    // ...they should instead show up in session 4 ("Identity & application"), in their own card, ahead
    // of the document checklist for that category.
    await goToSessionByPill(page, 2); // 'Identity & financial documents' (index 2).
    var identityCardVisible = await page.$eval('#identityStatusCard', function(el){ return el.offsetParent !== null; });
    assert.strictEqual(identityCardVisible, true, 'The relocated "Application readiness & visa history" card should be visible in the Identity & application session');

    var relocatedLabelsText = await page.$eval('#identityStatusCard', function(el){ return el.textContent; });
    assert.ok(/not in/i.test(relocatedLabelsText), 'Relocated card should contain the translation checkbox text');
    assert.ok(/ready to start the formal application/i.test(relocatedLabelsText), 'Relocated card should contain the "ready to submit" checkbox text');
    assert.ok(/refused a visa/i.test(relocatedLabelsText), 'Relocated card should contain the refusal checkbox text');

    // The refusal count/details reveal still works in its new location.
    await page.check('#f_hasRefusal');
    var refusalRowVisible = await page.$eval('#refusalRow', function(el){ return el.style.display !== 'none'; });
    assert.strictEqual(refusalRowVisible, true, 'Refusal detail row should still reveal itself correctly in its new location');
  } finally {
    await page.context().close();
  }
};
