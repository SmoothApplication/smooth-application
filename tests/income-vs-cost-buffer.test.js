'use strict';
// User feedback, from someone who has helped many applicants prepare UK visa evidence over the years:
// reviewers have refused applicants who technically had enough money sitting in the account (the
// existing 2× funds/closing-balance buffer) but whose actual INCOME barely covered the trip cost —
// reasoning, seen directly in a real refusal letter, that the applicant would be spending essentially
// their entire income on a vacation with nothing left for rent, bills, school fees, and family costs.
// Their rule of thumb from years of real outcomes: aim for annual income at least 4× the estimated trip
// cost — equivalent, over the same 6-month window the cash-flow table already asks for, to a 2× buffer
// on total 6-month inflow, deliberately reusing the same multiplier/language as the funds-buffer check.
//
// This is a companion check to the funds buffer, not a replacement — it only appears once the full
// 6-month cash-flow table is filled in, and never overrides the funds-buffer message, it just adds to it.
const assert = require('assert');
const { newPageAt, passConsentGate, goToSessionByPill, goToFinanceStep } = require('./helpers');

// The cash-flow table lives in session index 1 ("Income & bank statement analysis"), not session 2
// (the detailed financial calculator, where fc_flight/fc_accom/fc_closing live) — has to be the active
// session for Playwright's .fill() to treat the inputs as visible/interactable. Within that session,
// the table itself is on step 2 (Cash flow & scores) of the session's own internal step tabs — step 1
// (Upload) is the default, so typing straight into the table without uploading anything first needs
// an explicit tab switch.
async function fillCashFlowMonths(page, monthlyInflow){
  await goToSessionByPill(page, 4);
  await goToFinanceStep(page, 2);
  for (var i = 1; i <= 6; i++){
    await page.fill('#cf_month_' + i, 'Month ' + i);
    await page.fill('#cf_in_' + i, String(monthlyInflow));
    await page.fill('#cf_out_' + i, '50000');
    await page.fill('#cf_bal_' + i, '500000');
  }
  await page.waitForTimeout(300);
}

exports.run = async function(ctx){
  // Scenario 1: thin income margin — 6-month inflow well under the recommended 2× buffer.
  var page = await newPageAt(ctx.browser, '/index.html');
  try {
    await passConsentGate(page);
    await goToSessionByPill(page, 5); // detailed financial calculator
    // Trip cost: flight 500,000/adult + accommodation 100,000/night × 5 nights = 1,000,000 total.
    // Recommended funds/income buffer (2×) = 2,000,000.
    await page.fill('#fc_nights', '5');
    await page.fill('#fc_flight', '500000');
    await page.fill('#fc_accom', '100000');
    await page.fill('#fc_closing', '3000000'); // comfortably covers the funds buffer, isolating the income check
    await fillCashFlowMonths(page, 100000); // 100,000 × 6 = 600,000 — well under the 2,000,000 recommended income

    var html = await page.$eval('#finSummary', function(el){ return el.innerHTML; });
    assert.ok(/Total inflow, last 6 months.{0,40}600,000/is.test(html), 'Should show the 6-month total inflow in the breakdown, got: ' + html.slice(0, 1500));
    assert.ok(/Recommended income over 6 months.{0,40}2,000,000/is.test(html), 'Should show the recommended income figure (2×), got: ' + html.slice(0, 1500));
    assert.ok(/your total inflow over these 6 months \(₦?600,000\) covers about 30% of a recommended 2× buffer/i.test(html),
      'Should warn that income covers about 30% of the recommended buffer, got: ' + html.slice(0, 2000));
    assert.ok(/equivalent to earning roughly 4× this trip.s cost annually/i.test(html), 'Should explain the annual-4× framing, got: ' + html.slice(0, 2000));
  } finally {
    await page.context().close();
  }

  // Scenario 2: healthy income margin — 6-month inflow comfortably covers the buffer.
  var page2 = await newPageAt(ctx.browser, '/index.html');
  try {
    await passConsentGate(page2);
    await goToSessionByPill(page2, 5);
    await page2.fill('#fc_nights', '5');
    await page2.fill('#fc_flight', '500000');
    await page2.fill('#fc_accom', '100000');
    await page2.fill('#fc_closing', '3000000');
    await fillCashFlowMonths(page2, 400000); // 400,000 × 6 = 2,400,000 — comfortably over 2,000,000

    var html2 = await page2.$eval('#finSummary', function(el){ return el.innerHTML; });
    assert.ok(/your total inflow over these 6 months \(₦?2,400,000\) comfortably covers the recommended 2× buffer/i.test(html2),
      'Should show the healthy-income success message, got: ' + html2.slice(0, 2000));
    assert.ok(!/covers about \d+% of a recommended 2× buffer/i.test(html2), 'Should NOT show the shortfall warning once income clears the buffer, got: ' + html2.slice(0, 2000));
  } finally {
    await page2.context().close();
  }

  // Scenario 3: fewer than 6 months of cash-flow data filled in — the income check should stay hidden
  // entirely rather than guess-scaling a partial window.
  var page3 = await newPageAt(ctx.browser, '/index.html');
  try {
    await passConsentGate(page3);
    await goToSessionByPill(page3, 5);
    await page3.fill('#fc_nights', '5');
    await page3.fill('#fc_flight', '500000');
    await page3.fill('#fc_accom', '100000');
    await page3.fill('#fc_closing', '3000000');
    await goToSessionByPill(page3, 4);
    await goToFinanceStep(page3, 2);
    await page3.fill('#cf_month_1', 'Month 1');
    await page3.fill('#cf_in_1', '100000');
    await page3.fill('#cf_month_2', 'Month 2');
    await page3.fill('#cf_in_2', '100000');
    await page3.waitForTimeout(300);

    var html3 = await page3.$eval('#finSummary', function(el){ return el.innerHTML; });
    assert.ok(!/Recommended income over 6 months/i.test(html3), 'Should NOT show the income-buffer check with only a partial 6-month window filled in, got: ' + html3.slice(0, 1500));
  } finally {
    await page3.context().close();
  }
};
