'use strict';
// Bug report from a real Schengen applicant (August 2026): the quick "rough worst-case cost estimate"
// box on the Trip session showed £ (GBP) for local transport/shopping even when EU/Schengen was the
// selected country — it was hardcoded to DEFAULT_GBP_NGN instead of following currentCountry the way
// CLOTHING_PRICE_ESTIMATES/DEFAULT_FX_NGN already do elsewhere in the file. This locks in the fix:
// for EU, that box (and the "how far does this shopping budget go" note, and the sightseeing rate
// label) should all show € rather than £.
const assert = require('assert');
const { newPageAt, passConsentGate, goToSessionByPill } = require('./helpers');

exports.run = async function(ctx){
  var page = await newPageAt(ctx.browser, '/index.html');
  try {
    await passConsentGate(page, { country: 'EU' });

    // f_traveldate/f_returndate live on the "Your trip details" session (index 3) — need to be
    // navigated to before .fill() will work, since only the first session is open by default.
    await goToSessionByPill(page, 3);
    await page.fill('#f_traveldate', '2026-12-01');
    await page.fill('#f_returndate', '2026-12-06');

    await page.waitForSelector('#quickTripCostBox[style*="display: block"]', { timeout: 5000 });
    var quickHtml = await page.$eval('#quickTripCostContent', function(el){ return el.innerHTML; });
    assert.ok(quickHtml.indexOf('€') !== -1, 'Quick trip cost box should show € for a Schengen applicant, got: ' + quickHtml);
    assert.ok(quickHtml.indexOf('£') === -1, 'Quick trip cost box should NOT show £ for a Schengen applicant, got: ' + quickHtml);
  } finally {
    await page.context().close();
  }
};
