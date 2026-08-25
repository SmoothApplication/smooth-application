'use strict';
// Real-data finding, off a real 31-page Zenith statement: an employer's full name never appears spelled
// out in the narration text at all — the statement abbreviates it instead (e.g. "Grace CYC" for "Grace
// Covenant Youth Church"). Since only a single word from the applicant's typed name ever literally
// appears, the 2-distinctive-word safety threshold (added to fix the "Homes Deals Ventures" false
// positive) correctly declined to count that as a match — but that left a genuine abbreviation with no
// way to be recognised at all. This adds an optional "also known as" field per employer/business, folded
// into the SAME word-matching pass as the full name, so a statement's own shorthand can be recognised
// without loosening the safety threshold itself.
const assert = require('assert');
const path = require('path');
const { newPageAt, passConsentGate, goToSessionByPill } = require('./helpers');

var FIXTURE = path.join(__dirname, 'fixtures', 'employer-alt-name-fixture.pdf');

exports.run = async function(ctx){
  // Without the "also known as" field filled in, the narration only contains the single word "GRACE" —
  // below the 2-word safety threshold — so this should NOT be counted as a direct inflow match (it
  // should still be recognised as "referenced" via the coarser whole-document text check, though).
  var page1 = await newPageAt(ctx.browser, '/index.html');
  try {
    await passConsentGate(page1);
    await goToSessionByPill(page1, 3);
    await page1.fill('#f_name', 'Test Applicant');
    await page1.selectOption('#f_workStatus', 'employed');
    await page1.fill('#f_employerName', 'Grace Covenant Youth Church');
    await goToSessionByPill(page1, 4);
    await page1.setInputFiles('#stmtFile1', FIXTURE);
    await page1.click('#btnAnalyzeStatements');
    await page1.waitForFunction(function(){
      var el = document.getElementById('stmtAnalyzeMsg');
      return el && /Detected \d+ transaction/.test(el.textContent);
    }, { timeout: 20000 });
    await page1.waitForTimeout(300);
    var html1 = await page1.$eval('#stmtAnalyzeMsg', function(el){ return el.innerHTML; });
    assert.ok(/referenced in this bank statement/.test(html1) && !/as the sender on 1 inflow/.test(html1),
      'Without an alt name, "GRACE" alone (1 word) should not count as a direct inflow match, got: ' + html1);
  } finally {
    await page1.context().close();
  }

  // With "Grace CYC" entered as the "also known as" name, the SAME narration now yields 2 matching words
  // (GRACE + CYC) and should be counted as a genuine direct inflow match.
  var page2 = await newPageAt(ctx.browser, '/index.html');
  try {
    await passConsentGate(page2);
    await goToSessionByPill(page2, 3);
    await page2.fill('#f_name', 'Test Applicant');
    await page2.selectOption('#f_workStatus', 'employed');
    await page2.fill('#f_employerName', 'Grace Covenant Youth Church');
    await page2.fill('#f_employerAltName', 'Grace CYC');
    await goToSessionByPill(page2, 4);
    await page2.setInputFiles('#stmtFile1', FIXTURE);
    await page2.click('#btnAnalyzeStatements');
    await page2.waitForFunction(function(){
      var el = document.getElementById('stmtAnalyzeMsg');
      return el && /Detected \d+ transaction/.test(el.textContent);
    }, { timeout: 20000 });
    await page2.waitForTimeout(300);
    var html2 = await page2.$eval('#stmtAnalyzeMsg', function(el){ return el.innerHTML; });
    assert.ok(/Found "Grace Covenant Youth Church" as the sender on 1 inflow/i.test(html2),
      'With "Grace CYC" as the also-known-as name, the abbreviated narration should now be recognised, got: ' + html2);
    assert.ok(/totaling ₦150,000/.test(html2), 'Should total the recognised inflow correctly, got: ' + html2);

    // The applicant's own typed full name is still what's shown — never the alias itself.
    assert.ok(!/Found "Grace CYC"/.test(html2), 'Should display the full typed name, not the alias, got: ' + html2);
  } finally {
    await page2.context().close();
  }
};
