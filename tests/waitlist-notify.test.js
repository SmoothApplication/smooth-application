'use strict';
// Regression test for the freemium-feature waitlist - the cheapest demand-signal test from
// docs/monetization-strategy.md §1 ("How to test cheaply first"): before building automatic
// reminders, an emailed report, or live flight pricing, a simple "Notify me when this ships" link
// in the "Save your progress" sidebar tells us whether real demand exists. Same zero-backend
// pattern already used by quizNotifyWhatsApp (see confidence-quiz.test.js) - WhatsApp/mailto links
// only, no email input field, no third-party form service - so this covers: the links start
// pointing at the default-selected feature, changing the dropdown updates both links to the newly
// selected feature, and clicking either one records a waitlist_notify_clicked:<feature>:<channel>
// event (the actual demand signal this whole feature exists to produce).
const assert = require('assert');
const { newPageAt, passConsentGate } = require('./helpers');

exports.run = async function(ctx){
  var page = await newPageAt(ctx.browser, '/index.html');
  try {
    await passConsentGate(page);
    await page.waitForSelector('#waitlistFeature', { state: 'attached' });

    // Default selection ("reminders") should already be baked into both links before any interaction.
    var initialHrefs = await page.evaluate(function(){
      return {
        wa: document.getElementById('waitlistWhatsApp').getAttribute('href'),
        email: document.getElementById('waitlistEmail').getAttribute('href')
      };
    });
    assert.ok(/deadline/.test(decodeURIComponent(initialHrefs.wa)), 'Default WhatsApp link should mention reminders/deadline, got: ' + initialHrefs.wa);
    assert.ok(/wa\.me\/2349081389969/.test(initialHrefs.wa), 'WhatsApp link should point at the founder\'s WhatsApp number, got: ' + initialHrefs.wa);
    assert.ok(/^mailto:lalasionline@gmail\.com/.test(initialHrefs.email), 'Email link should point at the founder\'s email, got: ' + initialHrefs.email);

    // Switching the feature dropdown should update both links to reflect the new choice.
    await page.selectOption('#waitlistFeature', 'emailed_report');
    var updatedHrefs = await page.evaluate(function(){
      return {
        wa: document.getElementById('waitlistWhatsApp').getAttribute('href'),
        email: document.getElementById('waitlistEmail').getAttribute('href')
      };
    });
    assert.ok(/one-tap emailed report/.test(decodeURIComponent(updatedHrefs.wa)), 'WhatsApp link should update to mention the emailed report after switching the dropdown, got: ' + updatedHrefs.wa);
    assert.ok(/Notify%20me%3A%20emailed_report/.test(updatedHrefs.email), 'Email subject should reflect the newly selected feature, got: ' + updatedHrefs.email);

    // Stub analytics so waitlist_notify_clicked:* events can be observed. Dispatches a synthetic
    // click rather than page.click() — same reasoning as confidence-quiz.test.js's WhatsApp-link
    // check: a genuine click on these real <a href> links would try to actually open WhatsApp/mail,
    // which a synthetic click avoids while still firing the tracking listener.
    await page.evaluate(function(){
      window.__trackedEvents = [];
      window.goatcounter = { count: function(o){ window.__trackedEvents.push(o.path); } };
      document.getElementById('waitlistWhatsApp').dispatchEvent(new MouseEvent('click', {bubbles:true, cancelable:true}));
      document.getElementById('waitlistEmail').dispatchEvent(new MouseEvent('click', {bubbles:true, cancelable:true}));
    });
    var tracked = await page.evaluate(function(){ return window.__trackedEvents.slice(); });
    assert.ok(tracked.indexOf('waitlist_notify_clicked:emailed_report:whatsapp') !== -1,
      'Clicking the WhatsApp notify link should record waitlist_notify_clicked:emailed_report:whatsapp, got: ' + JSON.stringify(tracked));
    assert.ok(tracked.indexOf('waitlist_notify_clicked:emailed_report:email') !== -1,
      'Clicking the email notify link should record waitlist_notify_clicked:emailed_report:email, got: ' + JSON.stringify(tracked));
  } finally {
    await page.context().close();
  }
};
