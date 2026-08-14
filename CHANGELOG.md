# Changelog

Development milestones to date, grouped by feature batch rather than exact dates (this repo's
git history starts from the current state — see `docs/ip-ownership-notes.md` for why).

## Made GitHub Pages the documented primary deploy, and fixed a second stale-analytics-status spot
`README.md` still named Netlify as the live link and described analytics as shipping disabled —
both wrong (GitHub Pages is live and preferred given Netlify's limited free-tier build minutes;
analytics has been on for a while, see the earlier fix in this changelog). Updated the README to
name GitHub Pages as the primary/authoritative link, describe Netlify as a manually-updated
backup, and correctly describe analytics as on, including the newer `session_view:<step>` funnel
events. No app code changed in this entry — documentation only.

## Added per-session funnel analytics (to actually answer "is the form too long?")
Real GoatCounter data this week showed 13 sessions scanned a passport and 0 reached the review
step — a real signal, but too coarse to act on: it couldn't say whether people were dropping at
trip details, work status, the financial calculator, or a document category checklist. Analytics
previously only had two funnel checkpoints (session start, and the final review step). Added a
`session_view:<key>` event that fires once per session per visit the first time each session
(trip, finance, finance2, each document category, review) becomes visible — de-duplicated so
clicking back and forth doesn't inflate the numbers. Within a week or two of real usage this will
show exactly where in the multi-step form people are giving up, instead of only start-vs-finish.
Verified in a real browser with a stubbed analytics endpoint (this sandbox can't reach the real
GoatCounter script) that events fire once per session and don't double-count on revisit, plus the
full existing test suite with no regressions.

## Fixed the in-app privacy disclosure falsely claiming analytics was off
Analytics (GoatCounter) was switched on some time ago and has been working correctly — real visits,
page views, and the `doc_scanned:passport` event have all been recording. But the in-app "Privacy
Policy" panel (the one users can read before uploading a passport or bank statement) still had
hardcoded text saying analytics was "currently OFF" and "switched off site-wide," left over from
before it was turned on. The footer's own analytics note was already correct — only this one panel
had drifted. Rewrote both the analytics line and the crash-reporting line to be computed from the
same `ANALYTICS_SITE_CODE` setting that actually controls whether analytics runs, so this text
can't silently go stale again if the toggle is ever flipped in either direction. Verified in a real
browser (not just by reading the source) that the modal now shows "currently ON" and none of the
old "OFF" wording remains.

## New process-flow batch: work status, employer cross-check, passport renewal link, trip length
Implemented from a detailed process spec, after first checking it against what already existed —
several described behaviors (the 2× buffer rule, Top 10 inflows, unexplained-narration flagging)
turned out to already be built, so only the genuinely new pieces below were added:
- **Work status**: the "employed"/"self-employed" checkboxes now reveal a required company/business
  name field each. Ticking both requires both names, with an inline note explaining why.
- **Employer/business name cross-check**: personal bank statement uploads are now searched for the
  typed employer or business name. If neither name turns up anywhere in the statement text, a
  prominent high-visibility warning explains this is a real risk factor for denial — not a soft
  advisory tip like most other checks here, since this one's specifically meant to be hard to miss.
  Word-based matching (not exact-string) so bank-truncated narrations still match correctly; generic
  words ("Bank", "Limited", "Store"...) are excluded from matching to avoid false positives.
- **Passport renewal link**: when a scanned passport's validity is too short for the trip, the advice
  now links directly to the official Nigeria Immigration Service renewal page (immigration.gov.ng),
  not just text advice.
- **Trip length**: the old manual "under 6 weeks / 6 weeks-6 months / 6+ months" dropdown is gone —
  it's now deduced automatically from the departure/return dates already being entered, shown as a
  read-only line where the dropdown used to be.
- **Opening balance**: added as its own explicit field alongside closing balance, with the same
  automatic detection-and-cross-check against uploaded statements that closing balance already had.

