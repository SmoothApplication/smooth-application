# Architecture

Smooth Application is a single self-contained HTML file (`index.html`, ~5,600 lines) plus a small
set of static companion files for deployment (`_headers`, `manifest.json`, `sw.js`, `icons/`).
There is no build step, no bundler, no framework, and no server — everything the app does happens
in the browser, in one file, on purpose. This document exists so a second person (or a future you)
can find their way around without re-deriving the whole thing from scratch. Update it whenever the
structure below actually changes — a stale map is worse than no map.

## Why one file

The core product promise is "nothing leaves your device" — documents, OCR output, bank statement
data, and answers all stay client-side. A single static HTML file makes that promise easy to
verify (there's no server to audit, no API to intercept) and easy to deploy (drop it on any static
host). The trade-off is real: no code-splitting, no module system, no TypeScript, and every change
touches one large file. That trade-off is deliberate, not an oversight — see
`docs/monetization-strategy.md` and the CHANGELOG for the reasoning if it's ever worth revisiting.

## Top-level layout of `index.html`

| Lines (approx.) | What's there |
|---|---|
| 1–11 | `<head>` — meta tags, title, PWA manifest/icon links |
| 12–528 | `<style>` — all CSS, inline. See "Styling" below |
| 530–531 | `<body>` opens |
| 532–574 | Consent gate markup (`#consentGate`) — the country picker + disclaimer screen shown before the app |
| 575–1101 | Main app markup (`#appWrap`, initially `display:none`) — header, session nav placeholder, all checklist/finance/statement cards, sidebar, footer, Privacy/Terms modal |
| 1102–5577 | `<script>` — one big IIFE, `(function(){ "use strict"; ... })();`. Everything else in this document lives in here |

Nothing is a separate `<script src>` tag except the three CDN libraries loaded on demand (see
"External dependencies" below) — nothing to bundle, nothing to transpile.

## Styling

One `<style>` block (lines 12–528), using CSS custom properties for theming: `:root` for light
mode (the default), `:root[data-theme="dark"]` and `@media (prefers-color-scheme: dark)` for dark
mode. The palette is a small, deliberately restrained "Ocean & Coastal" set (`#1b6fa8` blue,
`#0e8f82` teal, `#c17a3d` sand, plus a few accent colors) reused everywhere rather than a wide
arbitrary spread — see the comment block at the top of `<style>` for the reasoning. Layout is CSS
Grid (`.layout`) with `minmax(0, 1fr)` (not plain `1fr`) on the main column specifically to prevent
long unbroken strings deep in the page from forcing horizontal overflow on narrow phones — this
was a real, twice-reported bug class (see `tests/no-horizontal-overflow.test.js`).

## The session wizard

The checklist used to be one long scrolling page; it's now split into short "sessions" (one topic
per screen) without changing how anything is tracked, scored, saved, or scanned — every card stays
in the same place in the DOM, sessions just toggle which one is currently visible via
`[data-session-key]` / `[data-cat]` attributes and `style.display`.

- `getVisibleSessionKeys()` (~1679) — returns the ordered list of session keys for the current
  answers: always `['trip', 'finance', 'finance2']`, then one `'cat:<Category Name>'` per checklist
  category that currently applies, then `'review'`. Recomputed on every render, since which
  categories apply shifts as trip details change.
- `sessionLabel(key)` (~1691), `sessionProgress(key)` (~1703) — human label and a
  `{percent, points, total}` completion score for any session key.
- `applySessionVisibility()` (~1761) — the single function that actually shows/hides sessions and
  re-renders the nav header + footer. **Anything that changes answers relevant to session progress
  must call this** (or something that calls it) if the on-screen percentage should update live —
  this was the root cause of the "form is fully filled but shows 0%" bug: `computeFinancials()`
  used to update the underlying data but never call this, so the header only refreshed on the next
  navigation. See `tests/session-progress-live-update.test.js` for the regression test.
- `goToSession(idx)` (~1780), `attemptAdvanceSession(targetIdx)` (~1820) — programmatic and
  "Next →"-button navigation. The numbered session pills call `goToSession` directly (no
  confirmation); the guided Next/Back buttons in the footer go through `attemptAdvanceSession`,
  which shows a soft `window.confirm()` nudge if you're leaving an incomplete section — not a hard
  block, just a check.
