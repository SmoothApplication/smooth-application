# Test suite

A small, dependency-light Playwright regression suite for the single-file app in `index.html`.
Deliberately built on plain `playwright` + Node's built-in `assert`, run through a ~40-line
runner (`run-all.js`) rather than the `@playwright/test` framework — this is a static, no-build
project, so the test tooling shouldn't need one either.

## Running locally

```
npm install
npx playwright install --with-deps chromium   # first run only
npm test
```

`run-all.js` starts a minimal local static file server (serving the repo root, so relative paths
like `/manifest.json` and `/sw.js` resolve exactly as they would on Netlify), launches one shared
Chromium instance, then runs every `tests/*.test.js` file against it, printing a pass/fail summary
and exiting non-zero if anything failed. That's the same command CI runs.

## What's covered

- **consent-gate** — Continue stays disabled until a country is picked and the disclaimer is
  agreed to; continuing hides the gate and reveals the app.
- **session-progress-live-update** — regression test for the "form is fully filled but shows 0%
  filled" bug: the finance session's progress percentage must update live as fields are typed,
  with no navigation or save step required.
- **purpose-dropdown-default** — the "Main purpose of visit" dropdown defaults to the blank
  placeholder, never a silently pre-selected real option.
- **helper-collapse-after-use** — the currency-savings helper panel collapses to a one-line
  summary once its estimate is applied, and "edit this estimate" reopens it.
- **no-horizontal-overflow** — regression test for the mobile-layout bug class: no horizontal
  scroll at 320/375/414/768/1024px, on both the consent gate and inside the app.
- **dark-mode-toggle** — the theme toggle alternates `data-theme` and its own label correctly
  across repeated clicks.
- **xss-escaping** — regression test for the XSS audit: a `<img onerror=...>` payload typed into
  a field that's echoed into `innerHTML` (the shopping-place note) must render as inert, escaped
  text, never as a live element whose handler fires.

## Adding a test

Drop a new `tests/whatever.test.js` file exporting `async function run(ctx)` (see any existing
file for the shape — `ctx.browser` is the shared Playwright browser instance). `run-all.js` picks
it up automatically; no registration needed.