All four verified with real end-to-end tests (a synthetic bank statement was generated to exercise
the analysis pipeline directly, not just spot-checked by eye), plus the full existing test suite and
a regression check against both real client passport photos on file — no regressions found.

## Fixed a false "Needs attention" on genuinely valid passports (real client photo, again)
Even after the earlier MRZ/date-parsing fixes, a real client's passport photo (correctly read
everywhere else — passport number and expiry date both matched their own check digits, name matched)
still came back "Needs attention" instead of "Checks passed." Root cause was a scoring bug, not a
new OCR misread: the MRZ's "composite" check digit is mathematically *computed from* the passport
number, birth date, and expiry date fields — it isn't a 5th independent signal. A single OCR misread
in the birth-date field (which this app never uses for anything beyond an FYI display row) broke
both the birth-date check AND the composite check as a mathematical side effect, so one harmless
misread was being double-counted as "2 of 4 checks failed" and blocking the whole badge — even
though the two fields this tool actually relies on (passport number, expiry date) were both read
and checksummed perfectly. The badge now gates on those two fields only; birth date and composite
still show in the detail row for transparency, they just don't block the pass/fail verdict anymore.
Verified against both real client passport photos on file — both now correctly read "Checks passed"
consistently, and the full test suite still passes with no regressions.

## Made the app host-portable (found while evaluating GitHub Pages as a free Netlify alternative)
Every asset reference — `/vendor/pdf.min.js`, `/vendor/tesseract-*`, `/sw.js`, `/manifest.json`,
`/icons/*` — was hardcoded as an absolute path starting from the domain root. That's harmless on
Netlify/Cloudflare Pages, which serve this site from the root, but it would have silently broken
on GitHub Pages: a project repo like this one is served from a subfolder
(`username.github.io/repo-name/`), not the root, so every one of those paths would have 404'd —
OCR, PDF parsing, icons, and offline support all dark, with no visible error explaining why.
Replaced the hardcoded paths with a small `ASSET_BASE` computed from the page's own URL at
runtime, so the same file works unmodified on either kind of host. Extra care was needed for the
Tesseract OCR worker specifically: its core/language-data paths are read from inside a Web Worker,
where a plain relative path resolves against the *worker's* location rather than the page's —
that would have silently doubled the "vendor/" segment. Using an absolute (domain-rooted) path
sidesteps that ambiguity entirely, whether it's evaluated on the main thread or inside the worker.
`sw.js` (the offline-support service worker) had the same issue in its own cached-file list and
was fixed the same way. Verified by serving the whole app from a simulated subpath and confirming
zero failed asset requests, plus a real passport-photo OCR scan completing with an identical
result to the existing root-hosted deployment (no regression).

## Mobile usability pass: fixed the iOS zoom-on-focus bug, bigger tap targets
General "make it user-friendly and responsive" pass, prioritized by actual impact given GoatCounter
shows the large majority of traffic is iOS Safari:
- Every text/date input, select, and textarea was rendering at 13px, below the 16px threshold iOS
  Safari uses to decide whether to auto-zoom the page when a field is focused — so tapping into
  practically any field on the site zoomed the whole page in, and the person had to manually zoom
  back out to keep going. Bumped to 16px across the board.
- The 9-dot session-progress pills used to shrink to 25px on mobile — smaller than their own 28px
  desktop size, in exactly the place finger-tap accuracy matters most and a mouse pointer isn't
  available. Bumped to 32px; the pill row already wraps to a second line if they don't all fit, so
  there was no overflow risk in sizing up.
- Every button's tap height increased slightly (padding 6px 12px → 8px 14px) without changing font
  size, so wording/wrapping across the many differently-labeled buttons in different sections didn't
  need re-checking one by one.
Checked at 375/390/768/1200px — no overflow or wrapping regressions at any of them.

