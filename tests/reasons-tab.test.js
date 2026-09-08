'use strict';
// User request: pull the "Why?" explanations (and a curated handful of purely-framing paragraphs,
// marked data-reason="1") out of the main flow entirely — see
// collectReasons()/renderReasonsModal()/initReasonsModal() in index.html. The same collected REASONS
// array now drives three surfaces: the original floating "Reasons" tab (everything, grouped), a
// dedicated "Reasons" session at the end of the normal flow (same content, as session 14 - see
// new-session-order.test.js), and a sidebar card that shows only the CURRENTLY OPEN session's own
// reasons ("session one, all the reasons there should go to a reason tab at the right side" - field
// feedback). Covers: the floating tab stays hidden until the main checklist (sessions 1-14) and only
// then becomes visible, opening/closing its modal, groups keyed by real session (not a rendered
// label - see reasonsGroupLabel()), the pre-consent quiz screen's own content still being collected
// and grouped under "Quiz" even while the tab itself is hidden, session 14 carrying the same content,
// and the sidebar card following the applicant from session to session.
const assert = require('assert');
const { newPageAt, passConsentGate, goToSessionByPill } = require('./helpers');

exports.run = async function(ctx){
  var page = await newPageAt(ctx.browser, '/index.html');
  try {
    // Field feedback: the floating tab should stay hidden until the main checklist (sessions 1-14 -
    // Passport through the dedicated Reasons session), not show on the landing/quiz screen — a few
    // lines with one CTA doesn't need floating chrome competing for attention. See
    // setReasonsTabVisible() in index.html.
    await page.waitForSelector('#quizIntro');
    var tabVisibleOnGate = await page.$eval('#reasonsTabBtn', function(el){ return getComputedStyle(el).display !== 'none'; });
    assert.strictEqual(tabVisibleOnGate, false, 'Reasons tab should stay hidden on the pre-consent quiz screen');

    var overlayHiddenInitially = await page.$eval('#reasonsModalOverlay', function(el){ return el.hidden; });
    assert.strictEqual(overlayHiddenInitially, true, 'Reasons modal should start closed');

    // The tab itself is hidden here, but collectReasons()/renderReasonsModal() already ran at page
    // load and populated the modal body regardless of the tab's own visibility — read it directly
    // rather than opening it via a click on a button that isn't shown yet.
    var htmlOnGate = await page.$eval('#reasonsModalBody', function(el){ return el.innerHTML; });
    // Landing screen's own FAQ ("What you need to know", merged from three separate questions per
    // field feedback) lives here too, grouped under "Quiz" specifically (it sits outside any
    // [data-session-key] card, but inside #quizGate) — collected into Reasons like every other
    // tip-details, even though (unlike the others) it ALSO stays inline; see data-keep-inline below.
    assert.ok(/reasons-group-title">Quiz</.test(htmlOnGate), 'Pre-session content should be grouped under "Quiz", got: ' + htmlOnGate.slice(0, 200));
    assert.ok(/What you need to know/.test(htmlOnGate), 'Landing FAQ question should be collected into Reasons, got: ' + htmlOnGate.slice(0, 300));

    // Field feedback reversed part of the original "sweep everything into Reasons" design for this
    // one specific toggle - it should still be sitting inline on the landing screen (marked
    // data-keep-inline), not removed like every other tip-details is.
    var faqStillOnPage = await page.$('.quiz-intro-faq details.tip-details[data-keep-inline]');
    assert.ok(faqStillOnPage, 'The landing "What you need to know" toggle should stay inline, not just live in the Reasons tab');

    // Proceed into the real app: the tab should become visible, and a real session's content should
    // show up grouped correctly — using the passport session's "Why?" tip on the full-name field as a
    // known example.
    await passConsentGate(page);
    var tabVisibleInApp = await page.$eval('#reasonsTabBtn', function(el){ return getComputedStyle(el).display !== 'none'; });
    assert.strictEqual(tabVisibleInApp, true, 'Reasons tab should become visible once inside the main checklist');
    await page.click('#reasonsTabBtn');
    await page.waitForSelector('#reasonsModalOverlay:not([hidden])');
    var htmlInApp = await page.$eval('#reasonsModalBody', function(el){ return el.innerHTML; });
    assert.ok(/Validate your International Passport/.test(htmlInApp), 'Passport session\'s reasons should be grouped under its real session title, got: ' + htmlInApp.slice(0, 300));
    assert.ok(/OCR isn't perfect/.test(htmlInApp), 'The full-name field\'s "Why?" explanation should be present in Reasons, got: ' + htmlInApp.slice(0, 500));

    // Passport-page paragraphs moved off the main flow per direct field feedback — the scan
    // instructions and the "it's ok to contact me" privacy notice — should now live in Reasons too.
    assert.ok(/Scan your passport's bio page below/.test(htmlInApp), 'Passport scan instructions should have moved into Reasons, got: ' + htmlInApp.slice(0, 800));
    assert.ok(/unless.*you tick the box above/.test(htmlInApp), 'Passport privacy/consent notice should have moved into Reasons, got: ' + htmlInApp.slice(0, 800));
    var scanInstructionsStillInline = await page.$eval('[data-session-key="passport"]', function(el){ return /Scan your passport's bio page below/.test(el.textContent); });
    assert.strictEqual(scanInstructionsStillInline, false, 'Scan instructions should no longer sit inline on the passport page itself');

    await page.keyboard.press('Escape');
    var overlayHiddenAfterEsc = await page.$eval('#reasonsModalOverlay', function(el){ return el.hidden; });
    assert.strictEqual(overlayHiddenAfterEsc, true, 'Escape should close the Reasons modal');

    // The count badge on the tab itself should reflect a real, non-zero number.
    var count = await page.$eval('#reasonsTabCount', function(el){ return parseInt(el.textContent, 10); });
    assert.ok(count > 20, 'Should have collected a meaningful number of reasons app-wide, got: ' + count);

    // Session 14 ("Reasons", last in the flow) carries the exact same content as the floating modal.
    var reasonsSessionIdx = 13; // 14th session, 0-indexed - see new-session-order.test.js
    await goToSessionByPill(page, reasonsSessionIdx);
    await page.waitForSelector('#reasonsSessionBody');
    var sessionHtml = await page.$eval('#reasonsSessionBody', function(el){ return el.innerHTML; });
    assert.ok(/Validate your International Passport/.test(sessionHtml), 'Session 14 should carry the passport session\'s reasons too, got: ' + sessionHtml.slice(0, 300));
    assert.ok(/reasons-group-title">Quiz</.test(sessionHtml), 'Session 14 should be broken down starting from "Quiz", got: ' + sessionHtml.slice(0, 200));

    // Sidebar card: only the currently-open session's own reasons, right next to "Still missing".
    // On session 14 itself there's nothing collected under the 'reasons' key, so it should be hidden.
    var sidebarHiddenOnReasonsSession = await page.$eval('#sidebarReasonsCard', function(el){ return getComputedStyle(el).display === 'none'; });
    assert.strictEqual(sidebarHiddenOnReasonsSession, true, 'Sidebar Reasons card should stay hidden on a session with nothing collected');

    await goToSessionByPill(page, 0); // back to the passport session
    await page.waitForFunction(function(){
      var el = document.getElementById('sidebarReasonsCard');
      return el && getComputedStyle(el).display !== 'none';
    }, { timeout: 3000 });
    var sidebarHtml = await page.$eval('#sidebarReasonsBody', function(el){ return el.innerHTML; });
    assert.ok(/OCR isn't perfect/.test(sidebarHtml), 'Sidebar should show the passport session\'s own reasons while it\'s open, got: ' + sidebarHtml.slice(0, 500));
    assert.ok(!/Travel Experience/.test(sidebarHtml), 'Sidebar should not show a group heading — it\'s already scoped to one session');

    await goToSessionByPill(page, 1); // travel experience — has its own reasons too
    await page.waitForFunction(function(){
      var body = document.getElementById('sidebarReasonsBody');
      return body && !/OCR isn't perfect/.test(body.innerHTML);
    }, { timeout: 3000 });
    var sidebarHtmlAfterNav = await page.$eval('#sidebarReasonsBody', function(el){ return el.innerHTML; });
    assert.ok(!/OCR isn't perfect/.test(sidebarHtmlAfterNav), 'Sidebar should have swapped away from the passport session\'s reasons');
  } finally {
    await page.context().close();
  }
};
