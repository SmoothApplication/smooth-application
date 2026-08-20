'use strict';
// Real-data limitation, disclosed off a real 31-page Zenith statement: many bank statement DESCRIPTION
// cells wrap across MORE THAN ONE physical PDF line — the transaction's date and amounts sit on the
// first line, but the tail of its narration (e.g. "...Solutions Ltd/February Salary") spills onto the
// next line, which has no date and no amount figures of its own. That trailing text used to be silently
// dropped (parseLeadingDate rejects it, so the parser just skipped past it), which is exactly why
// narration-dependent checks (salary-reason detection, the narration-consistency percentage) came up
// empty on otherwise-genuine salary payments whose "Salary" word only existed on the wrapped line.
// mergeWrappedNarrationLines now stitches a qualifying trailing line back onto the preceding
// transaction's narration before the rest of the parser ever sees it.
const assert = require('assert');
const path = require('path');
const { newPageAt, passConsentGate, goToSessionByPill } = require('./helpers');

var FIXTURE = path.join(__dirname, 'fixtures', 'wrapped-narration-fixture.pdf');

exports.run = async function(ctx){
  var page = await newPageAt(ctx.browser, '/index.html');
  try {
    await passConsentGate(page);

    await goToSessionByPill(page, 3);
    await page.fill('#f_name', 'Test Applicant');
    await page.selectOption('#f_workStatus', 'selfEmployed');
    await page.fill('#f_businessName', 'Crisp N Clean Exclusive Solutions Ltd');

    await goToSessionByPill(page, 4);
    await page.setInputFiles('#stmtFile1', FIXTURE);
    await page.click('#btnAnalyzeStatements');
    await page.waitForFunction(function(){
      var el = document.getElementById('stmtAnalyzeMsg');
      return el && /Detected \d+ transaction/.test(el.textContent);
    }, { timeout: 20000 });
    await page.waitForTimeout(300);
    var html = await page.$eval('#stmtAnalyzeMsg', function(el){ return el.innerHTML; });

    // Both business inflows should still be found (2 payments, ₦700,000 total) — the wrap-merge must not
    // disturb the amount/date figures, which live entirely on the FIRST physical line of each row.
    assert.ok(/Found "Crisp N Clean Exclusive Solutions Ltd" as the sender on 2 inflows/i.test(html),
      'Should still find both business inflows despite the wrapped narration, got: ' + html);
    assert.ok(/totaling ₦700,000/.test(html), 'Should still total the 2 inflows correctly, got: ' + html);

    // Both narrations' "February Salary" / "March Salary" tail text lived on the WRAPPED second line —
    // without the merge fix this would show as "Inconsistent salary narration" (0% consistency), since
    // the word "Salary" would never have survived into t.narration at all.
    assert.ok(!/Inconsistent salary narration/.test(html),
      'Should NOT flag inconsistent salary narration once the wrapped "Salary" text is recovered, got: ' + html);
    assert.ok(/Narration consistency: 100% of these inflows \(2 of 2\) are explicitly narrated "Salary"/.test(html),
      'Should recognise both wrapped narrations as 100% narrated "Salary", got: ' + html);

    // The itemized matched-inflow box's own narration text should also show the recovered wrapped words,
    // not just the internal reason-detection logic.
    var boxText = await page.$eval('#matchedIncomeInflowsBox', function(el){ return el.textContent; });
    assert.ok(/SOLUTIONS LTD/i.test(boxText) && /February Salary/i.test(boxText),
      'The itemized inflow box should show the recovered wrapped narration text, got: ' + boxText);
  } finally {
    await page.context().close();
  }
};