## Compressed the landing/consent screen — real feedback: "too busy"
Before doing anything, a first-time visitor had to scroll past: trust badges, a credit/contact
line, the visa picker, a collapsed "what to gather" toggle, a disclaimer headline PLUS 3
always-visible bullet points, a SEPARATE "read the full disclaimer" toggle for even more detail,
the checkbox, and finally Continue. The 3 disclaimer bullets were the single biggest, most
duplicated block — the short version already said "not immigration advice", and the bullets
under it were repeating/expanding on that same point right before an even-longer version behind
its own toggle. Collapsed the bullets into the same toggle as the full disclaimer, so the default
view is just the one-line headline + "Read the full disclaimer". On a 390px-wide phone screen this
alone brings the whole card (including the Continue button) into view without scrolling.

## Mobile layout: checklist now comes before the summary sidebar, not after
Real user feedback on an Android phone: the page felt like it opened into a bare summary
("Document readiness score", "Financial readiness", "Still missing") with nothing to actually do,
and the real starting point — "Your trip details" — was easy to miss below the fold ("I almost got
lost until I scrolled down"). Root cause was a deliberate but, per this feedback, backwards mobile
CSS rule (`.sidebar { order: -1 }`) that flipped the summary above the checklist specifically on
narrow screens, even though the underlying HTML already has the checklist first. Removed the
override — mobile now uses the same natural reading order as desktop (checklist, then summary).

## Third real client passport photo tested — found and fixed two more MRZ/date-reading gaps
A different client's own passport photo (two facing pages in one shot, heavier background
texture/noise than earlier test files) came back "Limited read" with nothing detected at all,
despite the MRZ and printed dates both being legible in the source photo. Reproduced against the
real file and found two separate, real gaps:

1. `findMrzLinesWithIndex` only ever kept the *last* line on the page that matched the strict
   `^P<COUNTRY...` pattern, and required that match to start at position 0 with no tolerance for a
   stray leading character. On this file, an unrelated garbled OCR line from the signature area
   happened to also match the pattern (shadowing the real MRZ line further down), and separately, a
   stray leading character (a misread border rule) made the real MRZ line fail the strict `^P`
   anchor even though the rest of it read perfectly. Fixed to tolerate a couple of leading junk
   characters, and to try every matching candidate line in order rather than trusting whichever
   matched last — normalizeMrzLine's existing length check is what actually tells a real ~44-char
   MRZ line apart from a coincidental shorter match.
2. The bilingual date fix from the entry below only covered the "10 JUL / JUIL 34" shape (slash
   between the two languages, day and month space-separated). This file's OCR came back as "5OCT
   OCT 27" instead — day and month glued together with no space, no "/" between the two language
   words, and a "0" digit standing in for the letter "O" (classic OCR confusion). Loosened the same
   regex further to tolerate all three at once.

Net result on this file: badge went from "Limited read" (nothing detected) to "Needs attention",
with expiry, passport number, and full name now correctly read and cross-checked against the
printed page — only the date of birth still had one genuinely misread digit, which is exactly the
kind of thing "Needs attention" is supposed to flag for a manual double-check, not something to
paper over.

