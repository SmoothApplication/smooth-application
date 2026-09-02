'use strict';
// GoatCounter funnel data showed most engaged visitors never got past the "Income & bank statement
// analysis" session's Report step (Step 5) — it showed a category-by-category readiness summary
// immediately followed only by "← Back", a "false finish line" with no way forward except scrolling
// past this closed <details> card's boundary to the real session-footer Next button. Fix: a real
// forward CTA right on the Report step itself, wired to the exact same attemptAdvanceSession() gate
// the session-footer Next button already uses — see the comment on #btnFinReportContinue in
// index.html.
const assert = require('assert');
const { newPageAt, passConsentGate, goToSessionByPill, goToFinanceStep } = require('./helpers');

exports.run = async function(ctx){
  var page = await newPageAt(ctx.browser, '/index.html');
  var dialogMessages = [];
  page.on('dialog', function(d){ dialogMessages.push(d.message()); d.dismiss(); });
  try {
    await passConsentGate(page);
    await goToSessionByPill(page, 4); // finance2 — 'Income & bank statement analysis'
    await goToFinanceStep(page, 5);
    await page.waitForSelector('#btnFinReportContinue');

    var btnText = await page.$eval('#btnFinReportContinue', function(el){ return el.textContent; });
    assert.ok(/Next/i.test(btnText), 'Report step should show a forward CTA, got: ' + btnText);

    // Fresh/incomplete finance2 session (0%, well below the 70% gate) — clicking the new CTA should
    // hard-block exactly like the real session-footer Next button would, not silently do nothing and
    // not silently skip the gate.
    await page.click('#btnFinReportContinue');
    await page.waitForTimeout(150);
    var stillOnFinance2 = await page.$eval('.session-pill.active', function(el){ return el.getAttribute('data-idx'); });
    assert.strictEqual(stillOnFinance2, '4', 'An incomplete finance2 session should stay put when the new CTA is clicked, same as the real Next button');

    // Fill in the 2 months of cash flow finance2's progress score requires (see sessionProgress('finance2')
    // in index.html) so this session clears the 70% gate, then the CTA should actually advance.
    await goToFinanceStep(page, 2);
    await page.fill('#cf_in_1', '50000');
    await page.fill('#cf_in_2', '60000');
    await page.evaluate(function(){ document.activeElement && document.activeElement.blur(); });
    await page.waitForTimeout(150);
    await goToFinanceStep(page, 5);

    dialogMessages.length = 0;
    await page.click('#btnFinReportContinue');
    await page.waitForTimeout(200);
    assert.strictEqual(dialogMessages.length, 0, 'A ready (>=70%) finance2 session should advance with no gate dialog');
    var nowOnSession = await page.$eval('.session-pill.active', function(el){ return el.getAttribute('data-idx'); });
    assert.strictEqual(nowOnSession, '5', 'Clicking the Report step CTA should advance to the next session (Financial readiness calculator)');
  } finally {
    await page.context().close();
  }
};
