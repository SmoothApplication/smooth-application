'use strict';
// User-reported bug (live site, real device): the "Your responsibilities" card's "Annual rent (₦)"
// field displayed "Seyi Afeni" (a person's name) instead of a number, and "Monthly upkeep / feeding
// (₦)" showed "17" (matching the unrelated "House/street number" field). Neither was a code path the
// app itself writes to — every collection/restore/reset function in index.html reads and writes each
// rs_* field by its own distinct id, with no positional or cross-field mixing anywhere. The actual
// cause: none of this card's free-text inputs (spouse/parent names, address, rent, upkeep, school fee,
// remittance) set an `autocomplete` attribute, unlike f_email/f_phone elsewhere which deliberately do.
// Left unset, Chrome's address/name-autofill heuristics can treat this cluster of plain text inputs as
// one address-like form and paste a saved profile's name or street number into an unrelated numeric
// field. Fixed by explicitly opting every one of these fields out with autocomplete="off".
const assert = require('assert');
const { newPageAt, passConsentGate } = require('./helpers');

var GUARDED_IDS = [
  'rs_spouseName', 'rs_addressNumber', 'rs_addressName', 'rs_annualRent',
  'rs_monthlyUpkeep', 'rs_schoolFeePerTerm', 'rs_fatherName', 'rs_motherName', 'rs_remittance'
];

exports.run = async function(ctx){
  var page = await newPageAt(ctx.browser, '/index.html');
  try {
    await passConsentGate(page);

    for (var i = 0; i < GUARDED_IDS.length; i++){
      var id = GUARDED_IDS[i];
      var autocompleteVal = await page.$eval('#' + id, function(el){ return el.getAttribute('autocomplete'); });
      assert.strictEqual(autocompleteVal, 'off', '#' + id + ' should set autocomplete="off" to stop the browser pasting saved name/address data into it, got: ' + autocompleteVal);
    }
  } finally {
    await page.context().close();
  }
};
