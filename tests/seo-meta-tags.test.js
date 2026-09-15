'use strict';
// User request: "Description smooth application that would significantly boost the SEO and make
// this project easier to find on Google." Locks in the on-page SEO basics added to <head>: a
// keyword-first <title>/description (real UK visa checklist), a canonical URL, Open Graph + Twitter
// Card tags (so a shared link actually shows a preview card on WhatsApp/X - this product's own
// analytics show WhatsApp is the #1 real contact/share channel), and valid SoftwareApplication
// JSON-LD with no fabricated rating data (Google's structured-data policy treats a fake
// aggregateRating as a violation, not just something ignored).
const assert = require('assert');
const { newPageAt } = require('./helpers');

exports.run = async function(ctx){
  var page = await newPageAt(ctx.browser, '/index.html');
  try {
    var title = await page.title();
    assert.ok(/UK Visa Checklist/.test(title), 'Title should lead with the primary search keyword, got: "' + title + '"');
    assert.ok(/Nigerians/.test(title), 'Title should target Nigerians, got: "' + title + '"');
    assert.ok(/Smooth Application/.test(title), 'Title should still carry the brand name, got: "' + title + '"');
    assert.ok(title.length <= 65, 'Title should stay short enough to avoid Google truncating it, got ' + title.length + ' chars: "' + title + '"');

    var description = await page.$eval('meta[name="description"]', function(el){ return el.content; });
    assert.ok(description.length > 0 && description.length <= 160, 'Meta description should be non-empty and within Google\'s usual display length, got ' + description.length + ' chars: "' + description + '"');
    assert.ok(/UK visa/i.test(description), 'Meta description should mention the primary keyword, got: "' + description + '"');
    assert.ok(/bank statement/i.test(description), 'Meta description should mention the actual differentiator (bank statement checking), got: "' + description + '"');

    var canonical = await page.$eval('link[rel="canonical"]', function(el){ return el.href; });
    assert.strictEqual(canonical, 'https://smoothapplication.github.io/smooth-application/', 'Canonical URL should point at the real deployed URL, got: "' + canonical + '"');

    var og = await page.evaluate(function(){
      function metaContent(sel){ var el = document.querySelector(sel); return el ? el.content : null; }
      return {
        type: metaContent('meta[property="og:type"]'),
        title: metaContent('meta[property="og:title"]'),
        description: metaContent('meta[property="og:description"]'),
        image: metaContent('meta[property="og:image"]'),
        url: metaContent('meta[property="og:url"]'),
        twitterCard: metaContent('meta[name="twitter:card"]'),
        twitterImage: metaContent('meta[name="twitter:image"]')
      };
    });
    assert.strictEqual(og.type, 'website', 'og:type should be "website", got: ' + og.type);
    assert.ok(og.title && og.title.length > 0, 'og:title should be set');
    assert.ok(og.description && og.description.length > 0, 'og:description should be set');
    assert.ok(og.image && /^https:\/\//.test(og.image), 'og:image should be an absolute https URL (relative URLs break link previews on WhatsApp/X), got: ' + og.image);
    assert.ok(og.url && /^https:\/\//.test(og.url), 'og:url should be an absolute https URL, got: ' + og.url);
    assert.strictEqual(og.twitterCard, 'summary_large_image', 'twitter:card should be set, got: ' + og.twitterCard);
    assert.ok(og.twitterImage && /^https:\/\//.test(og.twitterImage), 'twitter:image should be an absolute https URL, got: ' + og.twitterImage);

    // Every currently-LIVE country should be named in the og:description (accuracy matters here - a
    // shared-link preview overclaiming a country that isn't actually supported would be misleading).
    ['Canada', 'Schengen', 'South Africa', 'Ghana', 'Kenya', 'Morocco', 'Ethiopia'].forEach(function(country){
      assert.ok(og.description.indexOf(country) !== -1, 'og:description should mention live country "' + country + '", got: "' + og.description + '"');
    });

    var jsonLd = await page.evaluate(function(){
      var el = document.querySelector('script[type="application/ld+json"]');
      return el ? JSON.parse(el.textContent) : null;
    });
    assert.ok(jsonLd, 'A JSON-LD structured-data script should be present and parse as valid JSON');
    assert.strictEqual(jsonLd['@type'], 'SoftwareApplication', 'JSON-LD @type should be SoftwareApplication, got: ' + (jsonLd && jsonLd['@type']));
    assert.strictEqual(jsonLd.name, 'Smooth Application', 'JSON-LD name should match the real product name');
    assert.ok(!('aggregateRating' in jsonLd), 'JSON-LD must NOT include a fabricated aggregateRating - no genuine review data exists yet');
    assert.ok(!('review' in jsonLd), 'JSON-LD must NOT include a fabricated review - no genuine review data exists yet');
    assert.strictEqual(jsonLd.offers && jsonLd.offers.price, '0', 'JSON-LD should state the app is free (price 0)');
  } finally {
    await page.context().close();
  }
};
