# Changelog

Development milestones to date, grouped by feature batch rather than exact dates (this repo's
git history starts from the current state — see `docs/ip-ownership-notes.md` for why).

## Softened Session 2's country-visit language to remove eligibility-prediction phrasing

Resolves the standing lawyer note in `docs/terms-of-service-draft.md`: the Travel Experience
grading summary used to say things like "very good prospect for another Schengen or other-country
visa," "that travel history works in your favor," and "✅ Success: you are qualified for the next
level" — phrasing that reads as a prediction of visa outcome, in tension with this tool's own "does
not assess your individual eligibility... or guarantee any outcome" disclaimer. This had been
flagged before the section was built; the product owner initially chose to keep it as specified,
accepting the risk pending review. On review, asked for it to be softened. Now reads as
informational-only framing — "this is commonly seen as a positive factor," not "you qualify" — and
the closing message reads "You've completed this section. Continue to Session 3" instead of
declaring "Success"/"qualified." No behavior changed, only copy; all 60 tests still pass (one test,
`travel-experience-branching`, updated to match the new wording). `docs/terms-of-service-draft.md`
and the code comment above `updateTravelExperienceGrade()` both updated to mark this resolved.

## Internal: automated PII-leak scanner, plus one more real leak it found and fixed on its first run

Follow-up to the two PII cleanup rounds just below. Both of those were found by hand, which means
neither was a real control — just luck plus attention. Added `scripts/pii-scan.js`, which now runs
automatically in CI (a new `pii-scan` job, alongside `test`) on every push and PR, and can be run
locally with `npm run pii-scan`. It checks every tracked file — including PDF fixtures, extracted
via `pdftotext` rather than raw bytes — against a denylist of every real name/business
name/passport number already found leaking in this repo, plus warn-only structural checks for
things that *look like* a real passport, phone, or BVN number. See `docs/PII-SAFETY.md` for the
full intake policy going forward: real user data never gets typed into a committed file, fictional
or not, without being fictionalized first.

Its first run immediately found a leak both earlier manual sweeps had missed: a real applicant's
full name, real passport number, and real date of birth, embedded in
`tests/fixtures/dob-digit-misread-fixture.pdf` — invisible to a plain-text grep because PDF content
streams are compressed, so the earlier sweeps' raw-byte search never actually saw it. The same
real name and two other real third-party names (quoted in narration examples) were also still
present in two places in this changelog and in a test-file comment. Fixed:

