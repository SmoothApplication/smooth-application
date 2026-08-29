'use strict';
// Smoke test for the South Africa visitor-visa checklist (added alongside UK/Canada/Schengen).
// Confirms the country is selectable and fully wired end-to-end: the header/footer text switches
// to South Africa's own copy, the accommodation category picks up South Africa's host label
// (proving applyCountryText()'s generic cat-name derivation works for a 4th country, not just the
// original 3), and a South Africa-specific document (yellow fever certificate — required because
// Nigeria is a yellow-fever-endemic country under SA entry rules) actually renders in the list.
const assert = require('assert');
const { newPageAt, passConsentGate, goToSessionByLabel } = require('./helpers');

exports.run = async function(ctx){
  var page = await newPageAt(ctx.browser, '/index.html');
  try {
    await passConsentGate(page, { country: 'ZA' });

    var indicatorText = await page.$eval('#countryIndicator', function(el){ return el.textContent; });
    assert.ok(/South Africa visitor visa/i.test(indicatorText), 'Header indicator should show the South Africa visa name, got: ' + indicatorText);

    var footerText = await page.$eval('#footerLinks', function(el){ return el.textContent; });
    assert.ok(/VFS Global/i.test(footerText), 'Footer links should mention VFS Global, got: ' + footerText);
    assert.ok(/Home Affairs/i.test(footerText), 'Footer links should mention the Department of Home Affairs, got: ' + footerText);

    // Accommodation category should use South Africa's own host label, not a leftover UK/CA/EU one.
    await goToSessionByLabel(page, 'Accommodation & South African host');
    var accomText = await page.$eval('#checklistRoot', function(el){ return el.textContent; });
    assert.ok(/South African host/i.test(accomText), 'Accommodation session should be labelled for a South African host, got snippet: ' + accomText.slice(0, 200));

    // The host affidavit item is conditional on "staying with a host" + "host is funding the trip"
    // (appliesIf: a.hasHost && a.hostFunding) — tick both before checking it renders.
    await page.check('#f_hasHost', { force: true });
    await page.check('#f_hostFunding', { force: true });
    await goToSessionByLabel(page, 'Accommodation & South African host');
    var accomTextWithHost = await page.$eval('#checklistRoot', function(el){ return el.textContent; });
    assert.ok(/affidavit of undertaking/i.test(accomTextWithHost), 'Accommodation session should mention the South Africa-specific host affidavit once a funding host is selected, got snippet: ' + accomTextWithHost.slice(0, 200));

    // Yellow fever certificate — the item that makes this checklist meaningfully different from
    // the other three countries in this tool.
    await goToSessionByLabel(page, 'Travel details');
    var travelText = await page.$eval('#checklistRoot', function(el){ return el.textContent; });
    assert.ok(/[Yy]ellow fever/.test(travelText), 'Travel details session should include the yellow fever vaccination certificate, got snippet: ' + travelText.slice(0, 200));
  } finally {
    await page.context().close();
  }

  // Regression check: adding the 4th country must not disturb switching between the existing ones.
  var page2 = await newPageAt(ctx.browser, '/index.html');
  try {
    await passConsentGate(page2, { country: 'UK' });
    var ukIndicatorText = await page2.$eval('#countryIndicator', function(el){ return el.textContent; });
    assert.ok(/UK Standard Visitor visa/i.test(ukIndicatorText), 'UK should still work unaffected, got: ' + ukIndicatorText);
  } finally {
    await page2.context().close();
  }
};
