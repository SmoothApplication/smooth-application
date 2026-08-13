# Changelog

Development milestones to date, grouped by feature batch rather than exact dates (this repo's
git history starts from the current state — see `docs/ip-ownership-notes.md` for why).

## Incident: OCR broke in production after the CSP shipped
Shortly after the security-headers CSP went live, passport/document OCR started failing on the
real deployed site with "Couldn't read this PDF automatically (unknown error)" — even though it
had worked fine in every test run before that. Root cause: Tesseract.js has its own runtime
dependency chain beyond the `tesseract.min.js` file this app loads itself — by default it also
fetches a WASM core and OCR language data from `cdn.jsdelivr.net` (and, on some versions,
`tessdata.projectnaptha.com`), neither of which was in the CSP's allowlist. This was invisible in
every test run in the development sandbox because that environment can't reach any CDN at all
(cdnjs included), so the CSP's real-world effect on Tesseract.js was never actually exercised
end-to-end until a real user hit it on the live site.

Fixed by: adding both origins to `_headers` (script-src, connect-src, worker-src as appropriate),
adding `'wasm-unsafe-eval'` to script-src (Tesseract.js compiles a WASM module — this is the narrow
CSP keyword for that, not full `'unsafe-eval'`), pinning `workerPath` explicitly to the
cdnjs-hosted `worker.min.js` so at least one of Tesseract's three dependencies stays on the
already-trusted CDN instead of adding a third reliance on jsdelivr, and improving the PDF-scan
error handler to log the real underlying error to the console instead of a bare "unknown error"
when a library's rejection has no `.message`, so this class of bug is faster to diagnose next
time. See `ARCHITECTURE.md`'s "External dependencies" table, which now lists both new origins and
the same caution for future changes.

## Core product
- Session/wizard-style checklist flow (Identity & application, Financial evidence, Ties to
  Nigeria, Accommodation, Travel details, Purpose-specific, Child travel, Visa history,
  Translations, Review) for both UK and Canada visas
- Financial-readiness scoring against heuristic thresholds
- Light/dark theme, print support, mobile-responsive layout
- Autosave to the browser's local storage — nothing sent to a server

## Document scanning (all on-device, no uploads)
- Passport OCR: reads name and expiry, validates MRZ checksums, cross-checks printed vs. MRZ
  text, auto-fills the form — rewritten to be tolerant of real-world OCR noise after testing
  against an actual user's passport scan
- Refusal-letter scanning: keyword-matched against common refusal-reason categories with
  tailored guidance
- Bank statement multi-file scanning and consistency checks
- Rotation-aware OCR fallback for scanned PDFs and photos with no embedded text layer

## Feedback round 1 (16 items)
- Passport OCR auto-fill, refusal-letter scanning, and a full front-page redesign, among others

## Feedback round 2 (7 items)
- Pre-flight "what to gather first" checklist shown before the form starts
- Clearer "where is this saved" messaging
- Student sponsor sub-flow (sponsor name + relationship, admission/enrolment letter)
- Final "Are you ready?" review summary
- Improved flight-price-comparison deep link
- Free "email myself this summary" button (`mailto:` — no backend, no account, on-device only)
- Deliberately deferred: automated email reminders, server-sent reports, live flight pricing —
  these need a real backend and were scoped out until there's validated demand (see
  `docs/monetization-strategy.md`)

## Scaling foundations (this batch)
- Optional, privacy-first, aggregate-only usage analytics (GoatCounter) — off by default
- This repo, with a real README, changelog, and business-document set
- Draft Privacy Policy, Terms of Service, IP ownership notes, monetization strategy, and
  distribution plan

## Engineering hardening pass (technical audit follow-up)
Prompted by a self-requested "technical co-founder" review of the shipped app's engineering
lapses; every item below fixes one of that review's findings.
- **Security headers**: added a Netlify `_headers` file with a Content-Security-Policy scoped to
  the app's actual external origins (cdnjs, open.er-api.com, GoatCounter), plus
  X-Frame-Options, X-Content-Type-Options, Referrer-Policy, Permissions-Policy, and
  Cross-Origin-Opener-Policy. Verified zero CSP violations against real app usage.
- **SRI groundwork**: `loadScript()` now accepts a real integrity hash and always sets
  `crossOrigin: 'anonymous'`; hashes aren't set yet because this dev environment can't reach
  cdnjs.cloudflare.com to compute them — see `ARCHITECTURE.md` for the exact commands to run
  from a machine that can.
- **XSS audit**: reviewed all 62 `.innerHTML =` sites in the app; 61 already escaped
  document/user-derived text correctly, fixed the one defense-in-depth gap found (an
  accommodation-rate detector message).
- **Client-side crash reporting**: added `window.onerror`/`unhandledrejection` handlers that
  report through the same opt-in analytics channel as everything else — silent whenever
  analytics is off, and never sends the error message, stack, or filename.
- **Privacy Policy & Terms surfaced in-app**: added a Privacy/Terms modal (footer links) with
  plain-language content matching `docs/privacy-policy-draft.md` and
  `docs/terms-of-service-draft.md`, since those drafts previously existed only in the repo.
- **PWA support**: added `manifest.json`, an app icon set, and `sw.js` (a minimal service worker
  caching only the same-origin app shell — never the CDN libraries) so the app installs and
  opens offline after a first visit.
- **Persisted test suite + CI**: replaced disposable ad-hoc test scripts with a committed
  `tests/` Playwright suite (7 regression tests) and `.github/workflows/ci.yml`. The workflow
  can't run yet — this repo has no GitHub (or other) remote configured, so there's nowhere for
  GitHub Actions to trigger from until one is added.
- **ARCHITECTURE.md**: added, mapping the single-file structure, session-wizard engine,
  checklist data model, financial calculator, and OCR/PDF/XLSX pipeline with a line-range guide.

Still open, and requiring the site owner's own action (not something a future engineering pass
can complete alone): turning on analytics needs a GoatCounter account + site code; CI needs a
GitHub remote pushed and configured; real SRI hashes need to be computed from a network that can
reach cdnjs.cloudflare.com; and cross-browser (non-Chromium) manual testing hasn't been done.