- Regenerated `dob-digit-misread-fixture.pdf` with a fictional identity, preserving the exact bug
  mechanic under test (a birth-year digit misread that's checksum-ambiguous by exactly 5) with
  correctly recomputed MRZ check digits.
- Replaced the same real passport number where it was also quoted in a code comment in index.html.
- Replaced two real third-party names quoted in this changelog's narrative of the "RSVL"/alt-name
  investigation, and the same name where it was quoted in `tests/rsvl-reversal-spelling.test.js`.
- Added every one of these to the scanner's denylist so none of them can silently recur.

No behavior changed; all affected tests re-verified passing individually
(`dob-digit-misread-fixture.test.js`, `passport-scan-progress-refresh.test.js` — which reuses the
same fixture — and `rsvl-reversal-spelling.test.js`), full suite green.

## Internal cleanup: replaced a real business name used as a test fixture with a fictional one

Several test fixtures and code comments (added across earlier rounds while documenting real bug
reports) reused a real business name and a real church name as example/test data. Neither is a
natural person's identity, but both are real, identifiable organizations, so they've been replaced
throughout with fully fictional stand-ins ("Bright Homes Cleaning Solutions" and "Grace Covenant
Youth Church") — across 7 test fixtures, 11 test files, this changelog, and code comments in
index.html. No behavior changed; all 60 tests still pass. (Companion to the personal-name/passport
cleanup in the previous batch below.)

## Income sources breakdown split into its own tab, plus five live-bug/feedback fixes

User feedback, direct from the live site, on the freshly-split "Income & bank statement analysis"
session (see the step-tabs entry below):

- **"Income sources breakdown" is now its own, 4th tab** ("I think this page is where most
  decisions about your income is decided by the visa officer. make it a separate page.") — it
  previously shared step 3 with "Top 10 inflows" and "Top 10 most consistent senders". Now: step 1
  Upload, step 2 Cash flow & scores, step 3 Detailed reports (top inflows/senders), step 4 Income
  sources breakdown. Print styles show all four steps regardless of the active tab.
- **"Top 10 inflows" table is now collapsible** ("Make it collapsible. so that it can be user
  friendly.") — reuses the same `.report-group` collapsible pattern already used elsewhere in this
  session's reports, collapsed by default.
- **Closing balance figure now shows even with no comparison target yet** ("Closing balance figure
  from bank statement is missing.") — the "Closing balance strength" badge and its detail line used
  to hide the real, already-detected balance whenever there was nothing yet to compare it against
  (e.g. trip dates/cost not filled in). Both now show the actual detected/entered figure straight
  away, with a plain note to add trip details for a Strong/Weak verdict, instead of hiding real
  evidence behind an unrelated blocker.
- **Fixed a false "Salary" misattribution bug** ("All these are not SALARY" — flagged with the real
  recurring sender's name and payment count/total, cross-checked against the applicant's own
  manually-reconciled spreadsheet). Bank narrations typically name both sides of a transfer ("...TRF
  TO `<applicant>` FROM `<sender>`..."). The name-extraction step had no notion of which side is
  which, so the applicant's own typed name — present in nearly every inflow narration, since they're
  the recipient of every one — kept winning the "most recurring sender" vote, crowding out the real,
  distinct, actually-recurring sender and occasionally producing garbled concatenated names in the
  "Top 10 most consistent senders" table. The applicant's own name is now excluded up front,
  everywhere a "dominant sender" gets identified (the recurring-amount check, the most-frequent-
  source check, and the consistent-senders ranking).
- **Fixed the income-source explanation box collapsing while it's being reviewed** ("Once I edit the
  menu does close up back.") — after saving a reason, the box already tidies itself away to a
  one-line summary ~1.2s later by design. But if the applicant had "Show individual payment(s)" open
  reviewing the specific transactions behind their choice, that same tidy-away used to yank the box
  closed (and reset that panel) right out from under them. It now waits until the applicant closes
  that panel themselves before collapsing.
- **"What looks good" confirmations are now a real bulleted list** ("bullet each point and make
  neat. people have low attention span.") — each confirmation (e.g. the recurring-income read, the
  most-frequent-source read) now renders as its own list item instead of a stacked paragraph, so
  it's scannable at a glance.

## Income & bank statement analysis session split into step tabs

User feedback (repeated, across two rounds): this session — the one with the bank statement
upload, the editable cash-flow table, and the detailed income report — reads as "information
overload" and "clumsy". The underlying problem was structural: this one session does three
genuinely different jobs (upload data, show automatic analysis results, show a deep-dive report)
stacked in a single continuous scroll, while every other session in the flow is a short Q&A or a
checklist.

- Split into three tabs within the session — **1. Upload statements**, **2. Cash flow & scores**,
  **3. Detailed reports** — so only one job's worth of content is on screen at a time. Tabs are
  freely clickable in any order; nothing is validation-gated, since a returning applicant might
  only want to re-check the report, or might skip upload entirely and type cash-flow totals in by
  hand on step 2.
- A successful statement analysis auto-advances from step 1 to step 2, so the applicant sees the
  direct result of what they just uploaded without an extra click. Step 3's deeper report is one
  more click away rather than also auto-opened, so the page isn't jumping twice in a row.
- "Save full report as PDF" is unaffected — print styles show all three steps regardless of which
  tab is active on screen, same as before.
- The old `#statementReportGroup` collapsible wrapper (a stopgap from an earlier round of the same
  "too clumsy" feedback) is gone, replaced by step 3 itself. `.report-group` as a class lives on for
  the smaller, unrelated "show these N inflows individually" collapsible lists used elsewhere in
  this session's report output.
- Nothing about the underlying data, computation, or persistence changed — this was a structural/
  presentational change only, so all figures, scans, and cross-checks behave exactly as before.

## Three live-bug fixes on Sessions 1–3

Reported directly against the live site shortly after Sessions 1–3 shipped (see the entry below).

- **Session 1: "0% of this section filled" after a passport scan** — the passport number and
  expiry boxes were visibly auto-filled by the scan, and the Congratulations message showed, but
  the session's own progress footer stayed stuck at "0 of 2". Cause: the scan's auto-fill sets
  those two fields' values directly (no change event dispatched, and deliberately no full
  `render()` call either, to avoid orphaning the scan-result box mid-write — see the comment in
  `renderPassportCard()`), so nothing ever told the session-nav pill or footer to recompute. Fixed
  by also calling `applySessionVisibility()` right after the auto-fill, which refreshes the
  nav/footer progress text without touching the DOM subtree the scan result is being written into.
- **Session 2: travel-history date picker's year was static** — "2026 is static. it should have a
  drop down for 20 years." The native `<input type="month">` picker showed the year as plain text
  with no way to jump to a different one beyond clicking through months. Replaced with two real
  `<select>` dropdowns — Month, and Year (this year back 19 more, 20 years total, no future years,
  since travel history is always in the past). The underlying stored value is still a single
  `"YYYY-MM"` string, for export/import/autosave compatibility — the two dropdowns just get
  recombined into that same shape on change.
- **Session 3: aged-parents section couldn't handle a deceased parent** — "For some people either
  the father or mother is dead. consider this." Previously, ticking "I have aged parents I
  support" unconditionally required both a father's name and a mother's name, so an applicant with
  one deceased parent could never reach 100% filled. Added a "Father/Mother has passed away / not
  applicable" checkbox next to each name field — ticking it excuses that name from the section's
  required-field count, and disables + clears that name box so a stale name can't linger in the
  saved payload.

## Three new sessions: passport validation, travel experience, and your responsibilities

Adds three new sessions ahead of everything that already existed, per a requested session order
(Session 1 through Session 11, with the pre-existing sessions renumbered around the new ones —
nothing about the existing trip/finance/checklist/review sessions changed beyond their position).

- **Session 1: Validate your International Passport** — scan your passport's bio page and see your
  name, passport number, and expiry date filled into their own boxes; verify or correct the expiry
  date yourself. If it has more than 6 months' validity remaining (checked against today, since the
  trip's travel date hasn't been entered yet at this point in the flow), you get a "Congratulations"
  message and a prompt to move on. Reuses the exact same scan pipeline as the existing "Valid
  passport" checklist item — nothing about that scan changed, this just adds two more places its
  result gets used. The passport quick-scan widget that used to sit inline on "Your trip details"
  moved into this session, so passport scanning only happens in one place now instead of two.
- **Session 2: Travel Experience** — asks whether you've travelled outside Nigeria before. If not,
  shows a recommendation to build travel history first (Ghana, Kenya, Ethiopia, Morocco, Egypt are
  suggested, with a "Click here for more assistance" expander) — general guidance, not a
  requirement. If you have, fill in a table of countries visited (with date, reason, and days
  spent), plus a separate Yes/No for any past overstay (with its own table if so). A summary grades
  your travel history against the tiers requested — African-country count, EU-country count, major
  destinations (US/Canada/UK/China/Ireland/Singapore/another Asian country), and the specific
  South-Africa/Morocco/Kenya-without-overstay case — ending in a "Success — you are qualified for
  the next level" message once at least one country is filled in.
  - *A note on how the Yes/No question is asked*: the original spec framed this as a "1st time
    traveler: YES/NO" checkbox with the recommendation/history boxes tied to that literal wording,
    but read literally the two branches come out backward — a first-time traveller is the one with
    no history (who needs the recommendation), not the one with a table to fill in. This ships with
    the un-inverted version instead — a plain "Have you travelled outside Nigeria before?" Yes/No
    question — so "Yes" always means "show me the history table" and "No" always means "show me the
    recommendation." Flagging this plainly here rather than silently guessing.
  - *A note on this session's language*: "Congratulations," "qualified for the next level," and
    "high chance of success" read as an eligibility/outcome prediction, which sits in tension with
    this tool's own terms-of-service draft ("does not assess your individual eligibility... or
    guarantee any outcome"). This was raised before building; the product owner explicitly chose to
    keep the language as specified, accepting that risk pending a lawyer review — see the added note
    in `docs/terms-of-service-draft.md`.
- **Session 3: Your responsibilities** — married Yes/No (with spouse's name if yes), number of
  children (dropdown of 0/None through 10 — the spec asked for 1–10; 0/None was added so someone
  with no children isn't forced to pick a wrong answer), where you live (a dependent Nigerian
  state → local government area dropdown, all 36 states + FCT, plus house/street number and name),
  aged parents Yes/No (with father's and mother's names, monthly remittance amount, and a consent
  checkbox to cross-check the remittance figure against your bank statement).
- Every existing session (Your trip details, Income & bank statement analysis, Financial readiness
  calculator, the document checklist categories, Final review) is unchanged — only its position in
  the session order shifted to make room for the three new ones ahead of it.
- New progress-tracking, autosave/export/import, and reset support for all three sessions, matching
  the existing per-session pattern.

## Checklist items now tidy themselves away once ticked

User feedback: "the pages are too long" — narrowed down to individual sessions in general, not
any one specific page. A long checklist category with a lot of already-handled items was always
rendered in full (every item's full explanation and upload controls, whether it was done or not),
which made an otherwise-finished session look just as long as one still in progress.

- Same "collapse once done" treatment already used for the inflow-explanation boxes: once a
  checklist item is ticked, it tidies itself away a moment later into a compact one-line summary
  (with an "✏️ Edit" link to reopen it) instead of continuing to take up the same room as an item
  still awaiting attention.
- Unticking an item — whether from the full view or straight from the collapsed row's own checkbox
  — always snaps it back open immediately, with no delay, since that's a sign you're actively
  working on it again.
- A session restored from a previous visit (already-ticked items loaded back in) starts with those
  items already tucked away, since there's nothing new there to draw attention to; anything ticked
  live during the current session gets the short delay first, so a just-completed item is still
  visible long enough to register before it collapses.

## "Income & bank statement analysis" reads calmer before anything's been entered

User feedback, off a screenshot of the section straight after opening it, before typing or
uploading anything: "it looks too busy." Two changes, both scoped to the empty/not-yet-started
state specifically — nothing changes once real data is entered:

- The "Enter your figures" pills (Income generation, Closing balance strength — also the sidebar's
  "Financial readiness" and "Document readiness score" pills in their equivalent starting states)
  used to render in the same alarming red as a genuinely bad score, before the applicant had any
  chance to enter anything. They now use a new neutral gray style for "nothing entered yet,"
  keeping red for when something's actually wrong.
- The two intro paragraphs in this section were trimmed to one short line each, with the fuller
  explanation tucked behind a small "Why separately?" toggle instead of always taking up the room.

## Docs: the analytics code now actually contains the event list the privacy policy points to

`docs/privacy-policy-draft.md` tells a lawyer to go read "the comment block above
`ANALYTICS_SITE_CODE` in `index.html`" for the full list of tracked events — but no such list
existed in the code. Added one: every event name/pattern this file can ever send, and exactly what
each `<placeholder>` in it can be, kept next to the analytics code itself so it has to be updated
in the same place any new tracked event gets added. No behavior change — this is documentation
only, added while looking into a separately-reported (and, on investigation, unfounded) concern
that a passport quick-check widget wasn't recording its "attempted" event: tracing the actual code
path showed that's structurally impossible (the "attempted" event always fires synchronously
before the "scanned" one, from the same function, for every entry point that scans a passport) —
the real explanation was almost certainly two analytics numbers read off different date ranges,
not a tracking gap. Nothing to fix there; noting it here so it isn't re-investigated later as if it
were still open.

## The "explained inflows" and itemized matched-inflow lists can now be collapsed once done

Real feedback, off screenshots of a fully-completed "All 7 inflow(s) explained" list and a 28-item
itemized business-inflow list: once everything in one of these lists has been reviewed, it just sits
there taking up the same amount of room it did while there was still real work to do — worse the
longer the list (a business with dozens of matching inflows, for example).

Each individual inflow already tidied itself away to a one-line summary once explained; now the whole
list does too. The "needs an explanation" list gains a collapsible toggle the moment every inflow on
it has actually been explained (it stays as it always has until then — nothing to hide while there's
still real work left). The itemized matched-inflow list is pre-tagged automatically, so each declared
employer's or business's group of inflows normally gets its toggle immediately. Both start OPEN, so
nothing looks different the moment they finish — the toggle just gives the option to tuck a long,
already-confirmed list away.

## Analytics: new event to pinpoint where the bank-statement upload step loses people

Real-world usage data showed a big drop-off between opening "Income & bank statement analysis" and
actually attempting a statement analysis — most people who open that section never get as far as
clicking "Analyze." The existing analytics couldn't tell whether that's because people never pick a
file at all, or pick one and then stop before clicking Analyze.

A new anonymous event, `stmt_file_selected`, now fires the moment someone chooses a bank statement
file — never the filename or its contents, just that a choice happened, same privacy rule every
other event on this site already follows. Comparing this against the existing `session_view:finance2`
and `statement_analysis:attempted` counts will show which side of that gap people are actually
getting stuck on.

## Fix: "Your trip details" could read 100% filled while "Work status" still sat unanswered

Real report, with a screenshot: the "Your trip details" session showed "100% of this section filled
(5 of 5)" with every visible field green, while the "Work status" dropdown right there on the same
page was still sitting on its unselected "Select your status…" placeholder.

The progress calculation for this session only ever counted 5 specific fields (name, purpose, travel
date, return date, application date) — "Work status" was never one of them, even though it lives in
the same card and everything below it (whether an employer or business name is required, whether
student-sponsor or child-related documents get requested) depends on it being answered. This is the
same bug class as an earlier fix for the employer/business name fields in this same session: a
required-looking field could sit empty while the session claimed to be fully done.

"Work status" is now counted alongside the other 5 fields, so this session can no longer read 100%
until it's actually been answered.

## Fix: a genuine passport now passes its checksum check even when its name line reads badly

Real report: a passport photo came back "MRZ checksum: not detected" even though the document was
completely genuine — the applicant's name and other details all read and displayed correctly. Tracing
the actual photo through the on-device OCR pipeline showed why: the machine-readable zone's first line
(the small, dense name line, often sitting right over a background security pattern) read as pure
garbage, while its second line — mostly digits, generally much easier to OCR cleanly — came back a
perfect, checksum-valid line. The checksum check only ever needs that second line, but the old code
required successfully reading BOTH lines together before it would even look at the checksum, so a bad
read of the name line alone threw away a perfectly good one.

Now the checksum check also looks for a stand-alone, correctly-shaped second line anywhere on the page
when the two-line read fails, and only trusts it once that candidate's own check digits confirm it's
the real thing — not just an unrelated OCR line that happens to be the right length and shape.

## Fix: a statement whose column positions shift partway through the file could flip debits to credits

Off a real, very large (168-page) wallet-style statement: its transaction table's column positions
actually differ between an earlier and a later part of the same file, as if two separate exports had
been combined into one PDF. The statement analyzer used to detect column positions once, from
whichever matching header it found first anywhere in the document, and apply that single set of
positions to every row in the whole file — so once it locked onto the later section's (different)
positions, amounts on the earlier section's rows got compared against the wrong column and some
transactions were silently misclassified. Column detection is now aware that a document can contain
more than one such header, and matches each row against whichever header actually applies to that part
of the file.

That statement's very first page also wraps one of its three column headers onto its own line, one
row apart from the other two — a shape the existing same-line-only detection (added specifically to
reject a different real false-positive, an account-summary info box whose labels look superficially
similar) couldn't see at all. Detection now also recognizes a header split across a couple of
neighboring lines, gated on the three matched positions being genuinely spread apart in the correct
left-to-right order — an info box's stacked, single-column labels can't satisfy that, so the original
fix stays intact.

Not yet resolved on that same statement: a number of individual rows where the statement shows an
explicit "--" for whichever side (debit or credit) had no amount that transaction, rather than a real
zero. Which side the one remaining number belongs to turned out not to be reliably readable from its
on-page position either — a short, right-aligned value like "50.00" can render tens of points away
from its own column, closer to the neighboring one, the same alignment quirk already known to affect
wider statements. A position-based fix for this was tried, confirmed to fix the wallet statement, but
also confirmed (against a separate real statement that previously reconciled exactly) to flip small,
genuine debits to credits elsewhere — so it was not shipped. This remains open.

## Fix: cleaned up garbled transaction descriptions on statements with multi-line narrations

Validated the whole statement-analysis pipeline against a real, independently-successful visa case —
a full 6-month, 700+ transaction statement, run through the app and checked line-by-line against the
same applicant's own manually-built breakdown. The core numbers held up exactly: total credits, total
debits, and closing balance all matched the statement's own printed summary to the kobo, and the
recurring-salary detector correctly isolated the real monthly figure. That's a strong result on its
own, but it also surfaced two real display bugs worth fixing before leaning on this further.

First: some statement layouts put a transaction's date and amount on one line but its actual
description entirely on a separate, wrapped line below — previously, the code building that
transaction's displayed narration started from the (empty) original line, so what showed up in the
"explain this payment" box was either the raw, duplicated date/amount text, or in some cases the real
description shown twice over. Descriptions are now rebuilt from just the row's own text cells plus
any genuinely wrapped continuation text, so what an applicant sees quoted back to them is a clean,
readable description — never a jumble of repeated dates and figures.

Second: a few statement formats print footer text (an app download prompt, a head-office address)
in the same position a wrapped narration line would normally be, with no date and no amount of its
own — so it looked exactly like leftover description text and got silently absorbed into whichever
nearby transaction's narration. That boilerplate is now recognized and skipped, the same way page
numbers and "continued" markers already were.

## New: a second, independent financial-readiness check — income, not just savings

User feedback, from someone who has personally helped many applicants prepare UK visa financial
evidence over the years: reviewers have refused applicants who technically had enough money sitting
in the account (the app's existing 2× funds/closing-balance buffer) but whose actual income barely
covered the trip cost — reasoning, drawn from a real refusal letter, that the applicant would be
spending essentially their entire income on a vacation with nothing left for rent, bills, school
fees, and the family they're clearly still supporting. Their own rule of thumb, built from years of
real outcomes: aim for annual income at least 4× the estimated trip cost.

The financial calculator now checks this too, as a companion to (never a replacement for) the
existing funds buffer — over the same 6-month window the cash-flow table already asks for, 4× annual
income works out to a 2× buffer on 6-month inflow, so it reuses the exact same "2×" language and
multiplier already used elsewhere, reading as one consistent rule rather than a second, differently-
calibrated one. It only appears once the full 6 months of the cash-flow table are filled in — a
partial window can't be honestly scaled up to a 6-month claim without either over- or under-stating
it, so it stays hidden rather than showing a shaky number. For self-employed applicants whose income
and non-income company transactions (reimbursements, purchases) both route through the same personal
account, the warning message says so directly — a good reminder that the underlying six-month figures
need to be genuine salary/allowance, not everything that hit the account.

Deliberately NOT included: an automatic classifier that guesses which credits are "real" income vs.
a business reimbursement or purchase. A real example off this exact feedback showed why that's not a
job for a keyword rule — two blank-narration credits from the same company to the same person, only
resolved by a phone call, turned out to be two different things: one was a genuine bonus (real
income), the other was an office-expenses reimbursement (not income). The app's existing "flag
unexplained inflows and ask the applicant to categorize them" feature already handles exactly this
kind of judgment call the right way — surface it, don't guess it — so this stays as-is rather than
trying to automate something that, by this feedback's own evidence, can't be reliably automated.

## Fix: bank/loan system codes and split-month salary narrations no longer masquerade as a "sender"

Proactive follow-up to the First Bank column-collision fix below, digging further into the same real
statement: even with the numbers now correct, "Most frequent inflow source" was reporting the nonsense
name "Pdc Loan Disbural...Fmobampc" — a loan-servicing system/product code, not a person or company.
Two compounding causes, both fixed. First, real recurring salary narrations from that statement's
payroll processor ("NEFT FROM:SAL FEB 26 LNSC", "...SAL MAR 26 LNSC", ...) embed the month name right
in the middle of the text, so every month's salary read as a different "sender" and never accumulated
enough of the same name to be recognised as recurring — while an unrelated, lower-count cluster of
loan-servicing codes won by default instead. Second, those loan-servicing codes ("PDC", "LOAN",
"DISBURAL", "FMOBAMPC", and related fee/interest/repayment terms) weren't filtered as bank jargon the
way channel codes like "NIP"/"TRF" already are. Both are now added to the narration stopword list, so
a statement in this format either surfaces a real, human-readable sender or honestly says it couldn't
find one — never a system code dressed up as a name. New regression test with a fictional statement
reproducing the same pattern (a louder, more frequent loan-code cluster against a real recurring
employer) confirms the real sender wins.

## Fix: a real First Bank statement was silently misreading every debit as a credit

User report, with a real (unprotected) First Bank statement to reproduce it against: the statement
parsed "successfully" — 158 transactions detected — but the numbers were wrong throughout, and the
"most frequent inflow source" came back as the nonsense name "Transaction S". The real cause: First
Bank's account-summary info box prints its own labels — "Pending Debit:", "Available Balance:",
"Total Credit:", "Total Debit:" — as a label column, each on its own row but all sharing the exact
same x-position. Each one independently matches one of the debit/credit/balance column-header
keywords the parser looks for, and matching them across separate rows (rather than requiring all
three appear TOGETHER on one row, the way a genuine table header always does) wired the whole
statement's debit/credit/balance detection up to that label column instead of the real transaction
table further down the page — recording every row's running balance as its credit amount. Now fixed
by requiring the three column labels to co-occur on the same physical line. Verified against the
real statement: total credits, total debits, and the final balance now match the statement's own
printed totals exactly (₦1,280,568.07 / ₦1,280,508.10 / ₦153.11).

## Fix: password-protected bank statements now get a clear, actionable message instead of a generic one

User report: an applicant with a First Bank account uploaded their statement and got the same
"couldn't detect transaction rows — the format may be unusual" message a genuinely unsupported bank
format would show. The real cause was different and much simpler: the PDF was password-protected (a
default many Nigerian banks ship with), and pdf.js's specific "needs a password" error was being
silently swallowed, so nothing distinguished it from an unfamiliar layout. Both the personal and
business statement-analysis flows now recognise this specific error and say so by name — which
file is affected, why nothing leaves the browser to try passwords against it, and concrete next
steps (most banking apps offer an unprotected re-download; otherwise, opening the PDF with the
password and using "Print to PDF"/"Save a copy" produces an unprotected version to upload instead).
If one file in a multi-file upload is protected but others parse fine, that's now called out too,
instead of just silently contributing nothing to the analysis.

## Fix: bank statements whose Date column wraps onto two lines now parse correctly

User report, with a real "ALAT by WEMA" statement to reproduce it against: uploading it returned
"couldn't automatically detect transaction rows" even though the PDF had a completely normal-looking
transaction table. The cause: that statement's Date column is rendered narrow enough that each date
wraps within its own cell — e.g. "05-Feb-" on one line and a bare "2026" appearing several lines
later — while the transaction's actual reference/narration/amount data sits at a different
y-position sandwiched between the two date fragments, with no date of its own. The parser requires
every transaction row to start with a date, so every single row in the statement was silently
rejected. A new merge pass now detects this exact split-date pattern and reassembles it before the
rest of the pipeline runs, so statements in this format parse normally — confirmed against the real
statement (130 transactions across 7 months, previously 0).

## Fix: passport photos from low-end phones now read reliably, and the name auto-fills again

User report, with an actual passport photo to reproduce it against: a passport photographed on a
modest phone camera came back "MRZ checksum: not detected," and the applicant's name never
auto-filled — even though the photo was perfectly legible to a person. Replaying the real photo
through the scanner traced this to two compounding issues, both now fixed. First, the OCR itself:
a lower-resolution, lower-contrast phone photo is exactly what trips up text recognition on the
MRZ's small, dense print, so every scan now runs through a preprocessing pass first — upscaling a
small image so there are more real pixels to read from, and a contrast stretch (not a hard
black/white threshold, which would misfire on the uneven lighting a phone photo commonly has)
— before Tesseract ever sees it. Second, and the bigger factor in this specific case: the MRZ's
trailing padding read as a handful of stray characters instead of clean filler, landing a few
characters short of the expected length — comfortably within what should be readable, but outside
the old tolerance for that check, so an otherwise-perfectly-good read got silently thrown out
altogether. That tolerance is now wider (still well clear of a past false-positive case it was
guarding against), and the line no longer needs to already be spotless before its own cleanup step
gets a chance to run. Same fix applied everywhere this app runs OCR — passport/document scanning
and photographed bank statements alike.

## Fix: closed the same silent-failure gap in business-statement analysis and document scanning

The recent fix that stopped personal bank-statement analysis from failing silently (see below) only
covered that one flow — three close relatives had the identical gap and didn't get touched at the
time. All three are now covered the same way: business bank-statement analysis (used by self-employed
applicants to show a personal salary/drawing from their business), single-document scanning (the
passport reader and every other "Scan (beta)" checklist item), and its multi-file variant. Each now
has a safety-net error handler so a bug partway through — an unfamiliar statement layout, a corrupted
scan, anything unforeseen — shows a plain-language message and a one-tap way to report it with real
context, instead of leaving the "Loading…" message stuck on screen with no explanation. Business
statement analysis also gets the same "no transaction rows detected" reporting path already added to
its personal-statement twin, plus attempted/completed tracking so its failure counts become an actual
rate, matching what personal statements already had.

## New: statement analysis now tracks attempts, not just failures

The existing anonymous, aggregate analytics (off by default; see the block near the top of the
script for how to opt in) already counted specific statement-analysis failures — "couldn't detect
any transaction rows," "analysis tools failed to load," and the newly-added catch-all errors — but
had no count of how many analyses were actually ATTEMPTED. A failure count on its own can't say
whether it's rare or common. Two new events close that gap: `statement_analysis:attempted` fires
once a real analysis begins (after the file-count/size checks pass), and
`statement_analysis:completed` fires once results are successfully rendered — together they turn
the existing failure counts into an actual failure rate. Same privacy stance as everything else
here: anonymous, aggregate, opt-in, never a filename, a document, or an answer.

## New: statement-analysis failures now surface a message and a way to report them, instead of failing silently

Until now, if anything went wrong partway through reading a bank statement — a bug triggered by an
unfamiliar layout from a bank this tool hasn't been tested against, for instance — the "Reading
file(s)…" message just sat on screen forever. Nothing told the applicant anything had gone wrong, and
the only place it was recorded at all was as an anonymous, undifferentiated error count, with no way
for anyone to actually flag what happened. Two changes: (1) the whole statement-analysis flow is now
wrapped so any failure shows a plain-language error instead of hanging silently, and still leaves the
cash-flow table open for manual entry so nobody's stuck; and (2) that message — along with the
existing "couldn't detect any transaction rows" message, the most common real failure mode for an
unfamiliar statement format — now includes a one-tap way to email or WhatsApp us what happened, with
the step, timestamp and browser already filled in, so a report arrives with real context attached
instead of a bare screenshot with no description. Reuses the same email/WhatsApp addresses as the
general feedback links already in the footer — nothing new to set up, and nothing sent unless the
applicant actually presses send themselves.

## Fix: stopped flagging the current month's salary as "missing" before it's even due

User report, filling this in mid-August: "August Salary" was flagged as a missing month even though
August wasn't over yet — real salary for a month typically isn't due until month-end or the first
week of the following month, and simply hadn't failed to show up at all. The statement just happened
to have other, non-salary activity in August, which was enough to drag the missing-month check's
window forward into a month still in progress. Fixed two ways: the CURRENT calendar month (and
anything after it) is never flagged — it can't have "failed" to arrive yet — and the month right
before it gets a short grace window during the first week of a new month too, since payroll commonly
posts a few days into the following month rather than landing exactly on the 1st.

## New: "inflow(s) need an explanation" now counts down live, and tells you when you're done

User feedback: "as I start filling each let the number 7 reduce until I fill the last one, then it
tells me done or success." The headline number on this banner used to stay fixed at the original
total forever — filling one in only added a small "(3 of 7 explained so far)" note beside it, never
actually counting down, and there was no distinct finished state once every inflow was explained.
It now counts the REMAINING unexplained ones down to zero as each is filled in, and the moment
none are left it switches to a clear "✅ All 7 inflow(s) explained" message, with the banner itself
turning green instead of staying orange.

## Fix: raised the digital-statement page cap from 60 to 150

User report: a genuine 120-page digital bank statement got truncated at the old 60-page cap on
text-layer PDF extraction, silently losing months of real transaction history. Reading a real
text-layer PDF (the common case — a normal digital statement, not a scan) is cheap enough per page
that the cap was set conservatively low; raised to 150 with headroom to spare, at no cost to the
far more common shorter statement. The scanned/photographed-statement OCR fallback keeps its own
lower cap (20 pages), since OCR is genuinely far more expensive per page — for those, splitting a
long statement across the up-to-3-files uploader, or trimming to just the required 6-month window,
is still the practical path.

## New: closing balance auto-fills from your statement, and shows a % even before the full calculator's filled in

User feedback: the financial calculator's own "Current closing balance" field never picked up the
figure from an analyzed bank statement — even though the tool already detects it (it's the same
number shown in the cash-flow table's last "Balance" column), the applicant had to notice it
themselves and retype it by hand. It now auto-fills the moment a statement's analyzed, without ever
overwriting a figure typed in deliberately beforehand.

Separately, "Closing balance strength" (and the percentage under it, right where it's most useful —
before you scroll down to the rest of the calculator) used to sit stuck on "Enter your figures"
until the separate, more detailed flight/accommodation/transport cost fields further down were
filled in, even once a statement had already been scanned and a real closing balance detected. It
now falls back to the same rough, dates-only 2× buffer estimate already shown up in "Your trip
details" whenever the detailed calculator hasn't been filled in yet, so this badge reflects real
evidence as soon as it exists — clearly labelled as a rough estimate, with a nudge to fill in the
detailed calculator for a more accurate figure.

## New: fill-progress % now also shows right above Save/Next, not just up in the pill nav

User feedback: the "X% filled" indicator only lived up in the session pill navigation at the top
of the page — by the time someone scrolls down to the Save/Next buttons to actually move on, it's
often scrolled out of view, so there's no way to tell at a glance how far along the current section
is right at the moment of deciding to save and proceed. The same live percentage (plus the raw
count, e.g. "4 of 4") now also shows directly above the Save/Next buttons, updating immediately as
fields are filled in — no separate scroll back up required.

## Fix: two real bugs found on a live "Income sources breakdown," off the app's own export

User report, off the app's own "Download breakdown as spreadsheet" export: a genuine ₦100,000
payment from a declared business ("Bright Homes Cleaning Solutions," narrated "office") wasn't
showing up under that business's group at all — and separately, two already-explained "matched
income inflow" boxes stayed expanded instead of tidying away like the rest of the list.

Root cause of the first bug: the tool's "stable recurring income" detector only looked for a
rounded payment amount that recurs across 2+ months anywhere in the whole statement, with no
check that the *same sender* was actually behind those payments. On a real statement, that meant
several completely unrelated people's one-off ₦100,000 payments — a gift, a condolence transfer, a
laundry-money reimbursement, and this business's own payment — coincidentally shared a round number
and got swept into one fake "Salary" bucket together, hiding the real Bright Homes Cleaning payment from
its rightful group. The detector now also requires a genuinely recurring, identifiable sender name
behind the amount before trusting it as one stable income source; a payment that names its own
distinct sender — and that sender doesn't match — is grouped under its own name instead, exactly
like every other payment on the page.

Root cause of the second bug: opening an already-explained matched-inflow box (via "✏️ Edit," e.g.
to double-check an unusual narration like "office" or "Tigernut") and then clicking away *without*
changing anything never re-collapsed it — only an actual edit ever triggered the auto-tidy. These
boxes now also collapse themselves once focus leaves them entirely, provided they're still filled
in, matching the same "auto-tidy after use" behaviour already used everywhere else on this page.

## Polish: wider entry-screen card on desktop

User feedback: the entry/consent card felt too small on a desktop screen. Widened from 560px to
640px — matching the width already used by the Privacy/Terms modal elsewhere in this file, so the
two overlay-style cards in the app are now visually consistent. Mobile is unaffected: the small-
phone padding override (under 400px) doesn't touch width, and the card was already `width: 100%`
up to its max-width, so this only adds breathing room on screens that have the spare space.

## New: individual payments keep their own narration, and a missing salary month gets flagged

User feedback, off a real Zenith/Bright Homes Cleaning statement: in the "Income sources breakdown," every
payment from the same source used to read as just "Salary" — a visa officer wants to see that
salary was actually collected for each specific month ("February Salary," "March Salary," etc.),
not just a generic category label. Each payment under "Show individual payment(s)" now shows the
bank's own specific narration for that exact payment (small "Salary" tag alongside it when it's a
salary-style narration), instead of the category name repeated on every row — the original
narration is never dropped, it's what's actually shown.

Once at least two "\<Month\> Salary"-style narrations are found, the tool also checks every month in
between (and any later month the source is still active in) for a matching payment, and flags
whichever one(s) never got one — e.g. the source has July activity but no "July Salary" ever shows
up, even though February through June all did. Checked once across every detected inflow rather
than per individual source box, since a recurring salary can land in either the auto-detected
"same amount every time" bucket or a same-named-sender group depending on its exact amount, and
checking box-by-box could either miss a pattern split across both or flag a false gap for a month
that simply landed in the other bucket. Shown as a warning right in the breakdown, and included in
the downloadable spreadsheet too, alongside a new "Reason" column carrying the same extracted
narration.

## Fix: two accessibility gaps found in an international-standard review

A GUI audit turned up two real, measurable issues rather than subjective nitpicks:

- **Form labels weren't programmatically linked to their inputs.** 48 `<label>` elements across
  the app (trip details, financial calculator, declaration, and two dynamically-rendered fields in
  the currency/sightseeing tools) relied purely on visual proximity to their field, with no
  `for`/`id` pairing. A sighted user never notices, but a screen-reader user tabbing through the
  form would only hear "edit text" instead of the actual field name. Every one of those labels now
  has a matching `for` attribute, verified by clicking a label in a real browser and confirming
  focus lands on the right input. (Checkbox labels that already wrap their input, and a couple of
  pure layout spacers, were correctly left alone — they didn't have this problem.)
- **`--text-muted` failed WCAG AA contrast at the sizes it's actually used at.** The old color
  (`#6b8494`) measured 3.5–3.7:1 against this theme's backgrounds — below the 4.5:1 minimum for
  normal-sized text — while being used at 11–13px for real content (tips, the footer credit line,
  legal notes), not decorative filler. Darkened to `#566a76`, which clears 4.5:1 against both
  background tones with real headroom (5.4:1 / 5.1:1), confirmed by computing the actual contrast
  ratios rather than eyeballing it. Dark mode's muted color already passed and was left unchanged.

## Polish: "What your statement(s) show" now collapses by default

Follow-up question: should Session 2 ("Income & bank statement analysis") be split into two
separate numbered sessions to shorten it? Splitting would've separated the upload/analyze action
from its own results — you'd upload on one screen, then have to click "Next" to a different screen
just to see what it found, making it harder to spot-check the auto-fill against your real
statement. Instead, the "What your statement(s) show" report card (Top 10 inflows, Top 10 most
consistent senders, Income sources breakdown) is now a closed-by-default `<details>` disclosure —
before you upload anything, Session 2 is just the upload box and the two score badges; the report
opens itself automatically the instant a statement is analyzed, so there's nothing to remember to
expand.

## Polish: decluttered "Income & bank statement analysis" (Session 2)

Direct feedback: this session "looks too clumsy." After analyzing a real statement it could stack
ten-odd full-width colored boxes in a row — errors, warnings, info tips, AND plain positive
confirmations — all the same visual weight, so nothing actually stood out and the page read as one
long undifferentiated scroll before you even reached the table. Two changes, no detection logic or
message wording touched — purely how the same findings are grouped and presented:

- Positive, nothing-to-do confirmations (e.g. "recurring income detected," "name matches") now
  collapse into one compact "✓ What looks good (N)" line instead of each claiming a full-width
  green box of its own. Things that actually need a decision (errors, warnings, and info tips)
  still render exactly as before — same text, same order, same styling — right where they were.
  This alone typically cuts 3-4 boxes down to one collapsed line, un-expanded by default since
  it's reassurance, not an action item.
- The three read-only report tables (Top 10 inflows, Top 10 most consistent senders, Income
  sources breakdown) now sit inside their own visually distinct, bordered sub-card labeled "📊 What
  your statement(s) show" — separating "here's what the tool worked out for you" from the editable
  monthly cash-flow table directly above it, instead of both running together with nothing but a
  small uppercase label between them.

## New: how many days you have, starting today, to gather your documents

User feedback: "State the number of days or weeks you have from the day you are filling this
website to Planned application/submission date. That is the number of days you have to prepare
all your documents." The "Planned application/submission date" field already had a countdown
underneath it, but it measured a different thing — the gap between your application date and your
travel date, i.e. whether there's enough visa-processing time. This adds a second, separate line
above it that measures the gap between right now and your planned submission date, so it answers
"how much time do I actually have left to gather everything" — and only needs the submission date
filled in, not the travel date too. Handles the same day ("that's today"), a date already in the
past (flagged so it gets updated rather than showing a negative number), and drops the "(about N
weeks)" parenthetical for gaps under a week so it never reads as "(about 0 weeks)."

## Fix: consent checkbox honesty gap + explain why Continue is disabled

Direct follow-up from a UI/UX review of the entry/consent screen. Two issues, both about the gate
doing what it visually claims rather than about density/layout (the earlier decluttering pass
stays exactly as it was):

- The consent checkbox used to read "I've read the disclaimer above and understand this is
  guidance only, not immigration advice" — but by default only one bolded headline sentence is
  visible; the 3-bullet summary and full legal text both sit behind a collapsed "Read the full
  disclaimer" toggle most visitors will never click. A visitor could tick that box and unlock
  Continue having only ever seen one sentence, despite the checkbox implying they'd read the whole
  thing. Reworded to "I understand this is guidance only, not immigration advice — full details
  are in the disclaimer above," which affirms the one fact that actually needs affirming and
  points to where the rest lives, without claiming an action (reading the full text) that may not
  have happened.
- The Continue button used to go from disabled to disabled with zero explanation why — a real
  usability problem for a less tech-confident visitor, who has no way to tell "gated" apart from
  "broken." A one-line hint now appears directly under the button ("Tick the box above to
  continue," or, for the still-unbuilt countries in the picker, a note to pick UK or Canada for
  now) and clears itself the moment Continue actually becomes clickable — zero layout shift, and
  no visual weight added once there's nothing left to explain.

## Polish: bigger/friendlier headline, shorter subtitle, trimmed credit line

Three quick follow-up tweaks to the entry/consent screen redesign above, all direct feedback on
that same screen:

- The "Smooth Application" headline is now larger (24px -> 32px) and bolder, in a distinct rounded
  display font (`ui-rounded`, Apple's built-in rounded system font) instead of the same system-ui
  stack the rest of the page uses. Deliberately NOT a Google Fonts/CDN import — that would add a
  new third-party network request undisclosed in the Privacy Policy and work against the "nothing
  leaves your device" promise the product is built around. `ui-rounded` renders on Safari/Mac
  (most of this app's traffic is iOS Safari per GoatCounter) and falls back to the same system-ui
  stack everywhere else, at zero network cost.
- The subtitle dropped its trailing "for Nigerian visa applicants" — now just "A personal
  document-readiness checklist." — since the trust badge right below it already says "Built for
  Nigerian applicants."
- The footer credit line dropped "— a free personal project, not a company" — now just "Built by
  SafeNetwork. Email · WhatsApp."

## Polish: calmer, less cluttered entry/consent screen

Direct feedback on the first screen a visitor sees: "make this page more appealing... minimalist
user friendly." Three changes, no functional/behavior change (same country picker, same consent
checkbox gating Continue, same disclaimer wording):

- The "Not immigration advice" disclaimer box no longer uses the same alarm-yellow warning style
  as genuine problems elsewhere in the app (missing fields, unexplained inflows) — it's now the
  same calm blue "info" tint used for other neutral notices, which both reads as less alarming for
  a disclosure that's routine, not a problem to fix, and stops diluting what --warning-colored
  elements mean everywhere else in the app.
- The trust badges ("Nothing leaves your device," "Free, always," "Built for Nigerian applicants")
  dropped their individual pill borders/backgrounds in favor of plain colored text — same
  reassurance, less visual noise competing with the actual picker and disclaimer.
- The "Built by SafeNetwork..." credit line moved from mid-card (interrupting the picker →
  disclaimer → agree → continue flow) down to a quiet footer below the Continue button, and the
  subtitle dropped a redundant sentence that just repeated the country-picker label right below it.

## New: actual percentages under "Income generation" and "Closing balance strength"

User feedback, off the two summary pills at the top of "Income & bank statement analysis": "Under income
generation add the percentage of income that has been generated. Under Closing balance strength, add the
closing balance generated from the bank statement and give it a percentage of what the closing balance
[is] to the amount needed to travel." Until now both pills only showed a qualitative label ("Strong —
steady & explainable," "Needs attention — unexplained inflow(s)," "Enter your figures") with no number
behind it.

**Closing balance strength** now shows a line underneath with the actual balance and what percentage it
is of the funds needed: prefers the balance actually DETECTED from an uploaded/analyzed bank statement
(the most recent month in the cash-flow table) over a self-typed figure, since that's real evidence rather
than a number anyone could type in — falls back to the self-typed closing balance only once no statement
has been analyzed yet. "Amount needed to travel" is the same recommended 2× buffer on the estimated trip
cost that this badge itself already uses to decide Strong/Needs attention/Weak, so the percentage always
matches the badge's own wording above it, capped at 100%.

**Income generation**'s percentage blends the two things that badge was already judging qualitatively,
clarified directly with the applicant: (1) how much of the "needs an explanation" list has genuinely been
explained (0 of 1, 100%, etc.), and (2) how consistent the monthly income itself looks — no zero-income
months, low month-to-month variance (measured via coefficient of variation). Each half is scored 0-100
independently, then averaged, so a perfect explanation record can't fully offset wildly inconsistent
income and vice versa. Both lines stay blank until there's enough data to compute them (matching each
pill's own existing "Enter your figures" state), so nothing shows a misleading 0%.

## Fix: matched-inflow pre-tag now reads each payment's own narration instead of defaulting

Direct follow-up, off screenshots of the live matched-inflow boxes: several payments were showing the
generic "Business" pre-tag even though their own narration clearly stated what they were for — e.g.
"07/03/2026 NIP/ROLEZ/BRIGHT HOMES CLEANING ... SOLUTIONS LIMITE/February Salary/AT68 TRF..." was tagged
"Business" instead of "Salary", and a similar one narrated "allowance" was also tagged "Business." The
narrower dropdown added just below (for narration-blank employer inflows) only solved half the problem —
inflows that DO already state a reason were still being defaulted off which field they matched (employer
-> "Salary", business -> "Business"), ignoring the narration text sitting right there.

Added `detectWorkPaymentCategory`, which reads a matched inflow's own extracted narration reason and maps
it straight to the correct option — Salary, Allowance, Transport/Housing/Car/Fuel/Wardrobe/Subsidy/13th
Month/Medical Allowance (checking the specific allowance types before the generic "Allowance" catch-all,
so "housing allowance" pre-selects "Housing Allowance," not just "Allowance"). This now applies regardless
of whether the payment matched a declared employer or a declared business — "February Salary" means the
same thing either way — and whenever a specific reason is detected, the narrower Salary/Allowance-type
list is shown (not the general Business/Family/Gift one), since a stated payroll-type reason means that
list is genuinely no longer relevant. Confirmed with a fixture that deliberately narrates the declared
employer's payments "Allowance" and the declared business's payments "Salary" — the wrong way round from
the old blanket assumption — to prove the pre-tag now follows the narration, not the matched field. A
payment matched to a declared BUSINESS whose narration states no specific reason at all is the one case
still left on the general list, since a business's own unlabelled income could be anything (a sale, a
service fee), not necessarily payroll.

## New: narrower payment-type dropdown for narration-blank employer inflows

Applicant uploaded their own manual extraction of every inflow from their declared employer ("Bright Homes
Cleaning Solutions Ltd"), narration column included. Several of those genuine, already-matched
payments carry a narration that never states a specific reason at all — just "…AFB NIP TRANSFER TO
<applicant> FROM BRIGHT HOMES CLEAN…", no "Salary"/"Allowance"/etc. anywhere in it. Until now, every
matched employer/business inflow got the same general reason dropdown (Salary/Business/Family/
Contribution/Work/Bonus/Sales/Gift/Self/Reversal/Others) — technically usable, but most of those options
make no sense once the sender is already confirmed as the applicant's own declared employer, and the list
had nothing specific enough for the actual gap: which *type* of employment payment a given one was.

Added a second, narrower dropdown — Salary, Allowance, Transport Allowance, Housing Allowance, Car
Allowance, Fuel Allowance, Wardrobe Allowance, Subsidy Allowance, 13th Month Allowance, Medical Allowance,
Others (with a free-text box, same as every other "Others" pick elsewhere in the app) — and it now appears
automatically, but only when BOTH are true: (1) the inflow is matched to a declared EMPLOYER specifically
(not a self-employed business — "Housing Allowance"/"Wardrobe Allowance" describe an employee's payslip,
not a company's own income, so business-matched inflows keep the general list unchanged), and (2) that
specific transaction's own narration doesn't already spell out a recognisable reason. Any inflow whose
narration DOES state one (e.g. "February Salary") keeps the general list exactly as before — nothing
changes there. Every matched inflow is still auto-pre-tagged "Salary" the first time it's seen either way,
and remains fully editable, same as before this change.

## Fix: narration glossary gap — "FD" (Fidelity Bank) wasn't decoded at all

Applicant supplied their own manually-built code glossary from the real statement, cross-checked against
the app's existing one. Most entries already matched (NIP, TRF, CIP, ETI, RVSL, VFD, WBP, ROLEZ/ROLEX,
STBC, ABN), but "FD" — the bare code, not "FDP" — had no glossary entry at all, so it silently showed no
decoded meaning. Added `'FD': 'Fidelity Bank.'`. Also tightened "NIP"'s description to its correct
industry name, NIBSS Instant Payment (NIBSS: Nigeria Inter-Bank Settlement System), rather than the
looser "Nigeria Instant Payment" it said before.

Two entries from the applicant's list were deliberately NOT added: "Grace" and "GraceCYC," decoded in their
list as "GRACE TMPM CYC REGION 3." That's correct for their own statement, but it's this one applicant's
own employer's abbreviation, not a generic Nigerian banking code — adding it to the shared glossary would
mislead every other applicant using this tool whose statement happens to contain those same letters for
an unrelated reason. That's exactly what the "also known as" field (added just above) is for instead —
it's scoped to one person's own declared employer/business, not baked into the shared code everyone gets.

## Fix: reversed/bounced-back transfers double-counted as new income ("RSVL" vs "RVSL")

Direct follow-up to the "also known as" feature below — the applicant checked the 4 newly-matched
"Grace Covenant Youth Church" inflows against their own manual analysis and flagged that one of them had
actually been reversed. Traced this by reading the raw statement columns (DATE / DESCRIPTION / DEBIT /
CREDIT / VALUE DATE / BALANCE, confirmed from the statement's own header) line by line around each
flagged entry, rather than trusting either narration wording or an earlier guess at debit/credit
direction — and found two separate real issues, not one:

1. Two entries narrated "NIP CR/MOB/TOBI BENSON/FBN / Grace CYC WEDDING SUPPORT" are actually a DEBIT
   (₦1,500,000 sent OUT, presumably by/via the church, to an individual) that failed and was reversed —
   the reversal shows up as its own separate line marked "***RSVL", crediting the ₦1,500,000 (plus a
   ₦50 stamp-duty reversal) back into the account. `isReversalNarration` only recognised the spelling
   "RVSL" — this statement mostly uses "RSVL" (the same 4 letters, transposed), which slipped through
   as if it were ordinary new income, wrongly inflating the employer match by ₦1,500,050 across what
   looked like 2 genuine inflows but were really just a failed transfer bouncing back. Confirmed both
   spellings are real by finding an unrelated genuine "RVSL:Airtime..." reversal elsewhere in the same
   statement — banks are not internally consistent about this, so the check now accepts either ordering.
2. Separately, "FRM GRACE TMPM CYC REGION 3 = PRINTING" (₦1,450,000) and an "ETI NXG MOBILE TRF...FRM
   PETER OKON I" payment referencing "GraceCYC" (₦800,000) are genuinely real, non-reversed CREDIT
   inflows — confirmed from the DEBIT/CREDIT columns, not the narration wording (narration alone is a
   misleading guide here: e.g. "NIP CR/MOB/..." literally appears on plenty of DEBIT rows in this
   statement, since "CR" is apparently just part of Zenith's fixed channel-code template, not a live
   indicator of which way the money moved). These 2 are correctly kept.

Net effect: "Grace Covenant Youth Church" now shows 2 genuine matched inflows totaling ₦2,250,000 (down from
the previously-reported 4 inflows / ₦3,750,050, which included the ₦1,500,050 that had bounced back).
This reversal-detection fix isn't specific to the alt-name feature — it affects every part of the tool
that reads narrations to decide what counts as real income (top inflows, income-source breakdown,
stable-income detection, the matched employer/business inflow checks), so it's a broadly more accurate
result across the board, not just for this one employer.

New regression test: `tests/rsvl-reversal-spelling.test.js`, using a fixture with a "***RSVL"-marked
reversal credit, confirming it's excluded from the matched-inflow count and total.

## New: "also known as" name for employer/business, plus another bank-code narration fix

Follow-up investigation, prompted directly by the previous fix's honest caveat: "Grace Covenant Youth Church"
still showed zero direct inflow matches even after the wrapping fix. Traced this by grepping the real
statement's own raw text (not just the app's output) for "Grace"/"Covenant"/"Youth" — the statement never
spells the name out at all. It abbreviates it as **"Grace CYC"** (once even glued together as "GraceCYC").
Since the applicant's typed name only ever shares ONE literal word ("Grace") with what the statement
actually prints, the 2-distinctive-word safety threshold (added a couple of batches ago to stop "Clean
Deals Ventures" wrongly matching "Bright Homes Cleaning...") correctly declined to treat that as a match — a
single shared word still isn't enough evidence on its own. That threshold was doing its job; the real
gap was that the tool had no way to know "Grace CYC" and "Grace Covenant Youth Church" are the same thing.

Added an optional **"Also known as / abbreviation used in your statement"** field under both Employer
and Business name. Whatever's typed there is folded into the SAME word-matching pass as the full name
(not checked separately) — so "Grace" + "CYC" together now clear the 2-word threshold — while every
message shown still displays the full name you originally typed, never the abbreviation itself. A word
appearing in both the full name and the alias (e.g. "Grace" in both) is deduplicated before counting, so a
single repeated word still can't satisfy the 2-word threshold on its own — the safety fix stays intact.

Re-verified against the real statement with "Grace CYC" entered as the alias: "Grace Covenant Youth Church" now
shows 4 matched inflows (₦3,750,050). Worth flagging honestly: those 4 payments are narrated as coming
from an individual ("Tobi Benson") with "Grace CYC Wedding Support" mentioned in passing, rather than
looking like a direct payroll transfer from the church itself, and none are narrated "Salary" — which is
exactly why the existing "Inconsistent salary narration" and "only found in 2 distinct months" warnings
still correctly flag these for your own double-checking rather than treating them as a clean match.

Also fixed, found while re-testing this: the receiving bank's own name/code (e.g. "FBN" — First Bank of
Nigeria) could end up mislabeled as the payment's "reason" ("Most commonly narrated as 'Fbn'") — the same
class of bug as the earlier "Rolez" fix, just for bank-name codes instead of channel codes. The list used
by the salary-reason detector is now kept in sync with the bank-name list already used elsewhere.

New regression test: `tests/employer-alt-name.test.js`, confirming both that the alias is required for a
statement using only the abbreviation, and that the full typed name (never the alias) is what's shown.

## Fix: recover narration text that wraps onto a second physical PDF line

Follow-up to the previous two fixes below. On the real 31-page Zenith statement used for testing, many
transaction DESCRIPTION cells wrap across MORE THAN ONE physical PDF line — the date and amount figures
sit on the first line, but the tail end of the narration (e.g. "...Exclusive Solutions Ltd/February
Salary") spills onto the next line, which has no date and no amounts of its own. That trailing text was
being silently dropped: the parser only ever recognises a row that starts with a date, so a line with no
date was simply skipped past, and its text was lost for good. This is exactly why the salary-narration
checks shipped a few batches ago came up empty ("Inconsistent salary narration", 0% consistency) even on
genuine salary payments — the word "Salary" itself only existed on the wrapped second line.

A new step (`mergeWrappedNarrationLines`) now stitches a trailing line back onto the preceding
transaction's narration, but only when it looks unambiguously like leftover narration text: no date of
its own, no amount-shaped numbers of its own (a real data row, not wrapped text), on the same PDF page
(never wraps across a page break, where headers/footers repeat and would otherwise get glued onto the
wrong transaction), short enough to plausibly be one wrapped cell, and not a recognisable page-furniture
phrase ("Page 3 of 31", "continued", etc). It caps how many trailing lines it will absorb per
transaction. Deliberately conservative, in keeping with how the rest of this parser backs off rather
than guesses — a candidate line that fails any of these checks is left alone.

Re-verified against the real statement: the business ("Bright Homes Cleaning Solutions Ltd") inflow
count went from 27 to 28 (recovering one more genuine payment whose distinctive words were split across
the wrap), and narration consistency for "Salary" went from 0% to 18% (5 of 28 inflows now correctly
show their recovered "Salary" narration, up from none). One thing worth flagging honestly: the employer
("Grace Covenant Youth Church") still shows zero direct-sender matches after this fix — that one doesn't
appear to be caused by the wrapping issue this fix addresses, so it's left as a separate open question
rather than something this change claims to have resolved.

New regression test: `tests/wrapped-narration.test.js`, using a fixture (`wrapped-narration-fixture.pdf`)
built with real two-physical-line wrapped narrations, confirming both that the wrapped "Salary" text is
recovered and that amount/date figures (which live entirely on the first line) are unaffected.

## Fix: unrelated payer wrongly matched to a declared employer/business on one shared word

Follow-up to the previous batch below. On the real 928-transaction Zenith statement used for testing,
an unrelated payment narrated `NIP/PBNL/HOMES DEALS VENTURES/...` was being wrongly counted as an
inflow from "Bright Homes Cleaning Solutions Ltd" — purely because both names happen to share the
single ordinary word "HOMES". The employer/business inflow matcher (`findInflowsMatchingName`) only
ever required ONE shared distinctive word between the declared name and a transaction's narration,
which is too weak a bar: any two genuinely unrelated payers can innocently share one ordinary word.

It now requires at least 2 of the declared name's distinctive words to appear in the narration (or all
of them, when the name only has 1 distinctive word to begin with — e.g. a short name like "GTB") before
counting a transaction as a match. A genuine "Bright Homes Cleaning Solutions" payment still matches
easily (it shares BRIGHT + HOMES + CLEANING + SOLUTIONS — 4 words, not 1), while "Homes Deals Ventures"
— sharing only "CLEAN" — no longer does. Re-verified against the real statement: the business inflow
count correctly dropped from 28 to 27 (removing exactly the one false positive), and "Clean Deals
Ventures" no longer appears among the itemized matched-inflow boxes.

One side effect worth flagging honestly: on the same real statement, this stricter matching also
dropped "Grace Covenant Youth Church" from a small number of directly-matched inflows down to zero (it
still shows as "referenced in this bank statement," just not confirmed as the direct sender of any
individual payment). This traces back to the already-disclosed multi-line PDF narration-wrapping
limitation (see the batch below) — when a narration's later words get cut off because they wrapped
onto a second physical line the parser doesn't read, only one distinctive word may survive per line for
some entries, which is no longer enough on its own to count as a match. Fixing that wrapping issue
should recover this, and remains an open follow-up rather than something attempted in this fix, to keep
this change narrowly scoped to the false-positive-matching bug it was meant to address.

New regression test: `tests/false-positive-name-match.test.js`, covering both the false positive being
excluded and the genuine match still being counted correctly.

## Salary consistency checks, top consistent senders, family detection, and a narration code glossary

A 10-point list of requests, built off a real Zenith Bank statement and the applicant's own manual
analysis spreadsheet of it:

1. **Inconsistent salary narration**: if none of the inflows matched to a declared employer/business
   are explicitly narrated "Salary" (or a recognised variant — see item 7), this is now called out as
   a specific warning, rather than silently passing.
2. **6-month salary coverage**: matched employer/business inflows spanning 6 or more distinct months
   are now called out as already-sufficient evidence (no further explanation needed); fewer than 6 is
   flagged as a red flag reviewers commonly cite, with guidance on what to do about it.
3. Inflows with no narration at all already prompted an explanation (shipped earlier) — unchanged.
4. **Narration consistency, as a percentage**: e.g. "62% of these inflows (5 of 8) are explicitly
   narrated 'Salary'" — a plain, checkable number instead of just a pass/fail message.
5. "Top 10 highest transfers" already existed — unchanged.
6. **New: "Top 10 most consistent senders"** — ranked by how many separate months a sender recurs
   across, not by amount. A sender who sends smaller amounts every month now correctly outranks a
   single one-off large payment, which the existing amount-ranked list would otherwise put first.
7. **Narration word grouping**: common shorthand/variants for the same reason (e.g. "HBD" and "Happy
   Birthday", or "January Salary"/"February Salary"/"March Salary") are now recognised as the SAME
   recurring reason when tallying "most common narration" and salary-consistency, instead of each
   being counted as a separate one-off mention.
8/10. **Bank narration code glossary**: a best-effort "🔍 What does this narration mean?" breakdown,
   decoding common Nigerian bank/payment-channel shorthand (NIP, TRF, CIP, ETI, RVSL, VFD, WBP =
   Wema Bank, ROLEZ = Moniepoint MFB, STBC = Stanbic IBTC, ABN = Access Bank, FD/FDP = Fidelity Bank,
   ISW/QTeller = Interswitch, and more), shown right on each inflow's own explain-box. The same codes
   are now also excluded from the automatic sender-NAME extraction (they used to leak into extracted
   names, e.g. "Rolez Bright Homes Cleaning Solutions" instead of just "Bright Homes Cleaning
   Solutions") and from the automatic REASON extraction (a bare channel code like "ROLEZ" could
   previously get wrongly reported as if it were the payment's reason).
9. **Family detection**: a sender sharing the applicant's own surname is now grouped and badged
   "Family" in the Income sources breakdown, with a narrower, purpose-built reason dropdown (Gift /
   Sale of property / Rental income / Others) instead of the general-purpose list used everywhere else.

Full test suite (24/24, including a new regression test built around a synthetic fixture with a
family-surname sender, a one-off large payment, and a recurring smaller one, proving the new
"most consistent" ranking genuinely differs from the existing "highest amount" ranking) passed.

Also smoke-tested against a real, full 31-page bank statement during this work (not shipped as a
committed test fixture, for privacy) — this surfaced two known, pre-existing limitations worth
flagging honestly rather than silently working around: (a) when a statement's own description column
wraps across multiple lines in the source PDF, only the first wrapped line is currently captured as
the narration — so a genuine "...February Salary/..." reason further down the wrapped cell can be lost
entirely, which will understate the narration-consistency percentage on statements laid out this way;
and (b) the employer/business name match is word-based, so a genuinely different company sharing one
distinctive word (e.g. "Homes" in both "Bright Homes Cleaning..." and an unrelated "Homes Deals Ventures") can
occasionally get swept in as a false-positive match. Neither is new to this change, but both are worth
a dedicated follow-up if you'd like them tightened up.

## Employer/business-matched bank inflows are now listed and explained individually, not grouped

User request, off a real statement with 19 credits matching a declared employer/business: "Instead
of grouping the 19 transactions from Bright Homes Cleaning Ltd must be explained." The "Work
status" cross-check used to fold every matching inflow into one summary sentence ("Found X as the
sender on 19 inflows... totaling Y"). Every matched inflow now ALSO gets its own explain-box —
the same UI already used for "needs an explanation" inflows — listed individually with its own
date, amount and narration. Each one is auto-tagged the moment it's first seen with the obviously
correct category (an employer match → "Salary", a business match → "Business"), so legitimate
recurring salary payments don't turn into 19 chores, but every box stays fully editable — if one
particular payment isn't actually salary/business income, it can be re-labelled just like any other
inflow on the page. Full test suite (23/23, including a new regression test covering the itemized
boxes, their auto-tagging, and re-editing one) passed.

## Added "Self" and "Reversal" to the unexplained-inflow reason dropdown

User request, made straight off a real statement's own flagged inflow list: two common, legitimate
reasons a large inflow shows up with no clear description were missing from the "What was this
payment for, and from whom?" dropdown — a transfer from the applicant's own other account ("Self"),
and a reversed or bounced-back payment ("Reversal"). Both added alongside the existing options
(Salary, Business, Family, Contribution, Work, Bonus, Sales, Gift, Others) — picking either is
enough on its own, same as every other category, with no extra detail required. Full test suite
(22/22, including an updated regression test covering the full option list) passed.

## "Next →" now points out exactly which field(s) are still missing before you move on

User feedback: "Can the system point out where I have not filled before proceeding." Clicking
"Next →" on an incomplete session already showed a soft "you're only X% done" nudge, but never said
which field was actually still empty, so the applicant had to hunt for it themselves. That nudge now
names the specific missing field(s) or checklist item(s) by name (e.g. "Main purpose of visit,
Planned travel date"), and outlines each one in red directly on the page — reusing the same red-
outline treatment already used for an invalid return date — with an automatic scroll to the first
one, so it's visible the moment "Next" is clicked, whether or not the applicant goes on to leave the
section incomplete anyway. Covers every guided session: trip details, the cost calculator, cash-flow/
income, and every document-checklist category. Jumping around freely via the numbered session pills
is unaffected — this only applies to the guided "Next →" buttons. Full test suite (22/22, including
one new regression test) passed.

## Fixed a passport date-of-birth misread: "3/9/1938" instead of "3/9/1988"

Real user report: a passport's date of birth read from the machine-readable zone as "3/9/1938"
instead of the true "3/9/1988" — an "8" OCR'd as a "3". Unlike the name-field digit misread fixed
earlier ("O" read as "0"), a birth-date field legitimately contains real digits, so it can't be
"corrected" on sight — it needs evidence. The MRZ's own check digit is normally strong enough
evidence on its own (a swap is only trusted if it's the ONE AND ONLY one that restores a passing
checksum and lands on a real calendar day), but "3" and "8" happen to differ by exactly 5, and
every MRZ check-digit weight is odd — so swapping either digit at any position in a field shifts
the checksum by the same amount no matter where, meaning a field with more than one 3-or-8 in it
(like this one: both digits of the misread year, plus the leading digit of the month) has several
equally "valid" corrections and no way to tell them apart mathematically. Rather than guess, this
now falls back to the plain "Date of birth" text most passport bio pages also print — a second,
independent OCR read, in a different font, of a different part of the page — and uses that
instead, with a plain on-screen note explaining the swap rather than silently showing a corrected
value as if nothing needed fixing. A genuinely unique checksum-only correction (most digit-pair
mixups, and any field where the mixed-up digit only occurs once) is still fixed directly via the
checksum, no printed text needed. Full test suite (21/21, including two new regression tests: one
for the printed-text fallback, one confirming the unique-checksum path still works on its own)
passed.

## "Work status" is now a single dropdown, and three items moved into "Identity & application"

User feedback: "WORK STATUS should have a collapsible drop-down menu with the following; I'm
currently employed / I'm self-employed / run a business / I'm currently a student / I'm applying
for a child, or travelling with one / I'm currently employed & self-employed & run a business in
Nigeria. Move the following to a Session 4 (Identity & application): I've gathered my supporting
documents and I'm ready to start the formal application steps (form, fee, biometrics) / I've been
refused a visa (for this country or any other) in the last 5 years; state the count / Some of my
documents are not in English."

The four "Work status" checkboxes (employed / self-employed / student / applying for a child or
travelling with one) are now one compact `<select>` dropdown, plus a fifth combined option for
someone who's both employed and self-employed/running a business. Picking an option drives the
same underlying fields the rest of the app already reads from — the employer-name row, business-
name row, student-sponsor block, and every progress/consistency check tied to them all work exactly
as before, since nothing about *how* those fields are used changed, only how they're chosen.

The three unrelated checkboxes — "Some of my documents are not in English", "I've gathered my
supporting documents and I'm ready to start the formal application steps", and "I've been refused
a visa... in the last 5 years" (with its count/detail follow-up) — moved out of "Your trip details"
into a new card at the top of "Identity & application", ahead of that session's document checklist,
so the trip-details page reads as trip planning only and these identity/history questions live
where they conceptually belong.

Full test suite (20/20, including one new regression test covering the dropdown's five options and
the relocated card) passed.

## Adults/Adolescents/Children breakdown is now collapsible once filled in

User feedback: "I do not want the page to be too busy, i want it user friendly. After clicking 'How
many people are travelling on this application?' the following Adults (18+)/Adolescents
(12-17)/Children (2-11) once filled should be collapsible." A "✓ Done — collapse this" button now
tucks the three number fields away behind a one-line summary ("2 adults, 1 adolescent — edit
breakdown") once the applicant is happy with the split — the same collapse-after-use pattern already
used by the transport/sightseeing/currency helpers elsewhere on this page, so the page doesn't stay
cluttered with three open fields for the rest of the session. Clicking "edit breakdown" reopens them.
Picking a different traveller count from the dropdown always re-expands the fields (rather than
leaving a stale summary on screen), and the underlying figures used everywhere else in the app are
untouched by collapsing — this is purely a display change. Full test suite (19/19, including one new
regression test) passed.

## Fixed three real-user bugs: a misread passport name, and two bank statements that wouldn't read

A real applicant hit three separate problems in the same session, reported together: after the name
was generated from a family member's passport, a letter "o" in the name read as digit "0". Also, that
family member's GTB bank statement showed an error message, and her Sterling bank account statement
did not read either. All three are fixed.

**Passport name — "O" misread as "0":** the MRZ's name field is letters and "<" filler only per spec —
a digit can never legitimately appear there, so any digit found is always a misread, never a genuine
value. `parseMrzFields` now runs the name segment through a small letter-lookalike correction
(0→O, 1→I, 2→Z, 5→S, 6→G, 8→B) before splitting it into surname/given name. Deliberately scoped to only
the name field — passport numbers, dates, and every other MRZ field are left untouched, since digits
there are real.

**GTB bank statement — "Detected 1 transaction(s)" with a false employer-not-found error:** this
bank's PDF export renders each table COLUMN as its own text run sharing one Y position down the whole
page (e.g. one run literally reads "Balance 1,765.79 11,765.79 3,707.79" — the header word plus every
row's value in that column), instead of a normal row grid. The existing row-based parser's Y-proximity
line grouping saw this as a handful of garbled lines and ended up parsing the statement's own header
summary box (Print Date, Total Debit/Credit, Closing/Usable/Opening Balance) as one fake transaction —
which is exactly the "1 transaction" bug reported, and why the employer/business name check then failed
(no real transaction narrations were ever scanned). A new fallback — used only when the normal parser
finds fewer than 2 transactions, so ordinary statement formats are completely unaffected — looks per
page for a date-list line and a same-length balance-list line, and reconstructs each row from the
balance-to-balance delta (seeded by an "Opening Balance" figure read from the statement's own summary
box). Verified against the real, full 17-page statement: 159 transactions reconstructed, with total
credit (₦350,951.00), total debit (₦353,706.34), and closing balance (₦642.45) all matching the
statement's own printed totals exactly. Narration is deliberately left blank for these reconstructed
rows (this layout's Remarks column is one long unsplittable run per page) — a new on-screen note
explains this honestly, including that the employer/business name check can then only confirm the name
appears somewhere in the statement, not which specific inflow(s) it's the sender on.

**Sterling bank statement — nothing detected at all:** this statement uses `DD/Mon/YYYY` dates with
slash separators (e.g. "14/Feb/2026"), which neither existing date pattern matched (one required an
all-digit month, the other only allowed a space or hyphen around a month name — never a slash) — so
every single row failed date matching, meaning zero transactions were ever found. Also labels its
credit/debit columns "Money In"/"Money Out", which weren't in the recognized header-keyword list. Both
fixed: the date pattern now also accepts a slash separator, and "money in"/"money out" were added
alongside the existing debit/credit column labels.

Full test suite (18/18, including three new regression tests using synthetic fixtures that reproduce
each real-world pattern) passed. The two real statements and the real passport photo were also
re-verified end to end after the fix.

## Reordered "Your trip details" — traveler count now comes before the cost estimate
User request: move "How many people are travelling on this application?" (and its adults/adolescents/
children breakdown) to immediately after "Planned application/submission date", and move the "Rough
worst-case cost estimate" box to come after that, instead of before it. Previously the cost estimate
box sat between the application-date row and the traveler-count question, which read oddly once the
cost estimate itself started scaling by traveler count (flight/local transport/shopping figures that
depend on a question the applicant hasn't reached yet). Pure reordering of existing markup — no
element was changed, added, or removed, so all IDs, event listeners, and the actual calculations are
untouched. Full test suite (15/15) passed with no regressions.

## A return date before the travel date no longer counts as "filled in"
User report: "Once planned return date is [before] your travel date, the system should not allow you
[to] proceed until you choose a date [later] than the travel date." An invalid date pair (return date
on or before the travel date) already showed a plain "Return date should be after your travel date"
note, but the return date field itself still counted as fully filled toward the trip session's
progress % — the same class of bug already fixed for the employer/business name fields ("100%
complete" while something required was actually still wrong). This app doesn't have a traditional
"Next" button with a hard block, so the fix works on the two mechanisms it does have: (1) the return
date field now gets a clear red border, a dynamic `min` constraint (set to the day after the travel
date, so the calendar picker itself won't offer earlier dates), and the browser's own native
validation message the moment the pair becomes invalid; and (2) the trip session's progress % no
longer counts an invalid return date as filled, so it can never read 100% while the dates don't make
sense — which also means the app's existing "Next →" soft-nudge (the "you're only X% done, go anyway?"
confirm dialog) now correctly fires if someone tries to move on with the dates still wrong. Added a
dedicated Playwright test covering the red-border/min-attribute/native-validity state, the progress-%
drop, the dialog firing on "Next", and the state clearing once a valid later return date is entered.
Full test suite (15/15) passed.

## Recognize truncated "Limited" company suffixes ("Limite", etc.) from different bank apps
User feedback: "Limited can be Ltd or LTD or Limite because some can be shortened by different bank
apps" — different banks' narration fields truncate the "Limited" company suffix differently, and a
mid-word cut like "Limite" (as seen in the earlier "BRIGHT HOMES CLEANING SOLUTIONS LIMITE" report)
wasn't recognized anywhere this file specifically looks for the literal words "LTD"/"LIMITED". Two
places were affected: the company-vs-personal classifier used to tag each top inflow as "Company" or
"Personal" (a truncated suffix could be the ONLY company signal in a narration, e.g. "ABC LIMITE" —
"ABC" alone isn't a recognized company keyword — and would have been wrongly tagged "Personal"), and
the narration-cleanup logic that keeps a company suffix from getting glued onto an extracted sender
name. Both now also recognize any word starting with "LIMIT" (LIMIT, LIMITE, LIMITED, and whatever
else a given bank's app happens to cut it down to) via one shared rule, instead of only the two exact
spellings "LTD"/"LIMITED" — so a truncated suffix is treated exactly the same as the full word would
be, everywhere in the file. Added a dedicated Playwright test using a statement whose narration's only
company signal is a truncated "LIMITE" suffix, confirming both inflows are now correctly tagged
"Company". Full test suite (14/14) passed.

## Employer/business bank statement cross-check now counts inflows and reads the payment reason
User feedback, after seeing "Found 'Grace Covenant Youth Church', 'Bright Homes Cleaning Solutions Ltd'
referenced in this bank statement": "the place you work is where the visa officer wants to see at
least monthly inflows from, state how many inflow comes in from the employer or business name
extracted from the bank statement... [also] check for the narration" — pointing to a real narration
line like "NIP/ROLEZ/BRIGHT HOMES CLEANING SOLUTIONS LIMITE/February Salary/AT68TRF2...", noting
the company name is printed with a truncated suffix ("LIMITE" instead of "LIMITED"/"LTD") immediately
followed by the payment reason ("February Salary"). Simply saying a name was "found somewhere in the
statement" was weaker evidence than what a reviewer actually wants: money genuinely, regularly
arriving FROM that employer/business. This cross-check now counts the individual CREDIT transactions
whose own narration names the employer/business (not just any mention anywhere in the document,
and excluding reversals), totals them, and — where the statement's own narration follows the common
CHANNEL/PRODUCT-CODE/SENDER/REASON/REFERENCE slash-delimited format — reads off a human-readable
"reason" segment (e.g. "February Salary") to show alongside the count. The match is still word-based
against distinctive parts of the typed name (same tolerant approach used elsewhere), so a truncated
or abbreviated company suffix in the narration — "LIMITE" instead of "LIMITED"/"LTD", as in the report
above — doesn't cause a false "not found". Where a name appears in the statement but isn't the direct
sender on any individual inflow, the message now says so explicitly rather than implying it does.
Where a name genuinely never appears at all, the existing hard warning is unchanged. Added a dedicated
Playwright test covering the inflow count/total, the narration-reason readout (including the
tie-breaking wording so a one-off reason isn't overclaimed as "most common"), the truncated-suffix
match, and the not-found path. Full test suite (13/13) passed.

## The rough trip-cost estimate now scales with how many people are travelling
User report: the "Rough worst-case cost estimate" box on "Your trip details" showed the exact
same figures (flight, hotel, local transport, shopping, total, recommended funds) no matter how
many people were set under "How many people are travelling on this application?" — switching from
2 adults to 5 adults, 2 adolescents and 1 child left every number unchanged, even though the
traveller-count tip text right next to it already promised discounted adolescent/child flight fares
were "applied [in] the calculator below." The box was in fact only ever pricing a single traveller.
Fixed: flight cost now uses the same adult/adolescent/child discount formula already used by the
detailed financial calculator further down the page (full adult fare per adult, 90% of the adult
fare per adolescent, 75% per child, so the 90%/75% discount note now actually matches what's shown
here too) instead of a flat, headcount-blind figure. Local transport and shopping — genuinely
per-traveller costs — now multiply by total headcount (adults + adolescents + children). Hotel cost
is left as-is, since a hotel room's nightly rate doesn't scale 1:1 with the number of people sharing
it. The "Rough total" and "Recommended funds to show (2×)" figures, and the downstream statement
vs. rough-estimate readiness box further down (which reads the same numbers), update automatically
since they're computed from these same figures. Verified manually across 1 adult, 2 adults, and a
5 adults / 2 adolescents / 1 child scenario — full test suite (12/12) also passed with no
regressions.

## Added a check for bank statements that don't belong to the applicant
User question: "How do we handle those who upload wrong bank statement that doesn't tally with
their names?" A statement uploaded under someone else's name is a real risk — a reviewer treats
funds evidence as the applicant's OWN money unless it's clearly documented as sponsor support, so
a mismatched statement can quietly undermine an otherwise-strong application. The analyzer now
tries to read the "Account Name:" (or "Customer Name:", "Name of holder:", "A/C Name:") line
printed on the statement itself and cross-checks it against the name the applicant typed in on the
trip-details session, using the same tolerant loose-word-match approach already used for the
passport-name check (so a reordered name, a dropped middle name, or minor punctuation differences
don't trigger a false alarm). Three outcomes: a clear match gets a quiet confirming note; a clear
mismatch gets a direct warning naming both the detected account holder and the applicant's own
entered name, along with a pointer that a third party's statement needs to go through sponsor
documentation instead of being treated as the applicant's own funds evidence; and a name that's
only partially found (or that the extractor can't confidently read a name for at all) stays silent
on this specific check rather than risk a false positive, falling back to the existing looser
"does this name appear anywhere in the statement text" check as a safety net. Also fixed a related
extraction bug found while testing: a statement's account-number line printed immediately after the
account-name line (e.g. "Account Name: X" followed by "Account Number: Y") could get swept into
the captured name — the cutoff logic now recognizes a broader set of common statement-header words
(account, number, branch, sort code, IBAN, BVN, address, statement, period, currency, date, type,
balance, customer, holder) as the end of a name, not just digits. Added a dedicated Playwright test
covering a matching name, a mismatched name, and the no-name-entered guard, using two new synthetic
statement fixtures. Full test suite (12/12) and the OCR regression check both passed.

## Fixed a real bug: "Your trip details" could read 100% filled with a required field still blank
User report: "100% complete and the business name is not written." Root cause: the trip session's
progress % only checked five fixed fields (name, purpose, travel date, return date, application
date) — it never accounted for the employer/business name field, even though that field becomes
required (marked with a red *) the instant "I'm currently employed" or "I'm self-employed" gets
ticked. So a self-employed applicant who ticked the box but hadn't yet typed a business name saw
"100% filled" right above an empty, starred-as-required field — a confusing, actively misleading
state. Fixed by including the employer name (when employed is ticked) or business name (when
self-employed is ticked) in what counts toward that session's completion, so it correctly drops
below 100% until whichever name is actually filled in. Added a dedicated Playwright test covering
both the employed and self-employed paths in both directions (ticking the box drops the %, filling
the name brings it back to 100%). Full test suite (11/11) and the OCR regression check both passed.

## Made the "Please also add" business-document reminders clickable
The self-employed reminder box (CAC registration, business bank statements, and the note about that
payment needing to also show up on your personal statement) listed these as plain, non-interactive
text. Per feedback: make the 3 items clickable and able to collapse. Turned each of the 3 bullets
into a link to its matching checklist item under "Financial evidence" (CAC registration → business
bank statements → personal bank statements), reusing the app's existing "jump to item" behavior
(already used by the sidebar's "Still missing" list and other "see below" links) — clicking one
switches to the right session if needed, opens the collapsed category it lives in, scrolls to it,
and briefly highlights it, so "collapse" (closing that category back up once you're done) works the
same way it already does everywhere else in the app, rather than needing new UI. Verified in a real
browser: all three links have the right target, and clicking one reveals and highlights that
checklist item.

## Added an immediate "how ready am I" % right under the auto-filled closing balance
Per feedback: "Based on the closing balance generated from the bank statement, tell the user how
many percentage he/she is ready for application. Work the percentage readiness based on the
closing balance and the Rough worst-case cost estimate. Tell the applicants how much it need to
get in total to be ready. Break it down and tell it how much it needs till his/her desired date of
travel." Previously, seeing a readiness percentage required also manually filling in the separate
Financial readiness calculator (flight/accommodation/transport costs, etc.) — a real bank
statement scan alone (which already auto-fills a real closing balance) produced no percentage at
all. Added a new box right under the cash-flow table, in the "Income & bank statement analysis"
session, that compares the most recent closing balance detected from the statement against the
recommended 2× buffer on the rough trip-cost estimate (the same figure already shown in "Your trip
details" — one number, not a second one that could drift out of sync). Shows: the % ready, the
exact shortfall if any, and — if a travel date is set — a breakdown of roughly how much to save
per week and per month to close that gap in time, including a check against the applicant's own
recent average saving pace (from the scanned statement) so it can flag if the current pace won't
get there before the planned travel date. Verified the arithmetic exactly (closing balance ₦1.823M
against a 5-night estimate's ₦3,978,556 recommended buffer → 46% ready, ₦2,155,556 shortfall,
correct per-week/per-month figures) via a dedicated Playwright test using a synthetic bank
statement fixture, plus the two guard states (no statement scanned yet; no trip dates yet). Full
test suite (10/10) and the real-passport OCR regression check both passed.

## Pointed the passport-renewal link at the actual renewal portal
The "Start your renewal" link shown for an expired/soon-to-expire passport pointed at a general
Nigeria Immigration Service info page. Changed it to https://passport.immigration.gov.ng/ — the
actual passport application/renewal portal — so someone flagged with an expired passport lands
somewhere they can actually start the renewal, not just read about it.

## Added a dropdown to categorize unexplained/large bank inflows, instead of free text
The "Income sources breakdown" section already had a dropdown for grouped income sources (Business,
Family, Contribution, Work, Bonus, Sales, Others), but the separate "these payment(s) need an
explanation" boxes (for individual large or no-narration credits flagged on a bank statement) were
still a single free-text box. Per feedback: "Create a drop-down menu where the applicant picks...
salary, business, family, contribution, work, bonus, sales, gift & others. Under 'others' give the
applicants the chance to fill in the specifics." Added "Salary" and "Gift" to the shared category
list (now: Salary, Business, Family, Contribution, Work, Bonus, Sales, Gift, Others) and converted
the per-inflow explanation box to the same dropdown-plus-conditional-detail-field pattern already
used by the grouped section, so both places now work identically — pick a category, and only
"Others" asks for a free-text detail. Old sessions that saved a plain free-text explanation before
this change are automatically read as "Others" with that text preserved, so nothing typed before
this update is lost. Added a dedicated Playwright test with a synthetic bank statement fixture
(`tests/fixtures/bank-statement-sample.pdf`) that exercises the full flow: dropdown options and
order, "Others" reveals/requires a detail field, a non-"Others" pick saves and collapses
immediately, and the collapsed summary reflects whichever category was chosen. Full test suite
(9/9) passed, plus the existing real-passport-photo OCR regression check with no changes there.

## Fixed a real bug: a sideways/upside-down passport photo could silently give up on the wrong rotation
A user reported a passport photo that scanned as "Expires: not detected / MRZ checksum: not
detected" — a genuine failure, not a caching issue. Root cause: the automatic photo-orientation
retry (tries 0°/90°/180°/270° until it finds a readable machine-readable zone) had a shortcut that
stopped after the very first (straight-up, 0°) attempt as soon as it produced more than 150
characters of OCR text — on the assumption that a decent amount of extracted text meant the photo
was already the right way up. That assumption breaks for a passport bio page specifically: even
badly misread, upside-down glyphs still produce plenty of OCR "text" (742 characters, in the
reported case) — enough to trip the 150-character shortcut and skip the 90°/180°/270° retries that
would have actually found the real MRZ. Fixed by only trusting that early-stop shortcut for
non-passport documents (bank/business statements, employment letters — which have no MRZ to check
against anyway, and where the shortcut has been fine); a passport now only stops early once a
rotation produces a genuine, checksummed MRZ, or after all four rotations have been tried, and
falls back to the straight-up (0°) read (not "whichever rotation had the most raw characters") if
none of them find one. That second part mattered: an earlier version of this fix picked whichever
rotation had the longest OCR text when no rotation found an MRZ at all, which briefly regressed a
correctly-oriented passport in the regression check (a wrong rotation's garbled text happened to
be longer than the correct orientation's clean-but-MRZ-shy read) — caught by that same OCR
regression check before shipping, and fixed by defaulting to the 0° read instead. Verified against
the reported photo (now correctly reads expiry, name, and a 4/4 MRZ checksum match instead of
"not detected" across the board) and against the two known-good real passport photos already used
for regression testing (both still read "Checks passed", confirming no slowdown or regression for
the common, already-correctly-oriented case). Full test suite (8/8) also passed.

## Stopped asking for a passport that's already attached
Feedback: "Valid passport uploaded in session 1 why is it needed again at this junction.
Repetition kills user attention" — referring to the "Valid passport" item under Identity &
application still showing a raw, always-empty "Choose File" input and Scan button even after the
passport had already been attached via the "Attach & check expiry" quick-scan on Your trip
details. Investigated first: the underlying attachment state (filename, checked, scan result) was
already fully shared between the two spots — this was never actually asking for the document
twice — but a native file input can never show a previously-selected file, so it looked that way.
Fixed by collapsing the raw upload row behind a small "🔄 Replace file" toggle button whenever a
checklist item already has a file attached, mirroring the same collapse-after-use pattern already
used by the transport/sightseeing/currency helper panels. Clicking "Replace file" brings the
upload control back if the applicant genuinely needs to swap the file. Added a dedicated
Playwright test (`tests/passport-repetition-collapse.test.js`) exercising the full flow: attach
via the quick-scan → checklist item collapses → "Replace file" reopens it. Full test suite (8/8)
and the real-passport-photo OCR regression check both pass with no regressions.

## Made "how many people are travelling" a dropdown instead of three always-visible fields
Feedback: "Let this page be a drop down menu. Let it be called how many people are travelling,
then you choose the amount of adult, adolescents and children. This would make the page more
user friendly." Replaced the always-visible Adults/Adolescents/Children row with a single "How
many people are travelling on this application?" dropdown (1 through "8+"). Choosing "Just me"
keeps the breakdown fields hidden entirely; choosing anything else reveals the existing
Adults/Adolescents/Children fields (unchanged IDs, so nothing downstream — cost calculations,
progress tracking — needed to change) pre-filled with a sensible starting split that the applicant
can then adjust. The two stay in sync in both directions: editing the breakdown updates the
dropdown's count, and a breakdown that doesn't add up shows an inline note rather than silently
guessing. Also wired into reset, autosave/restore, and manual import so the dropdown always
reflects whatever's actually in the breakdown. Verified in a real browser: show/hide, auto-fill,
two-way sync, and reset all behave correctly; full test suite passes with no regressions.

## Reordered the session flow: bank statement analysis before the cost calculator
Feedback: "Let Session 3: Income & bank statement analysis become Session 2, while session 2 move
to Session 3. This would enable the user to stay and get immediate response." Applicants now see
real feedback on an uploaded bank statement (Income & bank statement analysis) right after Your
trip details, instead of first working through the full manual financial-readiness calculator.
Session order, labels, and pill numbering are all computed from one array
(`getVisibleSessionKeys()`), so this was a one-line change with no hidden dependencies. Three
existing tests hardcoded the calculator's old position and were updated accordingly. Verified
against the live-rendered session order in a real browser; full test suite (7/7 at the time) and
the OCR regression check both passed.

## Changed the builder credit from "AfeniyeS" to "SafeNetwork"
From one of the outstanding voice notes. Updated both places the name appears — the consent-gate
credit line ("Built by...") and the "Hi, I'm..." personal note further down — keeping the same
"free personal project, not a company" framing and contact links unchanged. The consent-gate
subtitle the same voice note quoted ("A personal document-readiness checklist for Nigerian visa
applicants. Pick which visa you're preparing for to get started.") was already exactly this
wording, so no change was needed there.

## Added a rough worst-case cost estimate right in the trip session
Previously the only way to see an estimated trip cost was to navigate to the financial calculator
and fill in every figure by hand. Added a quick, auto-computed "rough worst-case cost estimate"
that appears as soon as travel and return dates are both entered, right where the trip-length line
already shows — covering hotel (₦50,000/night), local transport (cheapest option, bus, reusing the
same £6/day rate as the financial calculator's transport helper), shopping (£100 minimum), and a
static, clearly-labeled flight ballpark (₦1,500,000 — the low end of the existing flight-cost
placeholder range elsewhere in this file; there's no live fare source, so this is explicitly framed
as indicative only, not a quote). Totals and the recommended 2× buffer figure are shown together.
Deliberately reuses the exact same rates already established elsewhere in the file rather than
introducing a second set of numbers that could drift out of sync. Verified in a real browser: shows
the correct numbers once both dates are entered, hides again if dates are cleared or incomplete.

## Investigated a "missing features" report — root cause was GitHub Pages/browser caching, not a bug
The founder reported the old "Planned length of stay" dropdown and the newer employer/business
name field both appeared to be missing on the live site right after a deploy. Checked the actual
shipped code — both were already correctly implemented and present. The likely cause was GitHub
Pages' CDN needing a minute or two to propagate a fresh deploy, combined with normal browser
caching; a hard refresh after the deploy settles resolves it. No code changes were needed for this
one — noted here so a future "it's missing" report is checked against the deployed source first.

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
