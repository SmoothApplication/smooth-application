'use strict';
// User feedback, off a real bank statement export: a genuine ₦100,000 payment from a cleaning-services
// company ("office") got swept into a false, generic "Salary" bucket in the "Income sources breakdown"
// — alongside other, completely unrelated senders' one-off ₦100,000 payments — instead of appearing
// under its own sender's name where it belongs. Root cause: identifyStableIncome() only looks for a
// rounded amount recurring across 2+ distinct months anywhere in the whole statement, with no check
// that the SAME sender is behind those recurring payments — so several unrelated senders' payments that
// merely coincide on a round number got treated as one "stable income" source. The fix requires the
// amount's recurrence to also come from a consistent, identifiable sender (via identifyIncomeSourceName)
// before trusting it as "Salary"; a payment that names its own distinct sender, and that sender doesn't
// match, is grouped under its own name instead — same as any other inflow.
//
// Fixture uses fictional names throughout (not the real applicant's statement).
const assert = require('assert');
const path = require('path');
const { newPageAt, passConsentGate, goToSessionByPill } = require('./helpers');

exports.run = async function(ctx){
  var page = await newPageAt(ctx.browser, '/index.html');
  try {
    await passConsentGate(page);
    await goToSessionByPill(page, 1); // finance2 = Income & bank statement analysis

    var fixturePath = path.join(__dirname, 'fixtures', 'false-salary-bucket-fixture.pdf');
    await page.setInputFiles('#stmtFile1', fixturePath);
    await page.waitForTimeout(500);
    await page.click('#btnAnalyzeStatements');
    await page.waitForTimeout(8000);

    var boxHtml = await page.$eval('#incomeBreakdownBox', function(el){ return el.innerHTML; });

    // No false "Salary" bucket should form at all — none of these three ₦100,000 payments share a real,
    // consistent sender, so there's nothing genuinely "stable" about the coincidence. Matched against the
    // group HEADER specifically (<b>Salary</b>), not just anywhere in the box — every group's own
    // "choose a reason" dropdown legitimately includes a "Salary" option regardless of the group.
    assert.ok(!/<b>Salary<\/b>/.test(boxHtml), 'Should NOT create a false "Salary" group from unrelated senders sharing a coincidental amount, got: ' + boxHtml.slice(0, 600));

    // The cleaning-services company payment (the disputed one from the real report) should appear under
    // its own, correctly-identified sender group instead — note "Limited" itself is stripped by
    // extractNameCandidates (a recognised company-suffix stopword), so the group name is the name
    // without that suffix, same as every other company-suffixed sender in this app.
    assert.ok(/Sparkle Shine Cleaning Services/.test(boxHtml), 'Expected a "Sparkle Shine Cleaning Services" group to exist, got: ' + boxHtml.slice(0, 600));
    // ...keeping its own original narration/reason ("office"), same as every other individual payment.
    assert.ok(/office/i.test(boxHtml), 'Expected the ₦100,000 payment\'s own "office" narration/reason to show under its real sender, got: ' + boxHtml);

    // The two OTHER unrelated senders should each get their own separate group too, not be lumped
    // together just because their amounts matched.
    assert.ok(/Chidinma Grace Eze/.test(boxHtml), 'Expected Chidinma Grace Eze to have their own group, got: ' + boxHtml.slice(0, 600));
    assert.ok(/Patrick Johnson/.test(boxHtml), 'Expected Patrick Johnson to have their own group, got: ' + boxHtml.slice(0, 600));
  } finally {
    await page.context().close();
  }
};
