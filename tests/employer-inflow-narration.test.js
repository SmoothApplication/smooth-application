'use strict';
// User feedback: "state how many inflow comes in from the employer or business name extracted from
// the bank statement" — the employer/business cross-check used to only say a name was "found"
// somewhere in the statement text. It now counts the actual CREDIT transactions whose own narration
// names the employer/business, totals them, and reads off a human "reason" segment (e.g. "February
// Salary") from bank-style slash-delimited narrations (CHANNEL/PRODUCT-CODE/SENDER/REASON/REFERENCE)
// — including tolerating a truncated company suffix like "LIMITE" instead of "LIMITED"/"LTD", since
// the match is on distinctive words, not the whole name intact.
const assert = require('assert');
const path = require('path');
const { newPageAt, passConsentGate, goToSessionByPill } = require('./helpers');

var INFLOW_STATEMENT = path.join(__dirname, 'fixtures', 'employer-inflow-narration.pdf');

exports.run = async function(ctx){
  var page = await newPageAt(ctx.browser, '/index.html');
  try {
    await passConsentGate(page);

    await page.fill('#f_name', 'Test Applicant');
    await goToSessionByPill(page, 0); // trip session — "Work status" dropdown lives here
    await page.selectOption('#f_workStatus', 'both');
    await page.fill('#f_employerName', 'MFM Lekki Youth Church');
    await page.fill('#f_businessName', 'Crisp N Clean Exclusive Solutions Ltd');

    await goToSessionByPill(page, 1); // finance2 session — statement upload lives here
    await page.setInputFiles('#stmtFile1', INFLOW_STATEMENT);
    await page.click('#btnAnalyzeStatements');
    await page.waitForFunction(function(){
      var el = document.getElementById('stmtAnalyzeMsg');
      return el && /Detected \d+ transaction/.test(el.textContent);
    }, { timeout: 20000 });
    await page.waitForTimeout(300);
    var html = await page.$eval('#stmtAnalyzeMsg', function(el){ return el.innerHTML; });

    // Employer: 3 matching credit inflows (Jan/Feb/Mar "... Allowance"), ₦100,000 each.
    assert.ok(/Found "MFM Lekki Youth Church" as the sender on 3 inflows/i.test(html),
      'Should report 3 inflows for the employer, got: ' + html);
    assert.ok(/totaling ₦300,000/.test(html), 'Should total the employer inflows to ₦300,000, got: ' + html);

    // Business: matched despite the statement's narration truncating "LIMITED" to "LIMITE" (word-based
    // match on CRISP/CLEAN/EXCLUSIVE/SOLUTIONS, not the whole name intact) — 3 inflows, ₦350,000 each.
    assert.ok(/Found "Crisp N Clean Exclusive Solutions Ltd" as the sender on 3 inflows/i.test(html),
      'Should report 3 inflows for the business despite the truncated "LIMITE" suffix in the narration, got: ' + html);
    assert.ok(/totaling ₦1,050,000/.test(html), 'Should total the business inflows to ₦1,050,000, got: ' + html);

    // A narration "reason" (e.g. "January Salary") should be read off the slash-delimited narration and
    // shown. Per-month reasons ("January Salary", "February Salary", "March Salary") are canonicalized
    // (see NARRATION_REASON_SYNONYMS/canonicalizeNarrationReason) before tallying, so these 3 distinct
    // narrations correctly tally as 3 occurrences of the SAME reason ("Salary") rather than 3 separate
    // one-off reasons tied at count 1 — and so it's rightly framed as the "most common" one, not just
    // an example.
    assert.ok(/Most commonly narrated as "Allowance"/.test(html),
      'Should recognise "Allowance" as the majority reason for the employer inflows, got: ' + html);
    assert.ok(/Most commonly narrated as "Salary"/.test(html),
      'Should recognise "Salary" as the majority reason once per-month variants are canonicalized together, got: ' + html);

    // Narration-consistency check (percentage) and the "inconsistent salary" / 6-month red-flag messages.
    assert.ok(/Inconsistent salary narration: none of the 3 inflows from "MFM Lekki Youth Church"/.test(html),
      'Employer inflows narrated "Allowance" (never "Salary") should be flagged as inconsistent salary narration, got: ' + html);
    assert.ok(/Narration consistency: 100% of these inflows \(3 of 3\) are explicitly narrated "Salary"/.test(html),
      'Business inflows all narrated "Salary" should show 100% narration consistency, got: ' + html);
    assert.ok(/Only found employer inflow in 3 distinct month\(s\)/.test(html) && /Only found business inflow in 3 distinct month\(s\)/.test(html),
      'Fewer than 6 distinct months of matched inflow should be flagged as a red flag for both employer and business, got: ' + html);

    // A name genuinely absent from the statement should still produce the original hard warning.
    var page2 = await newPageAt(ctx.browser, '/index.html');
    try {
      await passConsentGate(page2);
      await page2.fill('#f_name', 'Test Applicant');
      await goToSessionByPill(page2, 0);
      await page2.selectOption('#f_workStatus', 'employed');
      await page2.fill('#f_employerName', 'Totally Unrelated Employer Xyzabc');
      await goToSessionByPill(page2, 1);
      await page2.setInputFiles('#stmtFile1', INFLOW_STATEMENT);
      await page2.click('#btnAnalyzeStatements');
      await page2.waitForFunction(function(){
        var el = document.getElementById('stmtAnalyzeMsg');
        return el && /Detected \d+ transaction/.test(el.textContent);
      }, { timeout: 20000 });
      await page2.waitForTimeout(300);
      var html2 = await page2.$eval('#stmtAnalyzeMsg', function(el){ return el.innerHTML; });
      assert.ok(/scan-msg err/.test(html2) && /Totally Unrelated Employer Xyzabc/.test(html2) && /could not be found/i.test(html2),
        'An employer name genuinely absent from the statement should still produce the not-found warning, got: ' + html2);
    } finally {
      await page2.context().close();
    }
  } finally {
    await page.context().close();
  }
};
