'use strict';
// User request (product owner, verbatim): "once an applicant clicks and have been refused before,
// create a picture page and ask the applicant to upload the letter of refusal... scan it and pick
// keywords. Once you pick keywords like financial inconsistency related to finances, send such
// refused applicants straight to income and bank statement analysis... you pick the date of the
// refusal. Once the date of the refusal is above six months, the applicant will start back from
// scanning passport to confirm. Both if the applicant just got refused within a month, take the
// applicant straight to income and bank statement analysis."
//
// Clarified with the product owner before building (see CHANGELOG): a 1-6 month-old refusal is
// treated the same as "within a month" (still -> finance2); a non-financial refusal goes by date
// alone; a financial-keyword match routes to finance2 regardless of age, since that's the thing to
// revisit either way; and every suggestion is phrased as a suggestion, never a diagnosis, sitting
// next to a "See my full checklist instead" escape hatch.
//
// REDESIGNED after shipping the first version (see CHANGELOG): a closer look at the actual OISC rule
// showed the risk isn't about how carefully the wording is hedged - it's about whether the advice is
// tailored to one person's specific case. Reading someone's own letter and picking their next step
// FROM ITS CONTENT is tailored to their case no matter how softly it's phrased. So OCR's job shrank to
// exactly one thing: extract the letter's text and show it back to the applicant, like a friend with
// good English reading it aloud. It never classifies what the letter means. The applicant reads it
// themselves and answers two plain questions (a pre-fillable date, and a financial yes/no THEY pick,
// never auto-set) - their own answer, not the app's reading of the letter, drives the suggestion. See
// the block comment above #situationRefusedUpload in index.html for the full reasoning.
//
// Scope note: this covers the keyword/date-parsing logic and the manual-entry -> routing -> session
// jump wiring end to end, plus the redesign's core guarantee (OCR extracts and pre-fills a date, but
// never auto-picks the financial answer or shows a suggestion on its own). It deliberately does NOT
// drive a real file through the OCR scan button itself — that button calls straight into the same
// getLinesFromPdf/smartRecognize pipeline already covered by existing passport-scan and bank-statement
// tests, so re-proving OCR itself here would be redundant; what's actually new here is covered directly
// via the __test hooks (which exercise the exact same code the OCR success handler calls) and the
// manual-entry path, which is now the ONLY path that ever calls applySituationRefusedRouting().
const assert = require('assert');
const { newPageAt } = require('./helpers');

function toDateInputValue(y, m, d){
  return y + '-' + String(m).padStart(2, '0') + '-' + String(d).padStart(2, '0');
}
// Returns {y,m,d} for a date `n` months before today, computed on the test runner's own clock (same
// machine the browser runs on) so this never goes stale the way a hardcoded date eventually would.
function monthsAgoYMD(n){
  var d = new Date();
  d.setMonth(d.getMonth() - n);
  return { y: d.getFullYear(), m: d.getMonth() + 1, d: d.getDate() };
}

async function reachSituationGate(page, country){
  await page.waitForSelector('#quizIntro');
  await page.evaluate(function(){ window.__testSkipQuiz(); });
  await page.waitForSelector('#docsGateContinue');
  await page.click('#docsGateContinue');
  await page.waitForSelector('.gate-country-option[data-code="' + country + '"]');
  await page.click('.gate-country-option[data-code="' + country + '"]');
  await page.check('#gateAgree', { force: true });
  await page.click('#gateContinue');
  await page.waitForSelector('#situationOptFresh', { state: 'visible' });
}

