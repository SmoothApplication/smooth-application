'use strict';
// Field-work request: "ESTIMATE BY ROAD AND FLIGHT FOR 3-5 DAYS TO GHANA KENYA ETHIOPIA... SOUTH
// AFRICA" — a rough cost estimate for building travel history cheaply, alongside the existing visa-
// requirement guide for each country (see TE_NO_HISTORY_GUIDES). Ghana is the one country here with
// a genuine overland option from Nigeria; the other three don't (crossing through several borders,
// some genuinely unsafe overland) — this checks that distinction is actually surfaced, not just a
// flight price dropped in next to all four uniformly.
//
// Reads from #teCountryGuideModalBody, not an inline page box — see the comment on
// renderTeCountryGuide() in index.html for why this content moved into a modal.
const assert = require('assert');
const { newPageAt, passConsentGate, goToSessionByLabel } = require('./helpers');

exports.run = async function(ctx){
  var page = await newPageAt(ctx.browser, '/index.html');
  try {
    await passConsentGate(page);
    await goToSessionByLabel(page, 'Travel Experience');
    await page.selectOption('#te_firstTime', 'no');
    await page.waitForTimeout(50);

    // The guide is a modal now (see the file header note) — its overlay sits on top of the country
    // tabs behind it, so switching countries means closing it before the next tab is clickable
    // again, same as a real applicant would have to.
    await page.click('.te-country-tab-btn[data-country="Ghana"]');
    await page.waitForTimeout(50);
    var ghanaText = await page.$eval('#teCountryGuideModalBody', function(el){ return el.textContent; });
    assert.ok(/By road:/.test(ghanaText), 'Ghana should show a road option, got: ' + ghanaText);
    assert.ok(/ABC Transport/.test(ghanaText), 'Ghana road estimate should name a real operator, got: ' + ghanaText);
    assert.ok(/By flight:/.test(ghanaText), 'Ghana should also show a flight option, got: ' + ghanaText);
    assert.ok(!/Not a realistic option/.test(ghanaText), 'Ghana has a real road option, should not show the no-overland-route line, got: ' + ghanaText);
    await page.click('#teCountryGuideModalClose');

    await page.click('.te-country-tab-btn[data-country="Kenya"]');
    await page.waitForTimeout(50);
    var kenyaText = await page.$eval('#teCountryGuideModalBody', function(el){ return el.textContent; });
    assert.ok(/Not a realistic option/.test(kenyaText), 'Kenya has no safe overland route — should say so plainly, got: ' + kenyaText);
    assert.ok(/By flight:/.test(kenyaText), 'Kenya should still show a flight estimate, got: ' + kenyaText);
    await page.click('#teCountryGuideModalClose');

    await page.click('.te-country-tab-btn[data-country="South Africa"]');
    await page.waitForTimeout(50);
    var zaText = await page.$eval('#teCountryGuideModalBody', function(el){ return el.textContent; });
    assert.ok(/Not a realistic option/.test(zaText), 'South Africa has no safe overland route — should say so plainly, got: ' + zaText);

    // Every cost figure carries the same "rough, confirm before booking" caveat as the rest of this
    // app's volatile-figure content — never presented as a fixed, guaranteed price.
    assert.ok(/Rough figures only/.test(zaText), 'Cost box should carry its own volatility caveat, got: ' + zaText);
  } finally {
    await page.context().close();
  }
};
