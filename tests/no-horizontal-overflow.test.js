'use strict';
// Regression test for the mobile-overflow bug class: a single long unbroken string anywhere deep
// in the page could silently force the whole layout (and the page) wider than the viewport on
// narrow phones. Checks that the document never scrolls horizontally at a spread of real-world
// breakpoints, both on the consent gate and inside the app.
const assert = require('assert');
const { newPageAt, passConsentGate, goToSessionByPill } = require('./helpers');

var VIEWPORTS = [
  { width: 320, height: 700, label: 'small phone (320px)' },
  { width: 375, height: 800, label: 'iPhone-class (375px)' },
  { width: 414, height: 850, label: 'large phone (414px)' },
  { width: 768, height: 1024, label: 'tablet (768px)' },
  { width: 1024, height: 800, label: 'small laptop (1024px)' }
];

function checkNoOverflow(page, label){
  return page.evaluate(function(){
    var doc = document.documentElement;
    return { scrollWidth: doc.scrollWidth, clientWidth: doc.clientWidth };
  }).then(function(sizes){
    // 1px tolerance for sub-pixel rounding.
    if (sizes.scrollWidth > sizes.clientWidth + 1){
      throw new Error(label + ': horizontal overflow — scrollWidth ' + sizes.scrollWidth + ' > clientWidth ' + sizes.clientWidth);
    }
  });
}

exports.run = async function(ctx){
  for (var i = 0; i < VIEWPORTS.length; i++){
    var vp = VIEWPORTS[i];
    var page = await newPageAt(ctx.browser, '/index.html', { viewport: { width: vp.width, height: vp.height } });
    try {
      await checkNoOverflow(page, vp.label + ' — consent gate');
      await passConsentGate(page);
      await checkNoOverflow(page, vp.label + ' — trip session');
      await goToSessionByPill(page, 4);
      await checkNoOverflow(page, vp.label + ' — finance session');
    } finally {
      await page.context().close();
    }
  }
};
