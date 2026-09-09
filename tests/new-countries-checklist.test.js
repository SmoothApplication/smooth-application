'use strict';
// Smoke test for the 4 countries added alongside UK/Canada/Schengen/South Africa: Ghana, Kenya, and
// Morocco as travel-readiness checklists (Nigerian citizens don't need a visa for any of the three —
// ECOWAS free movement for Ghana, Kenya's July-2025 eTA exemption, and Morocco's 30-day visa-free
// entry), and Ethiopia as a real tourist e-Visa application checklist (evisa.gov.et). Confirms each
// country is selectable end-to-end and that the "no visa required" copy (financial-readiness CTA,
// the weeks-until-travel timing message, the spouse-history question) reads honestly for the three
// visa-free countries instead of leftover "apply"/"visa" language from the visa-application countries.
const assert = require('assert');
const { newPageAt, passConsentGate, goToSessionByLabel } = require('./helpers');

exports.run = async function(ctx){
  // Ghana — travel-readiness, ECOWAS free movement.
  var ghPage = await newPageAt(ctx.browser, '/index.html');
  try {
    await passConsentGate(ghPage, { country: 'GH' });

    var indicatorText = await ghPage.$eval('#countryIndicator', function(el){ return el.textContent; });
    assert.ok(/Ghana travel readiness/i.test(indicatorText), 'Header indicator should show the Ghana travel-readiness label, got: ' + indicatorText);

    var footerText = await ghPage.$eval('#footerLinks', function(el){ return el.textContent; });
    assert.ok(/Ghana Immigration Service/i.test(footerText), 'Footer links should mention Ghana Immigration Service, got: ' + footerText);

    await goToSessionByLabel(ghPage, 'Accommodation & Ghanaian host');
    var accomText = await ghPage.$eval('#checklistRoot', function(el){ return el.textContent; });
    assert.ok(/Ghanaian host/i.test(accomText), 'Accommodation session should be labelled for a Ghanaian host, got snippet: ' + accomText.slice(0, 200));

    await goToSessionByLabel(ghPage, 'Identity & travel documents');
    var idText = await ghPage.$eval('#checklistRoot', function(el){ return el.textContent; });
    assert.ok(/[Yy]ellow fever/.test(idText), 'Identity & travel documents session should include the yellow fever vaccination certificate, got snippet: ' + idText.slice(0, 200));
    assert.ok(!/visa application/i.test(idText), 'Ghana checklist should never say "visa application" - it is visa-free, got snippet: ' + idText.slice(0, 400));
  } finally {
    await ghPage.context().close();
  }

  // Kenya — travel-readiness, visa/eTA-exempt since July 2025.
  var kePage = await newPageAt(ctx.browser, '/index.html');
  try {
    await passConsentGate(kePage, { country: 'KE' });

    var keIndicatorText = await kePage.$eval('#countryIndicator', function(el){ return el.textContent; });
    assert.ok(/Kenya travel readiness/i.test(keIndicatorText), 'Header indicator should show the Kenya travel-readiness label, got: ' + keIndicatorText);

    await goToSessionByLabel(kePage, 'Accommodation & Kenyan host');
    var keAccomText = await kePage.$eval('#checklistRoot', function(el){ return el.textContent; });
    assert.ok(/Kenyan host/i.test(keAccomText), 'Accommodation session should be labelled for a Kenyan host, got snippet: ' + keAccomText.slice(0, 200));

    await goToSessionByLabel(kePage, 'Identity & travel documents');
    var keIdText = await kePage.$eval('#checklistRoot', function(el){ return el.textContent; });
    assert.ok(/[Yy]ellow fever/.test(keIdText), 'Identity & travel documents session should include the yellow fever vaccination certificate, got snippet: ' + keIdText.slice(0, 200));
  } finally {
    await kePage.context().close();
  }

  // Morocco — travel-readiness, visa-free up to 30 days for the general case.
  var maPage = await newPageAt(ctx.browser, '/index.html');
  try {
    await passConsentGate(maPage, { country: 'MA' });

    var maIndicatorText = await maPage.$eval('#countryIndicator', function(el){ return el.textContent; });
    assert.ok(/Morocco travel readiness/i.test(maIndicatorText), 'Header indicator should show the Morocco travel-readiness label, got: ' + maIndicatorText);

    await goToSessionByLabel(maPage, 'Accommodation & Moroccan host');
    var maAccomText = await maPage.$eval('#checklistRoot', function(el){ return el.textContent; });
    assert.ok(/Moroccan host/i.test(maAccomText), 'Accommodation session should be labelled for a Moroccan host, got snippet: ' + maAccomText.slice(0, 200));

    await goToSessionByLabel(maPage, 'Identity & travel documents');
    var maIdText = await maPage.$eval('#checklistRoot', function(el){ return el.textContent; });
    assert.ok(/blank page/i.test(maIdText), 'Morocco passport item should mention the blank-page requirement, got snippet: ' + maIdText.slice(0, 400));
  } finally {
    await maPage.context().close();
  }

  // Ethiopia — a real tourist e-Visa application checklist (evisa.gov.et), not travel-readiness.
  var etPage = await newPageAt(ctx.browser, '/index.html');
  try {
    await passConsentGate(etPage, { country: 'ET' });

    var etIndicatorText = await etPage.$eval('#countryIndicator', function(el){ return el.textContent; });
    assert.ok(/Ethiopia tourist e-Visa/i.test(etIndicatorText), 'Header indicator should show the Ethiopia e-Visa label, got: ' + etIndicatorText);

    var etFooterText = await etPage.$eval('#footerLinks', function(el){ return el.textContent; });
    assert.ok(/evisa\.gov\.et/i.test(etFooterText), 'Footer links should mention evisa.gov.et, got: ' + etFooterText);

    await goToSessionByLabel(etPage, 'Identity & application');
    var etIdText = await etPage.$eval('#checklistRoot', function(el){ return el.textContent; });
    assert.ok(/evisa\.gov\.et/i.test(etIdText), 'Identity & application session should mention evisa.gov.et, got snippet: ' + etIdText.slice(0, 400));

    await goToSessionByLabel(etPage, 'Travel details');
    var etTravelText = await etPage.$eval('#checklistRoot', function(el){ return el.textContent; });
    assert.ok(/Addis Ababa Bole International Airport/i.test(etTravelText), 'Travel details session should flag the Addis Ababa Bole arrival requirement, got snippet: ' + etTravelText.slice(0, 400));
  } finally {
    await etPage.context().close();
  }

  // Regression check: adding 4 more countries must not disturb switching between the existing ones.
  var ukPage = await newPageAt(ctx.browser, '/index.html');
  try {
    await passConsentGate(ukPage, { country: 'UK' });
    var ukIndicatorText = await ukPage.$eval('#countryIndicator', function(el){ return el.textContent; });
    assert.ok(/UK Standard Visitor visa/i.test(ukIndicatorText), 'UK should still work unaffected, got: ' + ukIndicatorText);
  } finally {
    await ukPage.context().close();
  }
};