- `renderSessionNav(keys, idx)` (~1790) / `renderSessionFooter(keys, idx)` (~1835) — build the pill
  row + "Session N of M: Label — X% filled" header, and the Save/Next footer respectively.

## Checklist data model

- `CHECKLIST_UK` (~1301) and `CHECKLIST_CA` (~1429) — flat arrays of item objects:
  `{id, cat, label, weight: 'required'|'recommended', appliesIf: fn(answers) -> bool, tip,
  accepts, multiple, checkKind}`. `checkKind` (e.g. `'passport'`, `'oldVisa'`) selects which
  best-effort local scanner `analyze()` runs against an uploaded file for that item.
- `COUNTRIES` (~1565) — per-country config: which `CHECKLIST_*` array to use, category order,
  disclaimer HTML, footer source links, "ready" flag (used/disabled US/EU/ZA/AU/CN options in the
  consent gate are simply `ready: false` or absent entries).
- `getAnswers()` (~1609) reads every form field into a plain object; `itemApplies(it, a)` (~1643)
  evaluates an item's `appliesIf` against it. `render()` (~1855) rebuilds `#checklistRoot` from
  these on every trip-detail keystroke; `categoryOpenState` remembers which `<details>` sections
  were open/closed across those rebuilds so typing doesn't slam sections shut mid-edit.
- `updateScore()` (~1998) computes the sidebar's overall document-readiness percentage from
  checked-vs-applicable items.

## Financial readiness calculator

- `computeFinancials()` (~2246) is the central recompute function — bound to `input` on
  `['fc_nights','fc_flight','fc_accom','fc_transport','fc_shopping','fc_shoppingPlace',
  'fc_sightseeing','fc_closing','fc_forexSavings','fc_airline','fc_depDate','fc_arrDate',
  'fc_accomAddress']` (see the `.forEach` near ~2610). Single exit point (no early returns), which
  is what makes it safe to unconditionally call `applySessionVisibility()` at the end.
- Three "helper" panels — transport (`computeTransportEstimate()` ~2742), sightseeing
  (`computeSightseeingEstimate()` ~2886), and currency (`computeCurrencyEstimate()` ~3006) — each
  follow the same UX pattern: open, fill in a sub-form, click "use this estimate", the panel
  collapses to a one-line `✓ ... — edit this estimate` summary. See
  `tests/helper-collapse-after-use.test.js`.
- `buildCashFlowTable()` (~2214) renders the manual month-by-month inflow/outflow table;
  `runStatementAnalysis()` (~4949) and `runBusinessStatementAnalysis()` (~4438) are the automated
  path, driven by parsed bank-statement rows (see OCR/PDF pipeline below) — both auto-fill the same
  cash-flow table so the two entry points stay consistent.

## OCR / PDF / spreadsheet pipeline

Three open-source libraries are loaded **only when first needed**, not on page load. pdf.js is
self-hosted (`vendor/pdf.min.js`, `vendor/pdf.worker.min.js`); Tesseract.js and SheetJS/xlsx still
load from cdnjs — see CHANGELOG "cdnjs serving inconsistent bytes" for why pdf.js specifically
moved off cdnjs and the other two haven't (yet).

- `wasmSupported()` / `WASM_SUPPORTED` (~3119) — synchronously feature/CSP-detects WebAssembly via
  `WebAssembly.validate()` on a trivial module, computed once at load. Catches two failure modes as
  one: no `WebAssembly` global at all, and (the one that actually matters for real users) Safari
  older than 15.4, which doesn't understand the `'wasm-unsafe-eval'` CSP keyword `_headers` uses to
  allow Tesseract.js's WASM OCR engine to compile, so WASM silently stays blocked. `ensureLibs()`
  skips even requesting `tesseract.min.js` when this is false, and `ocrUnavailableReason()` gives
  the two "OCR unavailable" user messages an accurate reason instead of a generic one.
