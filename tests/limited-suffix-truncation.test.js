'use strict';
// User feedback: "Limited can be Ltd or LTD or Limite because some can be shortened by different bank
// apps." Bank narration fields often truncate the company suffix ("Limited" -> "Limite" is one seen
// case) rather than dropping it cleanly. Two places in this file specifically look for "LTD"/"LIMITED"
// as a literal word: the company-vs-personal classifier used to tag each top inflow (classifySourceType,
// via COMPANY_KEYWORDS) and the narration-stopword logic that keeps a truncated suffix from getting
// glued onto an extracted sender name (BANK_NARRATION_STOPWORDS, via extractNameCandidates). Both now
// also match any word starting with "LIMIT" (LIMIT, LIMITE, LIMITED, ...) via a shared regex
// (LIMITED_SUFFIX_RE), not just the two exact spellings.
const assert = require('assert');
const path = require('path');
const { newPageAt, passConsentGate, goToSessionByPill } = require('./helpers');

var LIMITE_ONLY_STATEMENT = path.join(__dirname, 'fixtures', 'limite-only-company-signal.pdf');

exports.run = async function(ctx){
  var page = await newPageAt(ctx.browser, '/index.html');
  try {
    await passConsentGate(page);
    await goToSessionByPill(page, 1); // finance2 session — statement upload lives here

    // This fixture's narration is "...ABC LIMITE/April Salary/..." — "ABC" alone isn't a recognized
    // company keyword, so the truncated "LIMITE" is the ONLY signal that this is a company payment,
    // not a personal one. Before this fix, only the exact words "LTD"/"LIMITED" were recognized, so
    // this would have been wrongly tagged "Personal".
    await page.setInputFiles('#stmtFile1', LIMITE_ONLY_STATEMENT);
    await page.click('#btnAnalyzeStatements');
    await page.waitForFunction(function(){
      var el = document.getElementById('stmtAnalyzeMsg');
      return el && /Detected \d+ transaction/.test(el.textContent);
    }, { timeout: 20000 });
    await page.waitForTimeout(300);

    var topInflowsHtml = await page.$eval('#topInflowsBox', function(el){ return el.innerHTML; });
    var companyTagCount = (topInflowsHtml.match(/src-tag company/g) || []).length;
    var personalTagCount = (topInflowsHtml.match(/src-tag personal/g) || []).length;
    assert.ok(companyTagCount >= 2,
      'Both inflows with a truncated "LIMITE" suffix should be tagged as Company, got html: ' + topInflowsHtml);
    assert.strictEqual(personalTagCount, 0,
      'A truncated "LIMITE" suffix should not fall through to a Personal tag, got html: ' + topInflowsHtml);
  } finally {
    await page.context().close();
  }
};
