# Smooth Application

A free, private, single-file visa document-readiness checklist for Nigerian applicants preparing a **UK Standard Visitor visa** or a **Canada visitor visa (TRV)**.

Live: https://smooth-application-visa.netlify.app

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

Currently deployed by dragging `index.html` onto [Netlify Drop](https://app.netlify.com/drop).
Because it's a single static file, any static host works (Netlify, Vercel, GitHub Pages, Cloudflare Pages).

## Analytics (off by default)

The app can optionally report **anonymous, aggregate** usage counts (e.g. "a session reached the
review step") via [GoatCounter](https://www.goatcounter.com) — a privacy-first analytics service
with no cookies and no personal data collection. It ships **disabled**.

To turn it on:
1. Create a free GoatCounter account (no credit card needed).
2. Open `index.html`, find `var ANALYTICS_SITE_CODE = '';` near the top of the `<script>` block,
   and put your site code between the quotes.
3. Redeploy.

No document content, filenames, names, or answers are ever sent — only event names like
`reached_review` or `doc_scanned:passport`. See the comment block above `ANALYTICS_SITE_CODE` in
`index.html` for the full list of tracked events.

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
