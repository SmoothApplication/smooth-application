# Privacy Policy — DRAFT

**Status: draft for lawyer review. Do not publish as-is.** This describes what the product
actually does today, in plain language, so a lawyer can turn it into a compliant policy (Nigeria
NDPR, and UK/Canada equivalents if you have users physically located there matters for GDPR-style
rules). Update this document every time the product's data practices change — it should never
describe something the code doesn't actually do, or omit something it does.

## Summary

Smooth Application is designed so that almost nothing about you ever leaves your device. This
policy explains the few exceptions.

## What we do NOT do

- We do not have a server that receives your documents, your passport photo, your bank
  statements, or any file you attach. All scanning and reading of documents happens using code
  that runs in your own browser.
- We do not require or offer account creation. There is no login, no password, no user database.
- We do not send your email address or phone number anywhere. The "Validate your International
  Passport" session has optional email/phone fields (added so you can be reached about your
  application, once a follow-up feature is built) — if you fill them in, they're saved locally the
  same way the rest of your answers are (see "Local save" below) and are never transmitted. *[This
  bullet needs updating again the moment any reminder/follow-up feature actually starts sending
  this data off the device — see the CHANGELOG entry for when these fields were added.]* The
  "email myself this summary" feature separately opens a draft in your own email app using the
  `mailto:` link scheme — we never see that either, and it is never sent through any server we
  control.
- We do not sell or share data, because we do not collect the kind of data that could be sold or
  shared in the first place.

## What we do

- **Local save.** Your answers (trip dates, checklist ticks, etc.) are saved automatically in
  your browser's local storage, on your device only, so you can close the tab and come back later
  on the *same device and browser*. This is never transmitted anywhere. You can clear it at any
  time by clearing your browser data, or via the in-app reset option.
- **Third-party libraries loaded from a CDN.** To read documents and generate spreadsheet
  exports, the page loads three open-source JavaScript libraries (Tesseract.js for OCR, PDF.js
  for PDF parsing, SheetJS for spreadsheet export) from public content-delivery networks when you
  use those features. Loading these libraries involves a request to that CDN (standard for any
  website using third-party scripts) but does not involve sending your documents anywhere — the
  libraries run locally in your browser once loaded. *[Lawyer note: confirm which CDNs are used
  today and list them by name here, since "a CDN" isn't specific enough for a real policy.]*
- **Aggregate analytics — currently ON.** The product reports anonymous, aggregate usage counts
  (e.g. "a session reached the review step," "a passport was scanned") via
  [GoatCounter](https://www.goatcounter.com), a privacy-focused analytics service that does not
  use cookies and does not collect personal data. No document content, filenames, names, dates, or
  answers are ever included in these events — only event names and counts (see the comment block
  above `ANALYTICS_SITE_CODE` in `index.html` for the full list of tracked events). This currently
  reports to the `smoothapplication` GoatCounter account, and can be switched off entirely by
  clearing the `ANALYTICS_SITE_CODE` value in the code. *[Lawyer note: link to GoatCounter's own
  privacy policy here, and confirm this section's wording satisfies what NDPR/GDPR require for
  this kind of aggregate, cookie-free analytics — it may still count as "processing" even without
  cookies or personal data.]* If this is ever turned off again, update this bullet back to
  reflect that.

## Documents you attach

Any file you attach (passport, bank statement, refusal letter, etc.) is read directly in your
browser's memory to extract text and images for the on-screen check, and is not retained by the
app after your session ends (subject to whatever your own browser/OS does with temporary files,
which is outside our control). It is never uploaded to a server we operate.

## Not immigration advice

This tool is a personal preparation aid, not a regulated immigration advice service, and does not
verify that a document is genuine. See the in-app disclaimers and the accompanying Terms of
Service draft.

## Children

This tool is intended for use by adult applicants preparing their own or their family's
application; it is not directed at children as independent users.

## Changes to this policy

[Lawyer note: add your standard "we may update this policy" language, an effective date, and a
contact method once you've decided on a business email/entity.]

## Contact

[Add a real contact email/entity once the business is registered — see `ip-ownership-notes.md`.]
