'use strict';
// Session 1 ("Validate your International Passport") shows a Congratulations/warning message based
// on the expiry date typed (or scanned) in — checked against 6 months from TODAY, not the trip's
// travel date, since at this point in the flow the applicant hasn't reached the trip-details session
// yet (see updatePassportValidateStatus in index.html).
const assert = require('assert');
const { newPageAt, passConsentGate } = require('./helpers');

function isoDate(d){
  return d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0') + '-' + String(d.getDate()).padStart(2,'0');
}

exports.run = async function(ctx){
  var page = await newPageAt(ctx.browser, '/index.html');
  try {
    await passConsentGate(page);
    // Session 1 is the default first session — no navigation needed.
    await page.waitForSelector('#f_passportExpiry');

    // Nothing typed yet — no status message either way.
    var statusEmpty = await page.$eval('#passportValidateStatus', function(el){ return el.innerHTML.trim(); });
    assert.strictEqual(statusEmpty, '', 'Should show no status message before an expiry date is entered');

    // A date well over 6 months out -> Congratulations.
    var farFuture = new Date(); farFuture.setMonth(farFuture.getMonth() + 18);
    await page.fill('#f_passportExpiry', isoDate(farFuture));
    await page.dispatchEvent('#f_passportExpiry', 'change');
    await page.waitForFunction(function(){
      var el = document.getElementById('passportValidateStatus');
      return el && /Congratulations/.test(el.textContent);
    }, { timeout: 3000 });
    var okCls = await page.$eval('#passportValidateStatus .scan-msg', function(el){ return el.className; });
    assert.ok(/\bok\b/.test(okCls), 'Congratulations message should use the "ok" scan-msg style, got: ' + okCls);

    // A date just 1 month out -> warning, not expired wording.
    var soonExpiry = new Date(); soonExpiry.setMonth(soonExpiry.getMonth() + 1);
    await page.fill('#f_passportExpiry', isoDate(soonExpiry));
    await page.dispatchEvent('#f_passportExpiry', 'change');
    await page.waitForFunction(function(){
      var el = document.getElementById('passportValidateStatus');
      return el && /validity remaining/.test(el.textContent);
    }, { timeout: 3000 });
    var warnCls = await page.$eval('#passportValidateStatus .scan-msg', function(el){ return el.className; });
    assert.ok(/\bwarn\b/.test(warnCls), 'Low-validity message should use the "warn" scan-msg style, got: ' + warnCls);

    // A date in the past -> expired wording specifically.
    var past = new Date(); past.setMonth(past.getMonth() - 2);
    await page.fill('#f_passportExpiry', isoDate(past));
    await page.dispatchEvent('#f_passportExpiry', 'change');
    await page.waitForFunction(function(){
      var el = document.getElementById('passportValidateStatus');
      return el && /has expired/.test(el.textContent);
    }, { timeout: 3000 });

    // Typing a passport number should never get silently overwritten by a later render() pass.
    await page.fill('#f_passportNumber', 'A1234567');
    await page.dispatchEvent('#f_passportNumber', 'change');
    var pnVal = await page.$eval('#f_passportNumber', function(el){ return el.value; });
    assert.strictEqual(pnVal, 'A1234567', 'Manually typed passport number should be kept as-is');
  } finally {
    await page.context().close();
  }
};
