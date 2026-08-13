# Changelog

Development milestones to date, grouped by feature batch rather than exact dates (this repo's
git history starts from the current state — see `docs/ip-ownership-notes.md` for why).

## Passport OCR: higher render resolution for scanned PDFs
A client's passport PDF (a CamScanner export) came back "Limited read" — expiry and MRZ checksum
both not detected — even though the passport was clearly legible to the eye. Tested the exact
file through the exact OCR engine/model version this app uses (Tesseract.js 5.0.4, same language
data) outside the browser: it read the passport perfectly, 4/4 MRZ checksums, correct expiry. So
the detection logic itself is sound — this wasn't the same class of bug as the pdf.js CDN issue.
The likely gap: phone "scan to PDF" apps (CamScanner, Adobe Scan, etc.) commonly place the
photographed page on a full A4/Letter canvas with wide white margins rather than filling the
frame, so the actual document content renders at a lower effective resolution than the source
photo once this app draws the PDF page to a canvas for OCR. Bumped the render scale for that
scanned-PDF fallback path from 2 to 3 (50% more pixels on the passport content, including the
small MRZ text) — cheap, safe change, more headroom for exactly this kind of scan. Verified: the
existing 7-test regression suite still passes; the MRZ-parsing logic itself was independently
re-verified against a real Tesseract.js run using the app's actual bundled language model.

## Root cause found: cdnjs serving inconsistent bytes for pdf.js, self-hosted it
The "PDF scanning tool failed to load" reports (a client, then the app's own owner reproducing it
on two different desktop browsers) turned out to have a real, confirmable cause — not a network
block, and not something wrong with our deploy. Re-fetched `pdf.min.js` from the exact same pinned
cdnjs URL used to compute the SRI hash shipped earlier that same day, via a fresh GitHub Actions
run, and diffed the two SHA-384 digests programmatically: they didn't match. Same URL, same pinned
version, different bytes, minutes apart. That's exactly the condition SRI is designed to catch —
the browser correctly refused to execute a script whose bytes didn't match what was pinned, which
surfaces to the user as a load failure with no useful detail. cdnjs serves from many edge
locations; something about the redundancy/propagation there let this pinned file drift.

Fixed by removing the cdnjs dependency for pdf.js entirely: `vendor/pdf.min.js` and
`vendor/pdf.worker.min.js` are now committed into the repo and served from this app's own domain.
A same-origin file can't have this failure mode — there's exactly one copy, on one server, nothing
else claiming to serve "the same" bytes. No `integrity` attribute needed either, since SRI only
applies to cross-origin loads. Added `.github/workflows/fetch-pdfjs-vendor.yml` (GitHub's runners
have the network access this sandbox doesn't) to re-fetch these two files if the pinned pdf.js
version is ever bumped.

Tesseract.js and SheetJS/xlsx are NOT self-hosted yet — nothing reported has implicated them
specifically, and Tesseract.js's own runtime dependency chain (WASM core + language data from
jsdelivr/tessdata.projectnaptha.com, outside our control either way) makes fully self-hosting it a
bigger job than this one was. Worth revisiting if a similar pattern shows up for either of them.

Verified: downloaded both vendor files via the new workflow, confirmed `pdf.min.js` is valid,
parseable JS that defines `pdfjsLib` (`node -c`, then loaded it in a real headless Chromium and
confirmed `window.pdfjsLib` becomes defined with zero failed network requests), served the whole
app over real HTTP locally and confirmed `/vendor/pdf.min.js` and `/vendor/pdf.worker.min.js` both
resolve with HTTP 200 at the exact same paths the deployed app will use. Full regression suite
still 7/7.

Also added one automatic retry to `loadScript()` earlier the same day, before this root cause was
found — kept, since it still helps with genuine transient network drops on the two libraries that
remain on cdnjs.

