// Test runner: discovers every tests/*.test.js file, runs its exported `run(t)` function against
// a shared browser + local static server, and reports pass/fail. Exits non-zero on any failure so
// this plugs straight into CI without needing @playwright/test or any other test framework.
'use strict';

const fs = require('fs');
const path = require('path');
const { startServer, launchBrowser } = require('./helpers');

async function main(){
  var testsDir = __dirname;
  var files = fs.readdirSync(testsDir)
    .filter(function(f){ return f.endsWith('.test.js'); })
    .sort();

  // Optional filter: `npm test -- dob-digit expiry-` (or `node tests/run-all.js dob-digit expiry-`)
  // runs only files whose name contains one of the given substrings, instead of the whole suite.
  // Useful for quickly re-checking a handful of failures without waiting through everything again.
  var filters = process.argv.slice(2).filter(Boolean);
  if (filters.length){
    files = files.filter(function(f){
      return filters.some(function(sub){ return f.indexOf(sub) !== -1; });
    });
    console.log('Filtering to ' + files.length + ' file(s) matching: ' + filters.join(', ') + '\n');
  }

  if (!files.length){
    console.error(filters.length ? 'No *.test.js files matched: ' + filters.join(', ') : 'No *.test.js files found in ' + testsDir);
    process.exit(1);
  }

  var server = await startServer();
  var browser = await launchBrowser();

  var results = [];
  for (var i = 0; i < files.length; i++){
    var file = files[i];
    var name = file.replace(/\.test\.js$/, '');
    var mod = require(path.join(testsDir, file));
    var start = Date.now();
    try {
      await mod.run({ browser: browser });
      var ms = Date.now() - start;
      results.push({ name: name, ok: true, ms: ms });
      console.log('✓ ' + name + ' (' + ms + 'ms)');
    } catch (err) {
      var ms2 = Date.now() - start;
      results.push({ name: name, ok: false, ms: ms2, error: err });
      console.log('✗ ' + name + ' (' + ms2 + 'ms)');
      console.log('  ' + (err && err.stack ? err.stack.split('\n').join('\n  ') : String(err)));
    }
  }

  await browser.close();
  await new Promise(function(resolve){ server.close(resolve); });

  var passed = results.filter(function(r){ return r.ok; }).length;
  var failed = results.length - passed;
  console.log('\n' + passed + '/' + results.length + ' passed' + (failed ? ', ' + failed + ' FAILED' : ''));
  process.exit(failed ? 1 : 0);
}

main().catch(function(err){
  console.error('Test runner crashed:', err);
  process.exit(1);
});
