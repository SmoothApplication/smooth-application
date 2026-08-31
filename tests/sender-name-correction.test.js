'use strict';
// Direct report, off real screenshots: a bank narration got misread and glued trailing junk onto an
// otherwise-real name ("Ibukunoluwa Adedayo Afeni Fg Ij K X" — "Fg Ij K X" being reference-code
// fragments, not part of anyone's name). Too varied a failure mode to reliably auto-clean without
// also breaking genuine short connectors inside real names elsewhere (see extractNameCandidates'
// "N"/"&" handling) — the user's own suggested fix was simpler and safer: let the applicant confirm
// or correct it themselves. This tests that "Fix name" affordance end-to-end: it's a pure DISPLAY
// override (kept keyed by the original extracted name, same pattern as sourceExplanations) — nothing
// about which payments belong to the group changes, only the label shown for it, everywhere that
// label appears (the box header, its collapsed summary, and the spreadsheet download).
const assert = require('assert');
const path = require('path');
const { newPageAt, passConsentGate, goToSessionByPill, goToFinanceStep } = require('./helpers');

// Two payments from "Chidinma Okeke", deliberately followed by "FG IJ" in the narration — real
// reference-code noise that extractNameCandidates' short-connector handling glues onto the name
// (matching the reported "Fg Ij K X" pattern), landing as "Chidinma Okeke Fg Ij". Different amounts
// so they're never swept into the recurring-"Salary" bucket — this must be its own named group.
var FIXTURE = path.join(__dirname, 'fixtures', 'garbled-sender-name-fixture.pdf');

exports.run = async function(ctx){
  var page = await newPageAt(ctx.browser, '/index.html');
  try {
    await passConsentGate(page);
    await goToSessionByPill(page, 4); // finance2
    await goToFinanceStep(page, 1);
    await page.setInputFiles('#stmtFile1', FIXTURE);
    await page.click('#btnAnalyzeStatements');
    await page.waitForFunction(function(){
      var el = document.getElementById('stmtAnalyzeMsg');
      return el && /Detected \d+ transaction/.test(el.textContent);
    }, { timeout: 20000 });
    await page.waitForTimeout(300);

    await goToFinanceStep(page, 4);
    await page.waitForSelector('#srcbox_0');

    var nameBefore = await page.$eval('#srcbox_0 .tx-line b', function(el){ return el.textContent; });
    assert.strictEqual(nameBefore, 'Chidinma Okeke Fg Ij', 'Sanity check on the garbled extraction itself, got: "' + nameBefore + '"');

    // "Fix name" starts hidden, toggles the edit box, and pre-fills the input with the current
    // (garbled) name — not blank, so the applicant is editing/correcting, not starting from scratch.
    var editBoxHiddenInitially = await page.$eval('#srcnameeditbox_0', function(el){ return el.style.display === 'none'; });
    assert.strictEqual(editBoxHiddenInitially, true, 'Edit box should start hidden');
    await page.click('#srcnameedit_0');
    await page.waitForSelector('#srcnameeditbox_0:not([style*="display: none"])');
    var prefilled = await page.$eval('#srcnameinput_0', function(el){ return el.value; });
    assert.strictEqual(prefilled, 'Chidinma Okeke Fg Ij', 'Edit input should be pre-filled with the current name, got: "' + prefilled + '"');

    // Cancel should close the box WITHOUT saving anything, even after typing a change.
    await page.fill('#srcnameinput_0', 'Something I changed my mind about');
    await page.click('#srcnamecancel_0');
    var hiddenAfterCancel = await page.$eval('#srcnameeditbox_0', function(el){ return el.style.display === 'none'; });
    assert.strictEqual(hiddenAfterCancel, true, 'Cancel should close the edit box');
    var nameUnchangedAfterCancel = await page.$eval('#srcbox_0 .tx-line b', function(el){ return el.textContent; });
    assert.strictEqual(nameUnchangedAfterCancel, 'Chidinma Okeke Fg Ij', 'Cancel should not have saved the typed change');

    // Now actually correct it and save — the box re-renders with the corrected name, and (since this
    // is a full outerHTML replace) a fresh, still-hidden edit box for next time.
    await page.click('#srcnameedit_0');
    await page.waitForSelector('#srcnameeditbox_0:not([style*="display: none"])');
    await page.fill('#srcnameinput_0', 'Chidinma Okeke');
    await page.click('#srcnamesave_0');
    await page.waitForFunction(function(){
      var b = document.querySelector('#srcbox_0 .tx-line b');
      return b && b.textContent === 'Chidinma Okeke';
    }, { timeout: 3000 });

    // Picking a reason should now collapse the box to a summary that ALSO shows the corrected name,
    // not the original garbled extraction — the correction is a genuine display override everywhere
    // this group's name is shown, not just the one headline it was typed into.
    await page.selectOption('#srccat_0', 'gift');
    await page.waitForFunction(function(){
      var box = document.getElementById('srcbox_0');
      return box && box.classList.contains('collapsed');
    }, { timeout: 3000 });
    var collapsedSummary = await page.$eval('#srcbox_0 .explain-collapsed-row .tx-line', function(el){ return el.textContent; });
    assert.ok(/Chidinma Okeke(?!.*Fg Ij)/.test(collapsedSummary), 'Collapsed summary should show the corrected name, not the garbled one, got: "' + collapsedSummary + '"');

    // Re-opening (Edit) should still offer "Fix name" pre-filled with the CORRECTED name now, not
    // silently reverting to the original garbled extraction.
    await page.click('#srccollapsed_0');
    await page.waitForSelector('#srcnameedit_0');
    var nameAfterReopen = await page.$eval('#srcbox_0 .tx-line b', function(el){ return el.textContent; });
    assert.strictEqual(nameAfterReopen, 'Chidinma Okeke', 'Re-opened box should still show the corrected name');
  } finally {
    await page.context().close();
  }
};
