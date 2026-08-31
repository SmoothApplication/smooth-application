'use strict';
// Direct user feedback: the "X day(s) until your planned submission date" countdown (Your trip
// details) and the "roughly N month(s) of saving to close this gap" figure (Financial readiness)
// never spoke to each other — an applicant could see "10 days to prepare" right next to a shortfall
// that would actually take over a year of saving to close, with nothing joining those two facts
// together, and no mention that the destination's own processing time adds further real waiting time
// on top. Modelled on the user's own worked example — a ~₦4,000,000 target, ~₦32,000-₦300,000 on
// hand, and a ~₦250,000/month salary, which the user themselves worked out to roughly 16 months —
// this tests that both places in the app (the quick "statement readiness" box and the detailed
// financial calculator) now say so explicitly, with a suggestion to check for other traceable income
// or push the date back rather than assume the target date is fixed. Expected months figures are
// computed the same way the app computes them, not hardcoded, so exact amounts differ slightly
// between the two boxes (they use different cost-estimate sources) without weakening the test.
const assert = require('assert');
const { newPageAt, passConsentGate, goToSessionByPill, goToFinanceStep } = require('./helpers');

function fmtN(n){
  n = Math.round(n || 0);
  var s = n.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return '₦' + s;
}
// Local-date construction (not toISOString, which is UTC-based) — matches the exact approach
// prep-time-countdown.test.js already uses to reliably land on an exact day count.
function toDateInputValue(d){
  var y = d.getFullYear();
  var m = String(d.getMonth() + 1).padStart(2, '0');
  var day = String(d.getDate()).padStart(2, '0');
  return y + '-' + m + '-' + day;
}
function addDays(base, days){
  var d = new Date(base);
  d.setDate(d.getDate() + days);
  return d;
}

