'use strict';
// Mockup 2c: a guided live-camera capture as an alternative to picking an existing photo/PDF file.
// Feeds the exact same OCR pipeline (smartRecognize -> applyScanResult) the file upload already
// uses (see runScan in index.html) — this only changes how a photo of the bio page gets IN, so this
// test focuses on the camera-specific wiring itself (open/live-video/capture/cancel), not on OCR
// accuracy, which the existing fixture-based passport tests already cover thoroughly.
//
// Requires the fake camera device Playwright is launched with in helpers.js
// (--use-fake-device-for-media-stream/--use-fake-ui-for-media-stream) plus the 'camera' permission
// granted on this page's own context, since Chromium still gates getUserMedia behind a permission
// check even with a fake device wired up.
const assert = require('assert');
const { newPageAt, passConsentGate } = require('./helpers');

exports.run = async function(ctx){
  var page = await newPageAt(ctx.browser, '/index.html', { permissions: ['camera'] });
  // Diagnostics only — this test has been intermittently hanging at the post-capture wait with no
  // clear cause from a bare timeout message. Captured so a failure's error message can show what
  // actually happened in the page (e.g. an uncaught exception in the capture click handler) instead
  // of just "Timeout exceeded", which tells us nothing about why neither branch fired.
  var consoleLogs = [];
  var pageErrors = [];
  page.on('console', function(msg){ consoleLogs.push('[' + msg.type() + '] ' + msg.text()); });
  page.on('pageerror', function(err){ pageErrors.push(err && err.stack || String(err)); });
  function diagSuffix(){
    return ' | pageErrors: ' + JSON.stringify(pageErrors) + ' | console: ' + JSON.stringify(consoleLogs.slice(-20));
  }
  try {
    // "Validate your International Passport" is Session 1 — already the active session right after
    // the consent gate.
    await passConsentGate(page);

    // --- Opening the camera shows a live video feed, not a dead/black box ------------------------
    await page.click('#btnPassportCamOpen');
    await page.waitForFunction(function(){
      var panel = document.getElementById('passportCamPanel');
      return panel && panel.style.display !== 'none';
    }, { timeout: 5000 });
    await page.waitForFunction(function(){
      var v = document.getElementById('passportCamVideo');
      return v && v.videoWidth > 0;
    }, { timeout: 10000 });

    // --- Cancel stops the stream and hides the panel again ----------------------------------------
    await page.click('#btnPassportCamClose');
    var panelHiddenAfterCancel = await page.$eval('#passportCamPanel', function(el){ return el.style.display === 'none'; });
    assert.strictEqual(panelHiddenAfterCancel, true, 'Cancel should hide the camera panel');
    var streamStoppedAfterCancel = await page.evaluate(function(){
      var v = document.getElementById('passportCamVideo');
      var s = v && v.srcObject;
      if (!s) return true;
      return s.getTracks().every(function(t){ return t.readyState === 'ended'; });
    });
    assert.strictEqual(streamStoppedAfterCancel, true, 'Cancel should actually stop the camera track, not just hide the panel');

    // --- Re-opening, capturing kicks off the same read pipeline the file upload uses --------------
    await page.click('#btnPassportCamOpen');
    // NOTE: waitForFunction's real signature is (pageFunction, arg, options) — passing an options
    // object as the 2nd argument (as this file used to) is silently taken as `arg` instead, so the
    // {timeout:...} below was never actually applied; Playwright's real 30s default was in effect.
    // Passing `undefined` for arg makes the intended timeout actually apply.
    await page.waitForFunction(function(){
      var v = document.getElementById('passportCamVideo');
      return v && v.videoWidth > 0;
    }, undefined, { timeout: 10000 });
    await page.click('#btnPassportCamCapture');

    // The fake device's synthetic test pattern is bright enough to clear the underexposed check in
    // practice, so capture should proceed straight into the OCR pipeline: the panel closes and the
    // same "Reading…" busy message the file-upload path shows appears. (If a given fake-device build
    // ever rendered a dark pattern instead, the retake warning would show and the panel would stay
    // open — either outcome proves the capture->brightness-check wiring actually ran, so accept both
    // rather than risk flaking on exact fake-device pixel output.)
    try {
      await page.waitForFunction(function(){
        var panel = document.getElementById('passportCamPanel');
        var retake = document.getElementById('passportCamRetakeMsg');
        var panelClosed = panel && panel.style.display === 'none';
        var retakeShown = retake && retake.style.display !== 'none';
        return panelClosed || retakeShown;
      }, undefined, { timeout: 10000 });
    } catch (e) {
      e.message += diagSuffix();
      throw e;
    }

    var panelClosed = await page.$eval('#passportCamPanel', function(el){ return el.style.display === 'none'; });
    if (panelClosed){
      var msg = await page.$eval('#passportValidateMsg', function(el){ return el.textContent; });
      assert.ok(/Reading your camera capture/.test(msg), 'Should show the same style of busy message the file-upload path uses, got: ' + msg);
    } else {
      var retakeText = await page.$eval('#passportCamRetakeMsg', function(el){ return el.textContent; });
      assert.ok(/dark/.test(retakeText), 'If the capture was rejected, it should be for being too dark, got: ' + retakeText);
    }
  } finally {
    await page.context().close();
  }
};
