# Smooth Application

A free, private, single-file visa document-readiness checklist for Nigerian applicants preparing a **UK Standard Visitor visa** or a **Canada visitor visa (TRV)**.

Live: https://smoothapplication.github.io/smooth-application/ (primary — this is the link to share)

Also mirrored at https://smooth-application-visa.netlify.app (secondary/backup — deployed manually, kept in sync less often since Netlify's free-tier build minutes are limited; don't rely on this one being current)

## What this is

The entire product is one self-contained HTML file (`index.html`) — no server, no database,
no accounts. Everything runs in the visitor's own browser:

- **OCR / document reading** — [Tesseract.js](https://github.com/naptha/tesseract.js) (loaded from a CDN at runtime)
- **PDF parsing** — [PDF.js](https://mozilla.github.io/pdf.js/) (loaded from a CDN at runtime)
- **Spreadsheet export** — [SheetJS / xlsx](https://sheetjs.com/) (loaded from a CDN at runtime)

Files a user attaches (passport, bank statements, refusal letters, etc.) are **never uploaded
anywhere** — they're read and discarded entirely client-side. This is the product's core privacy
promise and should be preserved in any future change.

## Running it locally

There's no build step. Open `index.html` directly in a browser, or serve the folder with any
static file server, e.g.:

```bash
python3 -m http.server 8000
# then visit http://localhost:8000/index.html
```

## Deploying

**Primary: GitHub Pages.** Auto-deploys from this repo's `main` branch — push (or upload via
GitHub's web UI) and the live site at https://smoothapplication.github.io/smooth-application/
updates within a minute or two. No build step, no manual redeploy needed. This is the link to
treat as authoritative.

**Secondary/backup: Netlify.** Deployed manually by dragging the built folder onto Netlify's
Deploys tab. Kept around as a fallback, but updated less often (Netlify's free-tier build minutes
are limited, so routine updates are pushed to GitHub Pages only unless there's a specific reason
to also update Netlify).

Because it's a single static file, any static host works (Netlify, Vercel, GitHub Pages, Cloudflare Pages) —
GitHub Pages was chosen as primary since it has no bandwidth/build ceiling to worry about at
current or expected traffic levels.

## Analytics (currently ON)

The app reports **anonymous, aggregate** usage counts (e.g. "a session reached the review step")
via [GoatCounter](https://www.goatcounter.com) — a privacy-first analytics service with no cookies
and no personal data collection. Currently **enabled**, reporting to the `smoothapplication`
GoatCounter site.

To turn it off: open `index.html`, find `var ANALYTICS_SITE_CODE = 'smoothapplication';` near the
top of the `<script>` block, and set it to `''`. Redeploy. (To point it at a different GoatCounter
account instead, put that account's site code between the quotes.)

No document content, filenames, names, or answers are ever sent — only event names like
`reached_review`, `session_view:<step>` (fires once per session per visit, so drop-off between
specific steps of the form is visible), or `doc_scanned:passport`. See the comment block above
`ANALYTICS_SITE_CODE` in `index.html` for the full list of tracked events. The in-app "Privacy"
disclosure (footer link) and this README should both be updated together if this setting ever
changes — a previous version of the in-app disclosure text drifted out of sync with this setting
for a while before being caught and fixed to compute itself from `ANALYTICS_SITE_CODE` instead.

## Project documents

See `/docs` for the business-side documents that accompany this codebase:

- `docs/privacy-policy-draft.md` — draft Privacy Policy (needs lawyer review before publishing)
- `docs/terms-of-service-draft.md` — draft Terms of Service (needs lawyer review before publishing)
- `docs/ip-ownership-notes.md` — open questions on IP ownership to resolve before taking investment
- `docs/monetization-strategy.md` — draft revenue paths
- `docs/distribution-plan.md` — draft go-to-market / distribution plan
- `CHANGELOG.md` — feature history to date

## Status

- ✅ UK Standard Visitor visa — live
- ✅ Canada visitor visa (TRV) — live
- 🚧 US, Schengen, South Africa, Australia, China — placeholders only, not yet built (see `COUNTRIES` object in `index.html`)

## License / ownership

No open-source license is included on purpose — see `docs/ip-ownership-notes.md`. Do not publish
this repo publicly or add a permissive license without deciding on that first.
