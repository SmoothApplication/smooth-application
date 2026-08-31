'use strict';
// Direct feedback from an in-person street test with UNILAG students: several who worked through
// the checklist and hit the financial-readiness reality check (see
// financial-timing-reality-check.test.js) asked whether the platform could also point them toward a
// way to travel WITHOUT needing that much money — internships, paid exchange programs, scholarships.
// This tests the resulting "Funded opportunities & exchange programs" directory: a new, always-visible
// session (unlike bizLedger, it isn't conditional on anything the applicant has entered) listing 10
// hand-verified real programs, each tagged with a `pathway` describing what it actually requires
// (semester exchange while staying enrolled at home vs. a full new degree vs. postgrad-only vs. a
// paid program with real fees) — and a prominent scam warning, since "opportunities for students who
// can't afford to travel" is exactly the kind of promise scammers imitate.
const assert = require('assert');
const { newPageAt, passConsentGate, goToSessionByLabel } = require('./helpers');

exports.run = async function(ctx){
  var page = await newPageAt(ctx.browser, '/index.html');
  try {
    await passConsentGate(page);
    await goToSessionByLabel(page, 'Funded opportunities');
    await page.waitForSelector('#opportunitiesCard');

    // The scam warning is the single most important line on this card — must be visible without
    // any interaction, not tucked behind a "Why?" toggle like the purely explanatory tips elsewhere.
    var cardText = await page.$eval('#opportunitiesCard', function(el){ return el.textContent; });
    assert.ok(/never asks you to pay/i.test(cardText), 'Scam warning should state a genuine program never asks for payment, got: ' + cardText.slice(0, 400));
    assert.ok(/Watch for scams/i.test(cardText), 'Scam warning heading should be present');

    // All 10 programs shown by default, each with its pathway badge, and the "last checked" date.
    var allCount = await page.$$eval('.opp-card', function(els){ return els.length; });
    assert.strictEqual(allCount, 10, 'Should list all 10 curated programs by default');
    var verifiedText = await page.$eval('#oppLastVerified', function(el){ return el.textContent; });
    assert.ok(verifiedText.length > 0, 'Should show a non-empty "last checked" date');

    // Filtering by pathway narrows the list — semester-exchange should show only Global UGRAD (the
    // one program in this dataset that lets a current undergraduate go abroad short-term while
    // remaining enrolled at home), not the full-degree or postgrad-only programs.
    var semesterBtn = await page.$('.opp-filter-btn[data-pathway="semester-exchange"]');
    assert.ok(semesterBtn, 'A "semester exchange" filter button should exist');
    await semesterBtn.click();
    await page.waitForTimeout(50);
    var filteredNames = await page.$$eval('.opp-card h3', function(els){ return els.map(function(e){ return e.textContent; }); });
    assert.deepStrictEqual(filteredNames, ['Global UGRAD (Global Undergraduate Exchange Program)'],
      'Filtering to "semester exchange" should show only Global UGRAD, got: ' + JSON.stringify(filteredNames));
    var activeBtnText = await page.$eval('.opp-filter-btn.active', function(el){ return el.textContent; });
    assert.ok(/Semester exchange/.test(activeBtnText), 'The clicked filter button should become active');

    // The postgrad-only filter should include Chevening, and should NOT include Global UGRAD.
    var postgradBtn = await page.$('.opp-filter-btn[data-pathway="postgrad-only"]');
    await postgradBtn.click();
    await page.waitForTimeout(50);
    var postgradNames = await page.$$eval('.opp-card h3', function(els){ return els.map(function(e){ return e.textContent; }); });
    assert.ok(postgradNames.indexOf('Chevening Scholarship (UK)') !== -1, 'Postgrad-only filter should include Chevening, got: ' + JSON.stringify(postgradNames));
    assert.ok(postgradNames.indexOf('Global UGRAD (Global Undergraduate Exchange Program)') === -1, 'Postgrad-only filter should NOT include Global UGRAD');

    // Switching back to "All" restores every program.
    var allBtn = await page.$('.opp-filter-btn[data-pathway="all"]');
    await allBtn.click();
    await page.waitForTimeout(50);
    var restoredCount = await page.$$eval('.opp-card', function(els){ return els.length; });
    assert.strictEqual(restoredCount, 10, 'Clicking "All" should restore every program');

    // Official links point at the program's own site, open in a new tab, and don't leak a referrer.
    var ugradLink = await page.$eval('#opp_global-ugrad .opp-link', function(el){
      return { href: el.getAttribute('href'), target: el.getAttribute('target'), rel: el.getAttribute('rel') };
    });
    assert.strictEqual(ugradLink.href, 'https://exchanges.state.gov/non-us/program/global-undergraduate-exchange-program-global-ugrad');
    assert.strictEqual(ugradLink.target, '_blank');
    assert.ok(/noopener/.test(ugradLink.rel) && /noreferrer/.test(ugradLink.rel), 'Official links should carry rel="noopener noreferrer"');

    // Every program in the dataset gets a working official link — not just the one checked above.
    var allLinksOk = await page.$$eval('.opp-card .opp-link', function(els){
      return els.every(function(a){ return /^https:\/\//.test(a.getAttribute('href') || ''); });
    });
    assert.ok(allLinksOk, 'Every program card should have an https:// official link');
  } finally {
    await page.context().close();
  }
};
