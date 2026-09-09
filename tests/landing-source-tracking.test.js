'use strict';
// Marketing/ad attribution: a link shared off-site (a Nairaland post, a WhatsApp broadcast, a paid
// ad) can carry ?src=<label> so that channel's traffic is countable as its own event on the
// analytics dashboard, separate from the plain per-path pageview count GoatCounter already logs.
// See trackLandingSource() in index.html for the full reasoning and the privacy note (event NAME
// only — never rendered as HTML or stored as free text).
const assert = require('assert');
const { PORT } = require('./helpers');

// trackLandingSource() fires during the page's own initial script execution, before any test code
// gets a chance to run — so the analytics stub has to be injected via addInitScript (runs before
// every script on the page, including the app's own inline one), not the usual post-load
// page.evaluate() stubbing pattern the rest of the suite uses for click-triggered events.
async function newStubbedPage(browser, query){
  var context = await browser.newContext();
  var page = await context.newPage();
  page.on('dialog', function(d){ d.accept(); });
  await page.addInitScript(function(){
    window.__trackedEvents = [];
    window.goatcounter = { count: function(o){ window.__trackedEvents.push(o.path); } };
  });
  await page.goto('http://127.0.0.1:' + PORT + '/index.html' + (query || ''));
  await page.waitForSelector('#quizIntro');
  return { context: context, page: page };
}

exports.run = async function(ctx){
  var ctxPage = await newStubbedPage(ctx.browser, '?src=nairaland-ad-aug2026');
  try {
    var tracked = await ctxPage.page.evaluate(function(){ return window.__trackedEvents.slice(); });
    assert.ok(tracked.indexOf('landing_src:nairaland-ad-aug2026') !== -1,
      'A ?src=<label> query param should be tracked as its own landing_src: event, got: ' + JSON.stringify(tracked));
  } finally {
    await ctxPage.context.close();
  }

  // A src value with punctuation/spaces/junk should be sanitized down to plain word characters
  // rather than either crashing or letting arbitrary query-string content reach the dashboard as-is.
  var ctxPage2 = await newStubbedPage(ctx.browser, '?src=' + encodeURIComponent('weird one! <b>x</b>'));
  try {
    var tracked2 = await ctxPage2.page.evaluate(function(){ return window.__trackedEvents.slice(); });
    var srcEvents = tracked2.filter(function(e){ return e.indexOf('landing_src:') === 0; });
    assert.strictEqual(srcEvents.length, 1, 'Should track exactly one sanitized landing_src event, got: ' + JSON.stringify(tracked2));
    assert.ok(/^landing_src:[a-zA-Z0-9_-]+$/.test(srcEvents[0]), 'Sanitized src event should only contain plain word characters, got: ' + srcEvents[0]);
  } finally {
    await ctxPage2.context.close();
  }

  // No ?src= at all: nothing landing_src-shaped should be tracked.
  var ctxPage3 = await newStubbedPage(ctx.browser, '');
  try {
    var tracked3 = await ctxPage3.page.evaluate(function(){ return window.__trackedEvents.slice(); });
    assert.ok(!tracked3.some(function(e){ return e.indexOf('landing_src:') === 0; }),
      'No src param should mean no landing_src event, got: ' + JSON.stringify(tracked3));
  } finally {
    await ctxPage3.context.close();
  }
};