exports.run = async function(ctx){
  // ---- Pure-logic checks via the __test hooks: keyword detection, date parsing, routing decision ----
  var page = await newPageAt(ctx.browser, '/index.html');
  try {
    await page.waitForFunction(function(){ return typeof window.__testRefusalTextLooksFinancial === 'function'; }, { timeout: 10000 });

    var kw = await page.evaluate(function(){
      return {
        financial: window.__testRefusalTextLooksFinancial('We are not satisfied that you have sufficient funds to cover the costs of your trip, and your bank statement does not demonstrate this.'),
        nonFinancial: window.__testRefusalTextLooksFinancial('We are not satisfied that you are a genuine visitor and intend to leave the UK at the end of your visit as stated.')
      };
    });
    assert.strictEqual(kw.financial, true, 'Letter text with financial boilerplate should be detected as financial');
    assert.strictEqual(kw.nonFinancial, false, 'Letter text about genuineness of visit (no financial wording) should NOT be detected as financial');

    var dates = await page.evaluate(function(){
      function iso(dt){ return dt ? (dt.getFullYear() + '-' + String(dt.getMonth()+1).padStart(2,'0') + '-' + String(dt.getDate()).padStart(2,'0')) : null; }
      return {
        wordyLong: iso(window.__testParseRefusalDateFromText('UK Visas and Immigration\nReference: GWF012345\nDate: 14 September 2025\n\nDear Applicant,')),
        wordyShort: iso(window.__testParseRefusalDateFromText('Decision date: 3 Jan 2026\nWe regret to inform you...')),
        usStyle: iso(window.__testParseRefusalDateFromText('September 14, 2025\nDear Applicant,')),
        numeric: iso(window.__testParseRefusalDateFromText('14/09/2025\nDear Applicant,')),
        none: window.__testParseRefusalDateFromText('No date anywhere in this text at all, just plain words.')
      };
    });
    assert.strictEqual(dates.wordyLong, '2025-09-14', 'Should parse "14 September 2025", got: ' + dates.wordyLong);
    assert.strictEqual(dates.wordyShort, '2026-01-03', 'Should parse "3 Jan 2026", got: ' + dates.wordyShort);
    assert.strictEqual(dates.usStyle, '2025-09-14', 'Should parse "September 14, 2025", got: ' + dates.usStyle);
    assert.strictEqual(dates.numeric, '2025-09-14', 'Should parse "14/09/2025" as DD/MM/YYYY, got: ' + dates.numeric);
    assert.strictEqual(dates.none, null, 'Should return null when no date is found, got: ' + dates.none);

    var recent = monthsAgoYMD(2);
    var midRange = monthsAgoYMD(5); // the clarified 1-6 month bucket
    var old = monthsAgoYMD(9);
    var routing = await page.evaluate(function(args){
      var recent = args.recent, midRange = args.midRange, old = args.old;
      function d(ymd){ return new Date(ymd.y, ymd.m - 1, ymd.d); }
      return {
        financialOld: window.__testComputeRefusalRouting(d(old), true).target,
        financialRecent: window.__testComputeRefusalRouting(d(recent), true).target,
        nonFinancialRecent: window.__testComputeRefusalRouting(d(recent), false).target,
        nonFinancialMidRange: window.__testComputeRefusalRouting(d(midRange), false).target,
        nonFinancialOld: window.__testComputeRefusalRouting(d(old), false).target
      };
    }, { recent: recent, midRange: midRange, old: old });
    assert.strictEqual(routing.financialOld, 'finance2', 'A financial-keyword refusal should route to finance2 even if it was long ago, got: ' + routing.financialOld);
    assert.strictEqual(routing.financialRecent, 'finance2', 'A recent financial-keyword refusal should route to finance2, got: ' + routing.financialRecent);
    assert.strictEqual(routing.nonFinancialRecent, 'finance2', 'A recent (within 1 month) non-financial refusal should route to finance2, got: ' + routing.nonFinancialRecent);
    assert.strictEqual(routing.nonFinancialMidRange, 'finance2', 'A 1-6 month-old non-financial refusal should route to finance2 (clarified bucket), got: ' + routing.nonFinancialMidRange);
    assert.strictEqual(routing.nonFinancialOld, 'restart', 'An over-6-month-old non-financial refusal should restart from passport, got: ' + routing.nonFinancialOld);
  } finally {
    await page.context().close();
  }

  // ---- UI integration: manual-entry path -> suggestion -> "Take me there" -> correct session ----
  var page2 = await newPageAt(ctx.browser, '/index.html');
  try {
    await reachSituationGate(page2, 'UK');
    await page2.click('#situationOptRefused');
    await page2.click('#situationRefusedManualToggle');
    await page2.waitForSelector('#situationRefusedManual', { state: 'visible' });

    var recentYmd = monthsAgoYMD(2);
    await page2.fill('#situationRefusedManualDate', toDateInputValue(recentYmd.y, recentYmd.m, recentYmd.d));
    await page2.selectOption('#situationRefusedManualFinancial', 'no');
    await page2.click('#btnSituationRefusedManualApply');

    await page2.waitForSelector('#situationRefusedSuggestion', { state: 'visible' });
    var suggestionText = await page2.$eval('#situationRefusedSuggestionText', function(el){ return el.textContent; });
    assert.ok(/Income & bank statement analysis/.test(suggestionText), 'Suggestion should name Income & bank statement analysis for a recent non-financial refusal, got: ' + suggestionText);
    assert.ok(!/diagnos/i.test(suggestionText), 'Suggestion wording should never claim to diagnose, got: ' + suggestionText);

    await page2.click('#btnSituationRefusedSuggestionGo');
    await page2.waitForFunction(function(){
      var el = document.getElementById('appWrap');
      return el && el.style.display !== 'none';
    }, { timeout: 5000 });
    var activeTitle = await page2.$eval('.session-pill.active', function(el){ return el.getAttribute('title') || ''; });
    assert.ok(activeTitle.indexOf('Income & bank statement analysis') === 0, '"Take me there" should land on the Income & bank statement analysis session, got active pill title: ' + activeTitle);
  } finally {
    await page2.context().close();
  }

  // ---- UI integration: an old, non-financial refusal suggests restarting from passport ----
  var page3 = await newPageAt(ctx.browser, '/index.html');
  try {
    await reachSituationGate(page3, 'UK');
    await page3.click('#situationOptRefused');
    await page3.click('#situationRefusedManualToggle');
    await page3.waitForSelector('#situationRefusedManual', { state: 'visible' });

    var oldYmd = monthsAgoYMD(9);
    await page3.fill('#situationRefusedManualDate', toDateInputValue(oldYmd.y, oldYmd.m, oldYmd.d));
    await page3.selectOption('#situationRefusedManualFinancial', 'no');
    await page3.click('#btnSituationRefusedManualApply');

    await page3.waitForSelector('#situationRefusedSuggestion', { state: 'visible' });
    var oldSuggestionText = await page3.$eval('#situationRefusedSuggestionText', function(el){ return el.textContent; });
    assert.ok(/passport/i.test(oldSuggestionText), 'Suggestion should mention restarting from the passport scan for an old non-financial refusal, got: ' + oldSuggestionText);

    await page3.click('#btnSituationRefusedSuggestionGo');
    await page3.waitForFunction(function(){
      var el = document.getElementById('appWrap');
      return el && el.style.display !== 'none';
    }, { timeout: 5000 });
    var activeTitle3 = await page3.$eval('.session-pill.active', function(el){ return el.getAttribute('title') || ''; });
    assert.ok(activeTitle3.indexOf('Validate your International Passport') === 0, '"Take me there" should land on the passport session for an old non-financial refusal, got active pill title: ' + activeTitle3);
  } finally {
    await page3.context().close();
  }

  // ---- "See my full checklist instead" always works too - never a dead end ----
  var page4 = await newPageAt(ctx.browser, '/index.html');
  try {
    await reachSituationGate(page4, 'UK');
    await page4.click('#situationOptRefused');
    await page4.click('#situationRefusedManualToggle');
    await page4.waitForSelector('#situationRefusedManual', { state: 'visible' });

    var anyYmd = monthsAgoYMD(1);
    await page4.fill('#situationRefusedManualDate', toDateInputValue(anyYmd.y, anyYmd.m, anyYmd.d));
    await page4.click('#btnSituationRefusedManualApply');
    await page4.waitForSelector('#situationRefusedSuggestion', { state: 'visible' });

    await page4.click('#btnSituationRefusedSuggestionSkip');
    await page4.waitForFunction(function(){
      var el = document.getElementById('appWrap');
      return el && el.style.display !== 'none';
    }, { timeout: 5000 });
    var gateHidden = await page4.$eval('#situationGate', function(el){ return el.style.display === 'none'; });
    assert.strictEqual(gateHidden, true, 'Situation gate should be hidden after "See my full checklist instead"');
  } finally {
    await page4.context().close();
  }

  // ---- Redesign guarantee: "OCR" (simulated via the test hook, same code path the real scan button
  // calls) shows the letter's text and pre-fills the date, but NEVER auto-picks the financial answer or
  // shows a suggestion on its own - only the applicant's own "Use this" click can do that. ----
  var page5 = await newPageAt(ctx.browser, '/index.html');
  try {
    await reachSituationGate(page5, 'UK');
    await page5.click('#situationOptRefused');
    await page5.waitForFunction(function(){ return typeof window.__testApplyOcrExtractedText === 'function'; }, { timeout: 10000 });

    var letterText = 'UK Visas and Immigration\nDate: 14 September 2025\n\nDear Applicant,\nWe are not satisfied that you have sufficient funds to cover your trip, and your bank statement does not demonstrate this.';
    await page5.evaluate(function(text){ window.__testApplyOcrExtractedText(text); }, letterText);

    // The letter's own text should be shown back to the applicant, verbatim.
    var shownText = await page5.$eval('#situationRefusedLetterText', function(el){ return el.textContent; });
    assert.ok(shownText.indexOf('sufficient funds') !== -1, 'The extracted letter text should be shown back to the applicant, got: ' + shownText);

    // The date is a plain fact, so it's fine to pre-fill it automatically.
    var prefilledDate = await page5.$eval('#situationRefusedManualDate', function(el){ return el.value; });
    assert.strictEqual(prefilledDate, '2025-09-14', 'A confidently-parsed date should pre-fill the manual date field, got: ' + prefilledDate);

    // The financial question must NEVER be auto-set from the letter's content, even though this exact
    // letter text contains financial keywords ("sufficient funds") that the OLD design would have used
    // to auto-classify it - this is the actual point of the redesign.
    var financialValue = await page5.$eval('#situationRefusedManualFinancial', function(el){ return el.value; });
    assert.strictEqual(financialValue, '', 'The financial dropdown must stay unset ("Not sure") after OCR - the applicant must answer it themselves, got: ' + financialValue);

    // No suggestion should appear until the applicant clicks "Use this" themselves.
    var suggestionVisibleBeforeApply = await page5.$eval('#situationRefusedSuggestion', function(el){ return getComputedStyle(el).display !== 'none'; });
    assert.strictEqual(suggestionVisibleBeforeApply, false, 'No suggestion should appear from OCR alone, before the applicant answers and clicks "Use this"');

    // Now the applicant reads the shown text themselves and answers "yes" - only THIS should produce a
    // suggestion.
    await page5.selectOption('#situationRefusedManualFinancial', 'yes');
    await page5.click('#btnSituationRefusedManualApply');
    await page5.waitForSelector('#situationRefusedSuggestion', { state: 'visible' });
    var suggestionTextAfter = await page5.$eval('#situationRefusedSuggestionText', function(el){ return el.textContent; });
    assert.ok(/Income & bank statement analysis/.test(suggestionTextAfter), 'Suggestion should only appear after the applicant\'s own answer, got: ' + suggestionTextAfter);
  } finally {
    await page5.context().close();
  }
};
