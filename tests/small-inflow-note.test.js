'use strict';
// User instruction: "Reason we flag inflows lower than N50,000 is because N50,000 is less than 30
// pounds. The visa needs to see consistent quality inflows above N50,000." Clarified via follow-up
// question that this should be a purely informational note - an inflow under N50,000 still counts
// exactly as before (no change to any scoring), it just carries a small label explaining that a
// reviewer is unlikely to weigh it as meaningful income evidence on its own. Covers both places a
// single inflow's date/amount/narration line is rendered: the "needs an explanation" list
// (inflowPreviewLine) and the itemized matched-income lists (inflowMatchPreviewLine).
const assert = require('assert');
const { newPageAt, passConsentGate } = require('./helpers');

exports.run = async function(ctx){
  var page = await newPageAt(ctx.browser, '/index.html');
  try {
    await passConsentGate(page);

    var below = await page.evaluate(function(){ return window.__testInflowPreviewLines(45000, 'SOME TRANSFER'); });
    assert.ok(/below.*50,000/i.test(below.plain), 'A sub-N50,000 inflow should carry the "below N50,000" note in the plain preview line, got: ' + below.plain);
    assert.ok(/below.*50,000/i.test(below.matched), 'A sub-N50,000 inflow should carry the "below N50,000" note in the matched preview line, got: ' + below.matched);
    assert.ok(/£30/.test(below.plain), 'The note should explain the N50,000/£30 comparison, got: ' + below.plain);

    var atFloor = await page.evaluate(function(){ return window.__testInflowPreviewLines(50000, 'SOME TRANSFER'); });
    assert.ok(!/below.*50,000/i.test(atFloor.plain), 'An inflow AT exactly N50,000 should NOT carry the note, got: ' + atFloor.plain);
    assert.ok(!/below.*50,000/i.test(atFloor.matched), 'An inflow AT exactly N50,000 should NOT carry the note (matched line), got: ' + atFloor.matched);

    var above = await page.evaluate(function(){ return window.__testInflowPreviewLines(500000, 'SOME TRANSFER'); });
    assert.ok(!/below.*50,000/i.test(above.plain), 'A well-above-floor inflow should NOT carry the note, got: ' + above.plain);
    assert.ok(!/below.*50,000/i.test(above.matched), 'A well-above-floor inflow should NOT carry the note (matched line), got: ' + above.matched);

    // The narration/amount themselves must still be shown in full - this is additive, not a replacement.
    assert.ok(/45,000/.test(below.plain), 'The amount should still be shown alongside the note, got: ' + below.plain);
    assert.ok(/SOME TRANSFER/.test(below.plain), 'The narration should still be shown alongside the note, got: ' + below.plain);
  } finally {
    await page.context().close();
  }
};
