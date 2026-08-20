'use strict';
// Real report from an applicant with a First Bank statement: pdf.js rejects a password-protected PDF
// with a PasswordException, which (before this fix) was silently swallowed by the per-file .catch()
// in the statement-analysis chain — the applicant just got the same generic "couldn't detect
// transaction rows / format may be unusual" message a genuinely unsupported bank format would show,
// which gives no clue that the real problem is a password and is easy to fix on their end.
//
// Both the personal (finance2) and business statement-analysis flows now recognise
// err.name === 'PasswordException' specifically and tell the applicant so, with concrete next steps.
const assert = require('assert');
const path = require('path');
const { passConsentGate, goToSessionByPill, newPageAt } = require('./helpers');

var FIXTURE = path.join(__dirname, 'fixtures', 'password-protected-statement-fixture.pdf');

exports.run = async function(ctx){
  // Personal bank-statement flow (finance2).
  var page = await newPageAt(ctx.browser, '/index.html');
  try {
    await passConsentGate(page);
    await goToSessionByPill(page, 4);
    await page.setInputFiles('#stmtFile1', FIXTURE);
    await page.waitForTimeout(300);
    await page.click('#btnAnalyzeStatements');
    await page.waitForFunction(function(){
      var el = document.getElementById('stmtAnalyzeMsg');
      return el && /password-protected/i.test(el.textContent);
    }, { timeout: 15000 });
    var html = await page.$eval('#stmtAnalyzeMsg', function(el){ return el.innerHTML; });

    assert.ok(/password-protected-statement-fixture\.pdf.{0,20}appears to be password-protected/is.test(html),
      'Should name the specific password-protected file, got: ' + html.slice(0, 600));
    assert.ok(!/format may be unusual/i.test(html),
      'Should show the password-specific message, not the generic "format may be unusual" one, got: ' + html.slice(0, 600));
    assert.ok(/wa\.me\/2349081389969/.test(html), 'Should still offer a report path, got: ' + html.slice(0, 600));
  } finally {
    await page.context().close();
  }

  // Business statement flow.
  var page2 = await newPageAt(ctx.browser, '/index.html');
  try {
    await passConsentGate(page2);
    await goToSessionByPill(page2, 3); // trip session — Work status lives here
    await page2.selectOption('#f_workStatus', 'selfEmployed');
    await page2.waitForTimeout(150);
    await goToSessionByPill(page2, 7); // 0 passport, 1 travelExperience, 2 responsibilities, 3 trip, 4 finance2, 5 finance, 6 cat:Identity & application, 7 cat:Financial evidence
    await page2.waitForSelector('#file_bizFinance', { timeout: 5000 });
    await page2.setInputFiles('#file_bizFinance', FIXTURE);
    await page2.waitForTimeout(300);
    await page2.click('#scan_bizFinance');
    await page2.waitForFunction(function(){
      var el = document.getElementById('scanmsg_bizFinance');
      return el && /password-protected/i.test(el.textContent);
    }, { timeout: 15000 });
    var bizHtml = await page2.$eval('#scanmsg_bizFinance', function(el){ return el.innerHTML; });

    assert.ok(/password-protected-statement-fixture\.pdf.{0,20}appears to be password-protected/is.test(bizHtml),
      'Business flow should also name the specific password-protected file, got: ' + bizHtml.slice(0, 600));
    assert.ok(!/format may be unusual/i.test(bizHtml),
      'Business flow should show the password-specific message, not the generic one, got: ' + bizHtml.slice(0, 600));
  } finally {
    await page2.context().close();
  }
};