## Fixed a second, different passport-scan false negative: 2-digit-year printed dates weren't matched at all
A direct JPEG upload of an otherwise clearly legible passport photo came back "Limited read" with
"Expires: not detected" — a different bug from the CamScanner one above, on a different upload path
(direct image, not PDF). Root cause: this passport (like most Nigerian and other ICAO-format
passports) prints its dates bilingually with only a 2-digit year, e.g. "10 JUL / JUIL 34" — and the
free-text date fallback (`extractDates`, used when the MRZ itself doesn't fully read) required a
4-digit year and no interrupting second-language word, so it silently never matched this date at
all, despite OCR having read it correctly.

Fixed `extractDates` to accept a 2-digit year and tolerate the bilingual "/ OTHERLANG" word in
between. That alone introduced a real regression caught during testing: blindly treating every
2-digit year as 20xx turned a misread birth year ("88") into a bogus expiry of 2088, which (being
even further in the future) silently overrode the correct 2034 expiry. Fixed by only accepting the
2000s reading when it lands in a plausible near-present/near-future window (passports are valid at
most ~10 years) or when the text nearby explicitly says "expiry" — otherwise it falls back to the
1900s, which is what a birth year needs.

The deeper MRZ line itself (the two-line strip at the very bottom) still doesn't reliably read on
this specific photo — Tesseract's general English model consistently mis-recognizes the long "<"
filler run in the name field, even after testing multiple resolutions, contrast/grayscale
preprocessing, character whitelisting, and disabling its dictionary bias. That's a genuine OCR
accuracy limit, not a bug in this app's code, and is left as a known limitation — "MRZ checksum"
correctly shows "not detected" (not a false pass) when this happens, and no longer blocks the
overall badge from reaching "Checks passed" when the expiry and any typed name are otherwise
consistent.

## Added a "Send feedback" link in the footer
A plain `mailto:` link next to Privacy/Terms, pre-filled with a subject and a short prompt
(what worked, what was confusing, what's missing). Deliberately not a form service or any kind
of network call — nothing is sent unless the person actually presses send in their own mail app,
which keeps it consistent with the app's "nothing leaves your device" privacy stance. No CSP
changes needed since it's a plain link, not a fetch/XHR.

## Actual root cause of the "Limited read" passport scans found: a scanner watermark was tricking the text-layer check
The self-hosted OCR engine and the higher render resolution below were both real, worthwhile
improvements — but neither was the actual cause of a client's passport PDF (a CamScanner export)
consistently coming back "Limited read," expiry/MRZ both "not detected," reproduced reliably in
an automated end-to-end test against this exact file. Instrumented the real scan pipeline
directly (not a simulation) and found it: CamScanner embeds the photographed passport page as a
pure image with NO real text layer, but adds one short text caption to the page — "Scanned with
CamScanner" — as actual selectable text. The PDF-scanning code's check for "does this PDF already
have a usable text layer" was `if (text.trim())`, i.e. any non-empty text at all. That one-line
watermark satisfied it, so the app treated the PDF as already having real text, fed just that
24-character watermark into the passport reader, and never ran OCR at all — even though the
document itself would have read perfectly (confirmed: once OCR was forced to actually run against
this exact file, it correctly found all 4 MRZ checksums and the right expiry date). Fixed by
requiring a substantial amount of text (>200 chars) before trusting a PDF's embedded text layer
over OCR — the same threshold the bank-statement reader below already used for the identical
"real text layer vs. scanned image" decision, just not applied consistently to the passport path
until now. Verified end-to-end against the client's actual file: badge changed from "Limited
read" to "Checks passed," 4/4 MRZ digits matched, correct expiry detected. This is likely the
single most impactful fix among today's OCR-related work, since CamScanner and several other
popular phone scanning apps commonly add similar short caption/watermark text to otherwise
image-only PDFs.

## Self-hosted Tesseract.js (OCR engine) — removes another CDN dependency
Independent of the root-cause fix above, this is real defense-in-depth: Tesseract.js's own
default configuration silently pulls its WASM core and OCR language data from cdn.jsdelivr.net,
with no integrity check on either — unlike a `<script integrity="...">` tag, a corrupted or
inconsistent fetch here wouldn't fail loudly, it would just quietly feed Tesseract bad data. This
is the same class of risk already confirmed real for pdf.js and cdnjs (see below). All of
Tesseract's files — the main library, worker script, both WASM core variants (SIMD and non-SIMD,
since which one a browser needs is feature-detected at runtime), and the English language data —
now ship from our own `/vendor/` directory instead of cdnjs or jsdelivr. Tightened `_headers`
accordingly: cdnjs is now only referenced for SheetJS/xlsx, and jsdelivr/tessdata.projectnaptha.com
are no longer in the CSP allowlist at all.

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
