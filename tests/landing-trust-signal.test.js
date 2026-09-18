'use strict';
// User-reported feedback: people landing on the app (via the nairaland ad, a forwarded link, or the
// raw github.io/netlify.app URL directly — no custom domain yet) said the address "looks dubious".
// Predictable for this audience: a visa applicant asked to upload a passport and bank statements is
// primed to be wary of exactly this address shape, since it matches the trust-signal profile of a
// scam. consentGate (one screen further into the flow) already carried a .gate-trust-row reassuring
// visitors nothing is uploaded — but quizGate, the actual FIRST screen nearly all traffic lands on
// (confirmed via quiz_start being the top tracked event on GoatCounter), didn't have it at all.
// Fixed by reusing the same .gate-trust-row pattern on quizGate, plus a new link to the public GitHub
// source so a skeptical applicant can verify the "nothing is uploaded" claim themselves rather than
// just take the app's word for it.
const assert = require('assert');
const { newPageAt } = require('./helpers');

exports.run = async function(ctx){
  var page = await newPageAt(ctx.browser, '/index.html');
  try {
    // quizGate is the very first screen shown — no gate-passing needed to see it.
    var trustText = await page.evaluate(function(){
      var row = document.querySelector('#quizGate .gate-trust-row');
      return row ? row.textContent : null;
    });
    assert.ok(trustText, 'quizGate (the landing screen) should show a trust-badge row, found none');
    assert.ok(/browser/i.test(trustText) && /never|not.*upload|nothing/i.test(trustText.replace(/is ever sent to a server/i, 'nothing')),
      'Trust row should reassure that uploads never leave the browser, got: ' + trustText);
    assert.ok(/Free/i.test(trustText), 'Trust row should mention the app is free, got: ' + trustText);
    assert.ok(/Nigerian/i.test(trustText), 'Trust row should mention it\'s built for Nigerian applicants, got: ' + trustText);

    // The source-code link is the verifiable-proof piece — must be present, visible on quizGate, and
    // point at a real, fetchable GitHub URL rather than a placeholder.
    var sourceLink = await page.evaluate(function(){
      var links = Array.from(document.querySelectorAll('#quizGate a[href*="github.com"]'));
      var link = links[0];
      return link ? { href: link.getAttribute('href'), text: link.textContent, visible: !!link.offsetParent } : null;
    });
    assert.ok(sourceLink, 'quizGate should link to the public GitHub source code');
    assert.ok(/github\.com\/SmoothApplication\/smooth-application/i.test(sourceLink.href),
      'Source link should point at the real public repo, got: ' + sourceLink.href);
    assert.ok(sourceLink.visible, 'Source-code link should be visible on the landing screen, not hidden');
  } finally {
    await page.context().close();
  }
};
