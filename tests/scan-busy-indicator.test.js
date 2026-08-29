'use strict';
// Regression test for the "scan looks frozen on a slow phone" fix: document-scanning messages that
// represent active work (loading the OCR/PDF libraries, reading a file) now render with a distinct
// 'busy' status — a small spinning indicator via CSS animation — instead of the static 'info' icon
// used for messages that are just informational. Verifies the class wiring end-to-end rather than
// triggering a real OCR pass (which would need actual file I/O and CDN access, and is already
// exercised informally by manual testing) — it's the class/CSS contract that matters here, not the
// OCR pipeline itself.
const assert = require('assert');
const { newPageAt, passConsentGate } = require('./helpers');

exports.run = async function(ctx){
  var page = await newPageAt(ctx.browser, '/index.html');
  try {
    await passConsentGate(page, { country: 'UK' });
    await page.waitForSelector('#passportValidateResult');

    // A 'busy' message renders with the busy class (spinner) rather than the static 'info' one.
    await page.evaluate(function(){ window.__testSetScanMsg('passport', 'busy', 'Reading image… this can take up to 30 seconds.'); });
    var busyEl = await page.$('#passportValidateResult .scan-msg.busy');
    assert.ok(busyEl, 'A busy-status scan message should render with the .busy class');
    var busyIsInfo = await page.$('#passportValidateResult .scan-msg.info');
    assert.strictEqual(busyIsInfo, null, 'A busy message should not also carry the static .info class');

    // The spinner is a real, currently-running CSS animation (not just a class name with no effect),
    // confirming the animation actually wired up rather than being dead CSS.
    var animationName = await page.$eval('#passportValidateResult .scan-msg.busy', function(el){
      return getComputedStyle(el, '::before').animationName;
    });
    assert.strictEqual(animationName, 'scan-spin', 'busy::before should be running the scan-spin animation, got: ' + animationName);

    // A genuinely-static informational message (e.g. "couldn't read this") should still render with
    // the original, non-animated 'info' styling — this fix must not have swallowed that case too.
    await page.evaluate(function(){ window.__testSetScanMsg('passport', 'info', "Couldn't extract readable text — try a clearer scan."); });
    var infoEl = await page.$('#passportValidateResult .scan-msg.info');
    assert.ok(infoEl, 'A genuinely static info message should still render with the .info class');
    var infoAnimationName = await page.$eval('#passportValidateResult .scan-msg.info', function(el){
      return getComputedStyle(el, '::before').animationName;
    });
    assert.strictEqual(infoAnimationName, 'none', 'A static .info message should not be animated, got: ' + infoAnimationName);
  } finally {
    await page.context().close();
  }
};
