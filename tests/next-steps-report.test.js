'use strict';
// Founder's own field method, dictated directly: after Passport, Travel Experience, Your
// responsibilities, and both finance sessions, the applicant should get ONE synthesized report -
// passport validity vs. the 6-month rule, travel-history strength (with a concrete easier-country
// suggestion when there's none yet), and finance readiness - before document collection starts.
// "The reason why it is a hard gate is that... once you've done your financial analysis, we give
// you what to do next... that gate is needed before you proceed" - explicit product decision,
// the one deliberate exception to the app's "pills are always freely clickable" design (see the
// comment above goToSession()'s nextSteps check in index.html). Covers: the gate actually holding
// on a REAL pill click (not the test-only __testGoToSession escape hatch, which bypasses it by
// design), the Next button hard-blocking the same way, ticking the box unblocking both, and the
// report content itself (passport/travel-history/finance sections + the time-to-travel breakdown).
const assert = require('assert');
const { newPageAt, passConsentGate, goToSessionByPill, goToSessionByLabel, pickTravelCountry } = require('./helpers');

exports.run = async function(ctx){
  // Scenario 1: the hard gate itself, on the empty/default report.
  var page = await newPageAt(ctx.browser, '/index.html');
  try {
    await passConsentGate(page);
    await goToSessionByLabel(page, 'What to do next');
    await page.waitForSelector('#nextStepsReportBox');

    // Nothing filled in yet - all three sections should point at where to go fill them in, and the
    // overall verdict should say so too, not claim a status it can't back up.
    var emptyReportHtml = await page.$eval('#nextStepsReportBox', function(el){ return el.innerHTML; });
    assert.ok(/Passport expiry not entered yet/.test(emptyReportHtml), 'Passport section should point at Session 1 when nothing is entered, got: ' + emptyReportHtml.slice(0, 400));
    assert.ok(/Not answered yet.*Session 2/.test(emptyReportHtml) || /Session 2 \(Travel Experience\)/.test(emptyReportHtml), 'Travel history section should point at Session 2 when unanswered, got: ' + emptyReportHtml.slice(0, 600));
    assert.ok(/Finances not entered yet/.test(emptyReportHtml), 'Finance section should say finances aren\'t entered yet, got: ' + emptyReportHtml.slice(0, 800));
    assert.ok(/fill in the sections above/.test(emptyReportHtml), 'Overall verdict should ask to fill in the sections above rather than claim a verdict, got: ' + emptyReportHtml);

    // Find the pill immediately after "What to do next" and try to jump straight there with a REAL
    // click - unlike goToSessionByPill (the __testGoToSession escape hatch), this actually goes
    // through goToSession()'s real gate check.
    var nextPillIdx = await page.$eval('.session-pill.active', function(el){ return parseInt(el.getAttribute('data-idx'), 10) + 1; });
    await page.click('.session-pill[data-idx="' + nextPillIdx + '"]');
    await page.waitForTimeout(150);
    var stillOnNextSteps = await page.$eval('.session-progress-text', function(el){ return el.textContent; });
    assert.ok(/What to do next/.test(stillOnNextSteps), 'A pill click past "What to do next" should be redirected back here while unacknowledged, got: ' + stillOnNextSteps);
    var ackFlagged = await page.$eval('#nextStepsAck', function(el){ return el.classList.contains('field-invalid'); });
    assert.strictEqual(ackFlagged, true, 'The unchecked acknowledgment box should be highlighted as the reason navigation was blocked');

    // The Next button hard-blocks the same way (attemptAdvanceSession, same READY_THRESHOLD_PERCENT
    // machinery every other session's Next button already uses - see sessionProgress('nextSteps')).
    await page.click('#sessionNextBtn');
    await page.waitForTimeout(150);
    var stillOnNextStepsAfterNext = await page.$eval('.session-progress-text', function(el){ return el.textContent; });
    assert.ok(/What to do next/.test(stillOnNextStepsAfterNext), 'The Next button should also stay blocked while unacknowledged, got: ' + stillOnNextStepsAfterNext);

    // Ticking the box unblocks both routes - real pill click first.
    await page.check('#nextStepsAck');
    await page.waitForTimeout(150);
    await page.click('.session-pill[data-idx="' + nextPillIdx + '"]');
    await page.waitForTimeout(150);
    var movedOn = await page.$eval('.session-progress-text', function(el){ return el.textContent; });
    assert.ok(!/What to do next/.test(movedOn), 'A pill click should reach the next session once the box is ticked, got: ' + movedOn);
  } finally {
    await page.context().close();
  }

  // Scenario 2: passport clears the 6-month rule, no travel history yet, travel date ~30 days out -
  // exercises the "good" passport verdict, the "build history first" recommendation (Ghana/Kenya/
  // Ethiopia/Morocco, since finances aren't strong), and the time-to-travel prioritized breakdown.
  var page2 = await newPageAt(ctx.browser, '/index.html');
  try {
    await passConsentGate(page2);
    // Passport session (index 0, open by default) - expiry well beyond any 6-month rule.
    await page2.fill('#f_passportExpiry', '2035-01-01');
    // Travel Experience session - explicitly answer "no travel history" so the report's travel-
    // history section has an actual answer to read, rather than falling into its "not answered
    // yet" branch (te_firstTime defaults to blank - see the <option value="" selected> in the HTML).
    await goToSessionByPill(page2, 1);
    await page2.selectOption('#te_firstTime', 'no');
    // Trip session - a travel date about a month out.
    await goToSessionByPill(page2, 3);
    var soonDate = new Date(Date.now() + 30 * 86400000);
    var soonIso = soonDate.toISOString().slice(0, 10);
    await page2.fill('#f_traveldate', soonIso);
    await page2.waitForTimeout(150);

    await goToSessionByLabel(page2, 'What to do next');
    await page2.waitForFunction(function(){
      var el = document.getElementById('nextStepsReportBox');
      return el && /clears the 6-months-beyond-travel-date rule/.test(el.textContent);
    }, { timeout: 3000 });
    var reportHtml2 = await page2.$eval('#nextStepsReportBox', function(el){ return el.innerHTML; });
    assert.ok(/clears the 6-months-beyond-travel-date rule/.test(reportHtml2), 'Passport section should show the "clears the rule" verdict, got: ' + reportHtml2.slice(0, 400));
    assert.ok(/No travel history on file yet/.test(reportHtml2), 'Travel history section should flag no history yet, got: ' + reportHtml2.slice(0, 900));
    assert.ok(/Ghana, Kenya, Ethiopia, or Morocco/.test(reportHtml2), 'Should recommend the easier-country list since finances aren\'t strong, got: ' + reportHtml2.slice(0, 900));
    assert.ok(/day\(s\) until your travel date/.test(reportHtml2), 'Should show the time-to-travel breakdown for a ~30-day-out trip, got: ' + reportHtml2);
    assert.ok(/Consider an easier destination now/.test(reportHtml2), 'Priority list should flag the thin travel history, got: ' + reportHtml2);
    assert.ok(/Focus on strengthening your finances/.test(reportHtml2), 'Priority list should flag unentered/weak finances, got: ' + reportHtml2);
    assert.ok(!/Renew your passport first/.test(reportHtml2), 'Priority list should NOT flag the passport - it already clears the rule');
  } finally {
    await page2.context().close();
  }

  // Scenario 3: real travel history including a high-success-tier country (South Africa), no
  // overstay - should read as a positive, not a "go build history" recommendation.
  var page3 = await newPageAt(ctx.browser, '/index.html');
  try {
    await passConsentGate(page3);
    await goToSessionByPill(page3, 1); // travelExperience
    await page3.selectOption('#te_firstTime', 'yes');
    await page3.click('#btnAddTravelRow');
    await page3.waitForSelector('#travelHistoryBody input[data-idx="0"][data-field="country"]');
    await pickTravelCountry(page3, 'travelHistoryBody', 0, 'South Africa');
    await page3.fill('#travelHistoryBody input[data-idx="0"][data-field="days"]', '10');
    await page3.waitForTimeout(150);

    await goToSessionByLabel(page3, 'What to do next');
    await page3.waitForFunction(function(){
      var el = document.getElementById('nextStepsReportBox');
      return el && /You have travel history on file/.test(el.textContent);
    }, { timeout: 3000 });
    var reportHtml3 = await page3.$eval('#nextStepsReportBox', function(el){ return el.innerHTML; });
    assert.ok(/You have travel history on file/.test(reportHtml3), 'Should read the existing history as a positive, got: ' + reportHtml3.slice(0, 600));
    assert.ok(/South Africa, Morocco, and\/or Kenya/.test(reportHtml3), 'Should call out the high-success-tier country visited, got: ' + reportHtml3.slice(0, 600));
  } finally {
    await page3.context().close();
  }
};
