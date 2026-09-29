# Repo-root tests

This is deliberately tiny. The old single-file `index.html` app that used to live here — and the
~140-file Playwright suite that tested it — is retired; see the CHANGELOG entries "Retire the old
GitHub Pages site" and "Retire the legacy index.html Playwright suite" for the full story. `index.html`
is now just a redirect page pointing visitors at [smoothapplication.com](https://smoothapplication.com),
where the real, current app lives (in `web/`, a Next.js app with its own Jest suite — see
`web/package.json` and CI's `web-test` job).

## What's covered here

`redirect-and-kill-switch.test.js` — plain Node, no browser needed — checks that:

- `index.html` still redirects to smoothapplication.com, both via `<meta http-equiv="refresh">`
  (no-JS fallback) and `window.location.replace(...)` (JS path, using `replace` so the retired page
  never lands in browser history).
- `index.html`'s canonical link points at smoothapplication.com, not itself.
- `index.html` re-registers `sw.js` on every visit (so a stale, already-installed service worker
  from the old app gets checked for updates on this visit, not whenever the browser next feels
  like it).
- `sw.js` is still the kill-switch: it takes over immediately (`skipWaiting`), deletes every cache
  the old worker ever created, unregisters itself, and force-navigates any open tab so the redirect
  actually reaches someone who still has the old worker installed. See `sw.js`'s own top-of-file
  comment for the real incident this exists to prevent.

## Running locally

```
node tests/redirect-and-kill-switch.test.js
```

Exits non-zero on any failed check. No `npm install`, no Playwright, no browser — it just reads
`index.html` and `sw.js` off disk and checks their content.

## The real test suite

For the actual live app (smoothapplication.com), see `web/` — a Next.js app with 470+ Jest tests
covering the checklist, bank-statement analysis, passport OCR, and everything else. Run with:

```
cd web && npm install && npx jest
```

CI runs this as its `web-test` job on every push/PR.
