# IP & Ownership Notes — for lawyer review before taking investment

This is not legal advice — it's a plain list of the ownership questions worth resolving with a
lawyer before signing any investment agreement, so you go into that conversation knowing what you
don't yet know.

## 1. How this was built

The code in this repository was written collaboratively: you directed the product decisions,
tested it against your own real documents, triaged and prioritized user feedback, and made every
call on scope and tradeoffs (e.g. choosing the free/on-device approach over paid KYC vendors) —
and an AI assistant (Claude, via Anthropic's Claude Code / Cowork product) wrote the actual code
and documents to your direction, across a series of conversations.

**Open question for a lawyer:** copyright treatment of AI-assisted work is still an evolving area
and varies by jurisdiction. Some things worth getting a clear answer on:
- Whether your role (direction, requirements, testing, selection/arrangement of features) is
  sufficient for the output to be treated as your copyrighted work in your jurisdiction (Nigeria)
  and in the jurisdictions of your visa markets (UK, Canada).
- What Anthropic's own terms of service say about ownership and commercial use of outputs
  generated through their products — read the terms that applied to the specific product/plan you
  used, since terms can differ between consumer and commercial tiers. Don't assume; check the
  actual current terms at the time of your usage.
- Whether it's worth having a human developer review/re-author key portions of the codebase going
  forward, both for engineering-quality reasons and to strengthen the "human authorship" story if
  that matters for the ownership question above.

## 2. Third-party open-source dependencies

The product loads three open-source libraries from public CDNs at runtime:
- **Tesseract.js** (OCR)
- **PDF.js** (PDF parsing)
- **SheetJS / xlsx** (spreadsheet export)

**Open question for a lawyer:** confirm the exact license of each (they are generally permissive —
Apache 2.0 / MIT-family — but SheetJS in particular has had different license terms across
versions, and some come with attribution requirements). Confirm you're compliant (e.g. required
attribution/notices) before any commercial launch, and pin exact versions/sources so this is
auditable later.

## 3. No LICENSE file (on purpose)

This repo intentionally does not include an open-source license. Do not add one (e.g. MIT,
Apache) without deciding first whether you want this codebase to be publicly reusable — given the
plan to seek investment and monetize, you likely want "all rights reserved" (proprietary) by
default until a lawyer and any co-founder/investor agree otherwise.

## 4. Business entity

There is currently no registered company. Before accepting any investment:
- Decide on and register a legal entity (Nigeria and/or elsewhere, depending on advice) that will
  actually hold the IP, the domain, and the Netlify account.
- Make sure ownership of the code, the `smooth-application-visa.netlify.app` domain/site, and any
  future trademark (the "Smooth Application" name) is assigned to that entity, not left as your
  personal property outside the company — this is a standard step investors will expect, and
  cleaner to do before money changes hands than after.

## 5. Trademark

"Smooth Application" does not appear to be a registered trademark. Worth a quick search/clearance
check before investing further in the brand name, and before it appears on marketing materials
sent to third parties (like the pitch summary already shared).