- `loadScriptOnce(src, integrity)` / `loadScript(src, integrity)` (~3086) — `loadScriptOnce`
  injects a single `<script>` tag and returns a Promise; `loadScript` wraps it with exactly one
  automatic retry (after a 1.5s pause) before giving up, since a real client hit a one-off
  connectivity drop on this path the same day it shipped (see CHANGELOG "First real client
  report"). Always sets `crossOrigin = 'anonymous'`; the three call sites in `ensureLibs()` pass
  real SHA-384 `integrity` hashes, computed via `.github/workflows/compute-sri.yml` (see the
  comment directly above these functions, and that workflow's own header comment, for how to
  re-derive them if the pinned CDN versions below are ever bumped). `onerror` rejects with a real
  `Error`, not the bare `Event` browsers pass by default, so downstream `.catch()` blocks can
  actually log/show `err.message` instead of always falling back to "unknown error".
- `ensureLibs()` (~3098) — `Promise.allSettled`s pdf.js 3.11.174 (from `/vendor/`, same-origin, no
  `integrity` needed), Tesseract.js 5.0.4, and SheetJS/xlsx 0.18.5 (both still pinned versions
  loaded as `<script>` tags from `cdnjs.cloudflare.com`). **Tesseract.js itself then pulls in two more origins at runtime that we
  don't control** — its WASM core (`tesseract.js-core`, default host `cdn.jsdelivr.net`) and its
  OCR language data (a `.traineddata` file, default host `cdn.jsdelivr.net` and/or
  `tessdata.projectnaptha.com` depending on version). This isn't optional or configurable away
  without self-hosting those files ourselves — see `TESSERACT_OPTS` below and the `_headers`
  comment for the incident this caused.
- `TESSERACT_OPTS` (~3128) — pins `workerPath` to the cdnjs-hosted `worker.min.js` (matching our
  pinned Tesseract.js version), passed as the third argument to every `Tesseract.recognize()` call.
  Keeps one of Tesseract's three dependencies on the CDN we already trust and allowlist, rather
  than adding a third reliance on jsdelivr. `corePath`/`langPath` are left as Tesseract's own
  defaults (jsdelivr / tessdata.projectnaptha.com) — both allowlisted in `_headers`.
- `loadFileToCanvas()` / `rotateCanvas()` / `smartRecognize()` (~3695–3749) — image prep and OCR
  entry point (Tesseract.js) for photographed/scanned documents.
- `getLinesFromPdf()` / `pdfPageToCanvas()` (~3979, ~3965) — pdf.js-based text/line extraction for
  PDF statements; `linesFromWorkbook()` (~4022) does the same for spreadsheet uploads via SheetJS.
- `analyze(kind, text, answers)` (~3453) is the dispatcher: given extracted text and a `checkKind`,
  runs the matching heuristic (MRZ checksum validation for passports via `validateMrz()` ~3200 and
  friends, date extraction, accommodation-rate detection, etc.) and returns `{cls, text}` for
  display. Every document/user-derived value interpolated into the HTML this produces goes through
  `escapeHtml()` (~1179) first — see the XSS audit note below.
- Bank-statement narration parsing (`parseStatementLines()` ~4114 through
  `buildIncomeSourceBreakdown()` ~4689) turns extracted lines into transactions, groups them by
  inferred sender/source, flags large unexplained inflows, and lets the applicant attach a
  free-text explanation to each — all of it escaped before it's ever put into `innerHTML`.
- Income-breakdown spreadsheet export (`window.XLSX.utils.aoa_to_sheet` / `writeFile`, ~4939) is
  the one place `xlsx` is used for **output**, not just reading uploaded spreadsheets.

## Security posture (see also `_headers`)

- **CSP**: `_headers` (repo root, Netlify's custom-headers convention) sets a Content-Security-
  Policy scoped to the app's actual external origins (`cdnjs.cloudflare.com`, `open.er-api.com`,
  `gc.zgo.at`/`*.goatcounter.com`), plus `X-Frame-Options`, `X-Content-Type-Options`,
  `Referrer-Policy`, `Permissions-Policy`, `Cross-Origin-Opener-Policy`. `script-src`/`style-src`
  necessarily include `'unsafe-inline'` since there's no build step to move CSS/JS out of the page
  — the CSP's real value here is the external-origin allowlist, not inline-script blocking.
- **SRI**: `loadScript()`'s three call sites in `ensureLibs()` now pass real SHA-384 `integrity`
  hashes (`crossOrigin: 'anonymous'` is always set, required for SRI to apply cross-origin) —
  browsers refuse to execute pdf.min.js/tesseract.min.js/xlsx.full.min.js if a tampered or
  compromised CDN response doesn't match. See the comment above `loadScript()` for how to
  re-compute these if the pinned versions change.
- **XSS**: `escapeHtml()` (~1179) is the app's one HTML-escaping helper. All 62 `.innerHTML =`
  assignment sites in the file have been audited; every one that interpolates document/user-derived
  text (bank narration, OCR'd names, typed explanations, filenames) escapes it first. See
  `tests/xss-escaping.test.js` for the regression test and the CHANGELOG for the audit's one fixed
  defense-in-depth gap.
- **Error logging**: `logClientError()` (~1164) reports crashes (via `window.onerror` /
  `unhandledrejection`) through the same opt-in analytics channel as everything else — silent
  whenever analytics is off, and never sends the error message/stack/filename, only a constructor-
  name allowlist match (`TypeError`, etc.) plus a fixed context label.

## Analytics (opt-in, off by default)

`ANALYTICS_SITE_CODE` (~1120, blank by default) gates a GoatCounter integration —
`loadAnalytics()` / `trackEvent(name)` (~1121, ~1135). Never sends document content, filenames, or
answers, only event names and counts, and is a no-op everywhere in the code when the site code is
blank. See the Privacy Policy tab in the app (or `docs/privacy-policy-draft.md`) for the full
description shown to users.

## Local persistence (no server, ever)

`buildPayload()` / `applyPayload()` (~5167, ~5188) serialize/restore the full answer set;
`autoSave()` / `loadAutoSaved()` (~5268, ~5277) persist that payload to `localStorage` under a
per-country key (`storageKey()` ~5262), restored automatically on next visit (with a "Welcome
back" banner). The sidebar's Export/Import buttons (`#btnExport`/`#btnImportTrigger`, ~1066) do the
same thing as a downloadable/importable `.json` file, for moving progress between browsers/devices
or just keeping an explicit backup — nothing here ever touches a network request.

## PWA / offline support

`manifest.json` + `sw.js` (repo root) plus a `<link rel="manifest">` and a best-effort service-
worker registration near the end of the main IIFE. The service worker caches **only** the same-
origin app shell (this page, the manifest, the icons) — it deliberately does not intercept or cache
the CDN libraries or the exchange-rate API, so it never becomes a second place that needs updating
when a CDN version or SRI hash changes. See the comment block at the top of `sw.js` for the full
reasoning.

## Testing

`tests/` — a small Playwright suite (plain `playwright` + Node's `assert`, no `@playwright/test`
framework) covering the consent gate, live session-progress updates, the purpose-dropdown default,
helper collapse-after-use, no-horizontal-overflow at several breakpoints, the dark-mode toggle, and
XSS escaping. Run with `npm test` (see `tests/README.md`). `.github/workflows/ci.yml` runs the same
suite on every push/PR — this needs a GitHub remote configured on the repo to actually execute (see
the CHANGELOG for what's still pending on that front).

## External dependencies (exhaustive — cross-check this against `_headers` if either changes)

| Origin | What for | When |
|---|---|---|
| `cdnjs.cloudflare.com` | pdf.js, Tesseract.js (+ its worker.min.js), SheetJS/xlsx | Loaded on demand, only when a document/spreadsheet feature is first used |
| `cdn.jsdelivr.net` | Tesseract.js's own default host for its WASM core, and on some versions its OCR language data | Automatic, whenever Tesseract.js runs — not something this app chose, see the note above under "OCR / PDF / spreadsheet pipeline" |
| `tessdata.projectnaptha.com` | Tesseract.js's default OCR language-data host on some versions | Same as above — kept alongside jsdelivr since which one v5.0.4 actually uses wasn't worth guessing wrong about mid-incident |
| `open.er-api.com` | Live exchange-rate lookups | User-triggered ("Fetch live rate" buttons), 3 call sites |
| `gc.zgo.at`, `*.goatcounter.com` | Analytics | Only if `ANALYTICS_SITE_CODE` is set (off by default) |

This list grew by two origins after the first CSP shipped (see CHANGELOG) — it turned out
Tesseract.js has its own undocumented-until-you-hit-it CDN dependencies beyond the `tesseract.min.js`
file we load ourselves. If OCR ever silently breaks again after a CSP or Tesseract.js version
change, check the browser console for a `Refused to connect`/`Refused to load` message before
assuming the bug is anywhere else.

No other network calls exist anywhere in the app. `window.open()` calls to gov.uk / canada.ca /
Google Maps / Google Flights are plain link navigations, not `fetch()`s, and don't need a
`connect-src` entry.