exports.run = async function(ctx){
  var page = await newPageAt(ctx.browser, '/index.html');
  try {
    await passConsentGate(page);

    await goToSessionByPill(page, 3); // 'Your trip details'
    await page.fill('#f_traveldate', '2027-06-01');
    await page.fill('#f_returndate', '2027-06-07'); // 6 nights, matches the "Rough worst-case cost estimate" used by the quick readiness box
    var today = new Date();
    today.setHours(0,0,0,0);
    await page.fill('#f_appdate', toDateInputValue(addDays(today, 10)));
    await page.selectOption('#f_workStatus', 'employed');
    await page.fill('#f_employerName', 'Good Employer Ltd');
    await page.waitForTimeout(300);

    await goToSessionByPill(page, 4); // 'Income & bank statement analysis' — holds the cash-flow table
    await goToFinanceStep(page, 2); // '2. Cash flow & scores' tab — the cash-flow table lives here, not the default 'Upload statements' step

    // A steady ₦250,000/month salary, no spending tracked here, so monthlyNetSavings works out to
    // exactly 250,000 — and a last closing balance of ₦32,000, matching the user's own real numbers.
    for (var i = 1; i <= 6; i++){
      await page.fill('#cf_month_' + i, 'Month ' + i);
      await page.fill('#cf_in_' + i, '250000');
      await page.fill('#cf_out_' + i, '0');
    }
    await page.fill('#cf_bal_6', '32000');
    await page.waitForTimeout(300);

    // ---- Quick "statement readiness" box (uses the rough trip-cost estimate + cash-flow closing balance) ----
    var readinessHtml = await page.$eval('#statementReadinessBox', function(el){ return el.innerHTML; });
    var qHotel = 50000 * 6;
    var qTransportNgn = 6 * 6 * 1840.60;
    var qShoppingNgn = 100 * 1840.60;
    var qTotal = qHotel + qTransportNgn + qShoppingNgn + 1500000;
    var qRecommended = qTotal * 2;
    var expectedShortfall = qRecommended - 32000;
    var expectedMonths = Math.ceil(expectedShortfall / 250000);

    assert.ok(/Reality check/.test(readinessHtml), 'Should surface the reality-check text once the gap outlasts the prep window, got: ' + readinessHtml.slice(0, 1200));
    assert.ok(readinessHtml.indexOf('roughly ' + expectedMonths + ' more month(s)') !== -1,
      'Should state the correct months-needed figure (' + expectedMonths + '), got: ' + readinessHtml.slice(0, 1200));
    assert.ok(readinessHtml.indexOf('only 10 day(s) to prepare') !== -1,
      'Should reference the actual prep-time countdown (10 days), got: ' + readinessHtml.slice(0, 1200));
    assert.ok(/UKVI.{0,3}s own processing time is around 3 weeks/.test(readinessHtml),
      'Should mention the destination authority\'s own processing time as separate, non-helping wait time, got: ' + readinessHtml.slice(0, 1600));
    assert.ok(/other traceable income/.test(readinessHtml) && /allowance/.test(readinessHtml),
      'Should suggest checking for other traceable income (allowance/bonus) as an alternative, got: ' + readinessHtml.slice(0, 1600));
    assert.ok(/push (your |the )?(application \(and travel\) date|travel date) back/.test(readinessHtml),
      'Should suggest pushing the date back as the honest alternative, got: ' + readinessHtml.slice(0, 1600));

    // ---- Detailed financial calculator (its own totalCost/closing-balance fields) ----
    // This is a SEPARATE top-level session ('Financial readiness calculator', pill 5) from the one
    // above ('Income & bank statement analysis', pill 4) — computeFinancials() reads both sessions'
    // fields together regardless of which is currently on screen, but Playwright still needs the
    // fields themselves visible (i.e. their own session actually selected) before it can fill them.
    // Chosen so recommendedFunds lands on exactly ₦4,000,000 (2× a ₦2,000,000 total trip cost) — the
    // user's own round-number target. Closing balance here is deliberately ₦300,000, not the ₦32,000
    // used above — this calculator has its own separate "below ₦200,000 floor" error that takes
    // priority and would otherwise mask the reality-check message entirely; ₦300,000 clears that
    // floor while still leaving a large gap against the ₦4,000,000 target.
    await goToSessionByPill(page, 5); // 'Financial readiness calculator'
    await page.fill('#fc_flight', '1400000');
    await page.fill('#fc_accom', '50000'); // × 6 nights = 300,000
    await page.fill('#fc_transport', '100000');
    await page.fill('#fc_shopping', '100000');
    await page.fill('#fc_sightseeing', '100000');
    await page.fill('#fc_closing', '300000');
    await page.waitForTimeout(300);

    var finHtml = await page.$eval('#finSummary', function(el){ return el.innerHTML; });
    var totalCost = 1400000 + 300000 + 100000 + 100000 + 100000;
    assert.strictEqual(totalCost, 2000000, 'Sanity check on the chosen figures — total trip cost should be exactly 2,000,000');
    var recommendedFunds = totalCost * 2;
    assert.strictEqual(recommendedFunds, 4000000, 'Sanity check — recommended funds (2×) should be exactly 4,000,000, matching the user\'s own target');
    var shortfall = recommendedFunds - 300000;
    var monthsNeeded = Math.ceil(shortfall / 250000);
    assert.strictEqual(monthsNeeded, 15, 'Sanity check on the worked figures — should come out to 15 months at this closing balance');

    assert.ok(/Reality check/.test(finHtml), 'Detailed calculator should also surface the reality-check text, got: ' + finHtml.slice(0, 1400));
    assert.ok(finHtml.indexOf('roughly ' + monthsNeeded + ' more month(s)') !== -1,
      'Detailed calculator should state ' + monthsNeeded + ' more month(s), got: ' + finHtml.slice(0, 1400));
    assert.ok(finHtml.indexOf(fmtN(shortfall)) !== -1, 'Detailed calculator should show the correct shortfall amount (' + fmtN(shortfall) + '), got: ' + finHtml.slice(0, 1400));
    // The reality-check firing should escalate this specific message from a routine 'warn' to a
    // more serious 'err' — the plan genuinely doesn't add up as it stands, not just "needs attention".
    var errMsgText = await page.$eval('#finSummary .scan-msg.err', function(el){ return el.textContent; }).catch(function(){ return ''; });
    assert.ok(/Reality check/.test(errMsgText), 'The reality-check message should render at "err" severity, got err-class text: "' + errMsgText.slice(0, 200) + '"');
  } finally {
    await page.context().close();
  }
};
