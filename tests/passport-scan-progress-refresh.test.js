'use strict';
// User report: scanned a passport, saw the passport number/expiry boxes fill in correctly and the
// Congratulations message show — but the "X% of this section filled" footer stayed stuck at "0 of
// 2". renderPassportCard() deliberately avoids a full render() when auto-filling those two fields
// (a full render() rebuilds #checklistRoot, which would orphan the scan-result box mid-function —
// see the comment there), but that also meant the session-nav/footer progress text never refreshed
// on its own until some unrelated input elsewhere triggered a render(). Fixed by also calling
// applySessionVisibility() right after the auto-fill (safe: it re-renders the nav/footer but never
// touches #checklistRoot).
//
// Important: this has to exercise the REAL auto-fill path (renderPassportCard sets .value directly,
// without dispatching input/change events) — manually setting the fields and dispatching events
// would trigger the generic field-list render() wiring and mask the exact bug that shipped.
const assert = require('assert');
const path = require('path');
const { newPageAt, passConsentGate } = require('./helpers');

// A real, OCR-readable passport fixture (used elsewhere for MRZ digit-recovery tests) — needed
// here specifically because it produces a genuine parsed passport number + expiry date, unlike the
// synthetic placeholder image used by passport-repetition-collapse (which only exercises the
// attach/collapse UI, not real OCR output).
var REAL_MRZ_FIXTURE = path.join(__dirname, 'fixtures', 'dob-digit-misread-fixture.pdf');

async function readFooter(page){
  return page.evaluate(function(){
    var m = document.body.innerText.match(/(\d+)% of this section filled \((\d+) of (\d+)\)/);
    return m ? { pct: m[1], points: m[2], total: m[3] } : null;
  });
}

exports.run = async function(ctx){
  var page = await newPageAt(ctx.browser, '/index.html');
  try {
    await passConsentGate(page);
    // Passport is its own session again (index 0, the default landing session — no navigation
    // needed), with just its own 2 fields (f_passportNumber, f_passportExpiry) counted toward its
    // footer — no other card's fields factor in any more, which actually simplifies isolating
    // exactly what this test is about: does the footer refresh from the passport auto-fill alone,
    // without any other field being touched afterward.
    await page.waitForSelector('#file_passportValidate');
    await page.waitForTimeout(200);

    var before = await readFooter(page);
    assert.ok(before, 'Should show a "X% of this section filled" footer before scanning');
    assert.strictEqual(before.points, '0', 'Should read 0 filled before scanning, got: ' + JSON.stringify(before));
    assert.strictEqual(before.pct, '0', 'Should read 0% before scanning, got: ' + JSON.stringify(before));

    await page.setInputFiles('#file_passportValidate', REAL_MRZ_FIXTURE);
    await page.click('#btnPassportValidateAttach');
    await page.waitForFunction(function(){
      var el = document.getElementById('passportValidateResult');
      return el && el.innerHTML.indexOf('passport-card') !== -1;
    }, { timeout: 20000 });
    await page.waitForTimeout(300);

    var pn = await page.$eval('#f_passportNumber', function(el){ return el.value; });
    var exp = await page.$eval('#f_passportExpiry', function(el){ return el.value; });
    assert.ok(pn, 'Passport number should have been auto-filled from the scan');
    assert.ok(exp, 'Expiry date should have been auto-filled from the scan');

    // The whole point: check the footer WITHOUT touching any other field first.
    var after = await readFooter(page);
    assert.ok(after, 'Should still show a footer after scanning');
    assert.strictEqual(after.points, '2', 'Footer should reflect the 2 auto-filled passport fields, without any other input first, got: ' + JSON.stringify(after));
    assert.strictEqual(after.pct, '100', 'Should read 100% once both passport fields are filled, got: ' + JSON.stringify(after));
  } finally {
    await page.context().close();
  }
};
