'use strict';
// Business request: "customers are asking we send the emails when they do not finish." Added optional
// email/phone fields on the passport session, plus an explicit opt-in checkbox (f_contactConsent) that
// forwards name+email+phone to the business's inbox via a Formspree form endpoint — but ONLY when that
// checkbox is ticked. This is the one deliberate exception to the app's "nothing leaves your browser"
// privacy promise, so it needs to actually be opt-in, not just claimed to be. This test intercepts the
// network request to Formspree to prove: (1) filling in email/phone with the consent box UNCHECKED
// never fires a request, and (2) checking the box DOES fire one, with the right fields in the body.
const assert = require('assert');
const { newPageAt, passConsentGate, goToSessionByPill } = require('./helpers');

exports.run = async function(ctx){
  var page = await newPageAt(ctx.browser, '/index.html');
  try {
    var requestBodies = [];
    await page.route('https://formspree.io/f/myegrvnq', function(route){
      requestBodies.push(JSON.parse(route.request().postData()));
      route.fulfill({ status: 200, contentType: 'application/json', body: '{"ok":true}' });
    });

    await passConsentGate(page);

    // f_name lives on the "Your trip details" session (index 3); f_email/f_phone/f_contactConsent
    // live on the passport session (index 0, open by default) — need to visit both.
    await goToSessionByPill(page, 3);
    await page.fill('#f_name', 'Adaeze Test Applicant');
    await goToSessionByPill(page, 0);
    await page.fill('#f_email', 'adaeze.test@example.com');
    await page.locator('#f_email').blur();
    await page.fill('#f_phone', '08012345678');
    await page.locator('#f_phone').blur();
    await page.waitForTimeout(300);

    assert.strictEqual(requestBodies.length, 0, 'No request should be sent to Formspree before the consent box is checked, got: ' + JSON.stringify(requestBodies));

    await page.check('#f_contactConsent');
    await page.waitForTimeout(300);

    assert.strictEqual(requestBodies.length, 1, 'Exactly one request should be sent to Formspree once consent is checked, got: ' + requestBodies.length);
    assert.strictEqual(requestBodies[0].email, 'adaeze.test@example.com', 'Submitted email should match what was typed, got: ' + JSON.stringify(requestBodies[0]));
    assert.strictEqual(requestBodies[0].phone, '08012345678', 'Submitted phone should match what was typed, got: ' + JSON.stringify(requestBodies[0]));
    assert.strictEqual(requestBodies[0].name, 'Adaeze Test Applicant', 'Submitted name should match what was typed, got: ' + JSON.stringify(requestBodies[0]));

    // Re-blurring with no actual change shouldn't send a duplicate submission.
    await page.locator('#f_email').focus();
    await page.locator('#f_email').blur();
    await page.waitForTimeout(300);
    assert.strictEqual(requestBodies.length, 1, 'Re-blurring with unchanged values should not send a duplicate request, got: ' + requestBodies.length);
  } finally {
    await page.context().close();
  }
};