## First real-traffic finding: OCR silently unavailable on older Safari
Once analytics started picking up a handful of real visits, one showed a `error:global:Unknown`
crash-report event — the deliberately minimal client-side crash reporting added during the
engineering hardening pass, catching an uncaught error with no further detail by design. Cross-
referencing GoatCounter's Browsers/Systems breakdown for that same week showed exactly one visit
on Safari/iOS against six on Chrome/Windows — the same count as the one error, a plausible (not
certain — the crash report intentionally can't say more) match with a real, documented gap: Safari
only understands the `'wasm-unsafe-eval'` CSP keyword (which `_headers` relies on to let
Tesseract.js compile its WASM OCR engine) from Safari 15.4 onward. Older/un-updated iPhones —
plausibly a meaningful share of this app's actual users — would have OCR fail silently or
confusingly instead of with a clear reason.

Fixed by adding `wasmSupported()`, a synchronous feature/CSP-detection check run once via
`WebAssembly.validate()`. `ensureLibs()` now skips even requesting `tesseract.min.js` when it's
false, and the two "OCR unavailable" messages a user can see now say "isn't supported on this
browser version" instead of the generic (and, for these users, inaccurate) "offline or blocked".
Also fixed `loadScript()`'s `onerror` to reject with a real `Error` instead of a bare `Event` —
existing `.catch()` blocks were reading `err.message` for diagnostics and always getting nothing
useful back on a real load failure.

Verified: full regression suite still passes 7/7; confirmed the WASM feature-detection logic
evaluates correctly (reports "supported") in a real Chromium browser. Cross-browser/Safari testing
on a real device is still the one item this can't fully close from here — this fix targets the one
concrete, named mechanism found by reasoning through the CSP spec, not a confirmed root cause,
since the crash reporter deliberately never sends enough detail to be fully certain.

## First real client report: PDF scan failed to load
Within the same day this went live, a client trying to actually prep an application hit "PDF
scanning tool failed to load (offline or blocked)" while uploading a passport bio page — a
different failure path than the Safari/WASM one above (this is pdf.js itself failing to load, not
Tesseract). Two possible causes: a stale/wrong SRI hash (would break this for every visitor,
regardless of browser or network), or a one-off connectivity blip (affects only that person, that
moment). Re-ran `.github/workflows/compute-sri.yml` and diffed the freshly computed pdf.js hash
against the one pinned in `index.html` programmatically (not by eye) — byte-identical. Rules out a
stale hash; a transient network drop is the far more likely explanation, and mobile data (which a
lot of this app's real users are likely on) makes brief drops fairly ordinary.

Added one automatic retry to `loadScript()`: on failure, wait 1.5s and try once more before giving
up. A single dropped request no longer means OCR/PDF/spreadsheet features come up simply because
someone's connection blipped for a moment during a real, high-stakes task. Verified the retry
control flow directly against the actual extracted function (not a re-implementation) against three
cases — first attempt succeeds (no delay), first fails/second succeeds (resolves after ~1.5s), and
both fail (rejects with a real error after ~1.5s) — all behaved as intended. Full regression suite
still 7/7.

## Scaling foundations, part 2: GitHub remote, real CI, real SRI hashes
Three items had been sitting on the "still open" list below for a while, all blocked on the same
root cause: the development sandbox this app was originally built in has no route to GitHub or to
any CDN (cdnjs, jsdelivr, etc.) — confirmed repeatedly via curl, node fetch, and browser navigation
all failing identically. Closed out by:
- **GitHub remote**: created `github.com/SmoothApplication/smooth-application` and pushed the full
  project (the sandbox's own git-over-HTTPS access to GitHub is also blocked, so this went through
  GitHub's web upload UI instead of a normal `git push`).
- **Real CI**: the `.github/workflows/ci.yml` written during the engineering hardening pass had
  never actually run — there was nowhere for it to trigger from. It now runs automatically on every
  push, and passed on its first real run.
- **Real SRI hashes**: `loadScript()` has accepted a real `integrity` hash since the hardening pass,
  but the three CDN library loads (`pdf.min.js`, `tesseract.min.js`, `xlsx.full.min.js`) were still
  unpinned because the hashes could never be computed from this sandbox. Added
  `.github/workflows/compute-sri.yml` — a manually-triggered workflow that uses GitHub's own
  runners (which do have normal internet access) to fetch each pinned file and print its SHA-384
  hash. Ran it once, plugged the three real hashes into `loadScript()`. Browsers will now refuse to
  execute any of those three files if a compromised or tampered CDN response doesn't match the
  hash computed here — closes the supply-chain gap the "SRI groundwork" item below left open.

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
  `crossOrigin: 'anonymous'`. (Real hashes were computed and wired in shortly after — see
  "Scaling foundations, part 2" above.)
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

Analytics, the GitHub remote + CI, and real SRI hashes are now all done (see "Scaling foundations,
part 2" above). One concrete Safari/WASM gap has since been found from real analytics data and
fixed (see "First real-traffic finding" above) — but that was reasoned from indirect signals, not
a confirmed root cause, so real-device manual testing on Safari/iOS is still the one item that
would actually confirm OCR now behaves correctly there, and remains open.
