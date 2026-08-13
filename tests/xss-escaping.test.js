'use strict';
// Regression test for the XSS audit: user-typed text that gets echoed back into an innerHTML
// string (here, the "Shopping place" field, rendered into the financial-readiness breakdown) must
// come out as literal, inert text — never as a real element the browser parses and executes.
const assert = require('assert');
const { newPageAt, passConsentGate, goToSessionByPill } = require('./helpers');

var PAYLOAD = '<img src=x onerror="window.__xssFired = true">';

exports.run = async function(ctx){
  var page = await newPageAt(ctx.browser, '/index.html');
  try {
    await passConsentGate(page);
    await goToSessionByPill(page, 1); // finance session

    // Any one non-zero cost field is enough to make the breakdown render.
    await page.fill('#fc_closing', '3000000');

    // fc_shoppingPlace sits inside a collapsed <details>"Shopping & sightseeing estimate" panel —
    // open it before trying to interact with the field inside.
    await page.evaluate(function(){
      document.getElementById('fc_shoppingPlace').closest('details').open = true;
    });
    await page.fill('#fc_shoppingPlace', PAYLOAD);
    // fc_shoppingPlace only fires on 'input' — nudge it explicitly in case fill() alone doesn't
    // trigger the app's listener in some Playwright/browser combination.
    await page.dispatchEvent('#fc_shoppingPlace', 'input');

    await page.waitForFunction(function(){
      var el = document.getElementById('finSummary');
      return el && el.textContent.indexOf('Shopping') !== -1;
    }, { timeout: 3000 });

    var xssFired = await page.evaluate(function(){ return window.__xssFired === true; });
    assert.strictEqual(xssFired, false, 'onerror handler in the injected payload must never execute');

    var imgElementExists = await page.$eval('#finSummary', function(el){ return !!el.querySelector('img'); });
    assert.strictEqual(imgElementExists, false, 'The payload must not be parsed into a real <img> element');

    var rawHtml = await page.$eval('#finSummary', function(el){ return el.innerHTML; });
    assert.ok(rawHtml.indexOf('&lt;img') !== -1, 'The payload should appear HTML-escaped (as &lt;img...) in the rendered markup');
    assert.ok(rawHtml.indexOf('<img src=x') === -1, 'The payload must not appear as a live, unescaped <img> tag');
  } finally {
    await page.context().close();
  }
};
