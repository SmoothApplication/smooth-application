# Monetization Strategy — draft

Three plausible revenue paths, in the order I'd actually pursue them. None require the full
backend build on day one — each can start as a small, cheap test before you commit real
infrastructure spend.

## 1. Freemium backend features (most direct, but wait for demand signal)

The free core stays free forever — that's the trust foundation. A paid tier unlocks the backend
features already scoped in the pitch summary: automated email reminders, an emailed final report,
and (later) live flight pricing.

- **Why this order:** these are literally the features users already asked for, so the demand
  signal already exists in the feedback batch — the open question is willingness to pay, not
  interest.
- **How to test cheaply first:** before building the backend, add a simple "Notify me by email
  when [X]" waiting-list form (just collects an email address + which feature they want) on the
  free version. If a meaningful fraction of users sign up, that's a much cheaper demand signal
  than building the whole thing. Note this itself needs a lightweight backend (or a third-party
  form tool) — much cheaper than the full reminder system.
- **Rough pricing shape to test:** a small one-time fee (e.g. ₦1,000–2,000) for a bundle of
  reminders + emailed report per application, rather than a recurring subscription — most
  applicants use a tool like this once or twice a year, so subscription pricing is a mismatch for
  this user behavior.

## 2. B2B: license the checklist logic to travel agents / education consultants

Nigerian travel agencies and study-abroad consultants currently walk clients through this same
document-prep process manually, often client-by-client over WhatsApp. A white-label or
co-branded version of this tool (their branding, your engine) could save them real time.

- **Why this could work:** it targets people who already do this for a living and would value
  time saved, rather than a one-time consumer who's price-sensitive.
- **How to test cheaply first:** before building any multi-tenant/white-label infrastructure,
  approach 3–5 travel agents or consultants directly, show them the current tool, and ask if
  they'd pay a flat monthly fee to use it (as-is, even without their branding) with their clients.
  Their answer tells you whether this path is worth building for.
- **Rough pricing shape to test:** a flat monthly fee per agency (not per client), since agencies
  will want predictable costs.

## 3. Referral relationship with regulated advisers

The tool already tells complex/refused-case users to see an OISC-registered (UK) or
RCIC-registered (Canada) adviser. That's a natural, already-happening handoff.

- **Why this could work:** it monetizes exactly the users the free tool can't fully help (complex
  cases), rather than competing with your own free product.
- **How to test cheaply first:** find one or two regulated advisers willing to take referrals and
  agree informally on a finder's-fee or revenue-share arrangement, before building any formal
  matching/referral infrastructure.
- **Caution:** referral fee arrangements with regulated professionals can themselves be subject to
  regulatory rules (e.g. OISC/RCIC conduct rules on referral fees) — confirm with the adviser and,
  ideally, a lawyer before formalizing this, especially before it's built into the product as a
  paid feature.

## What I'd avoid for now

- A recurring subscription for the free core product — it breaks the trust positioning that's
  gotten you this far, and doesn't match how often any one person applies for a visa.
- Selling or monetizing data in any form — this directly contradicts the privacy promise that is
  the product's main differentiator.
- Building the full backend (all three deferred features) speculatively, before any of the three
  paths above has a real signal behind it.
