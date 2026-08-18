# Changelog

Development milestones to date, grouped by feature batch rather than exact dates (this repo's
git history starts from the current state — see `docs/ip-ownership-notes.md` for why).

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
   names, e.g. "Rolez Crisp N Clean Exclusive Solutions" instead of just "Crisp N Clean Exclusive
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
distinctive word (e.g. "Clean" in both "Crisp N Clean..." and an unrelated "Clean Deals Ventures") can
occasionally get swept in as a false-positive match. Neither is new to this change, but both are worth
a dedicated follow-up if you'd like them tightened up.

## Employer/business-matched bank inflows are now listed and explained individually, not grouped

User request, off a real statement with 19 credits matching a declared employer/business: "Instead
of grouping the 19 transactions from Crisp N Clean Exclusive Ltd must be explained." The "Work
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

A real applicant hit three separate problems in the same session, reported together: "After the name
is generated from the passport, the o in Oluwafunmilayo read as zero '0'. Also, Her GTB bank statement
showed [an] error message. She tried her sterling bank account but it did not read." All three are
fixed.

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
mid-word cut like "Limite" (as seen in the earlier "CRISP N CLEAN EXCLUSIVE SOLUTIONS LIMITE" report)
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
User feedback, after seeing "Found 'MFM Lekki Youth Church', 'Crisp N Clean Exclusive Solutions Ltd'
referenced in this bank statement": "the place you work is where the visa officer wants to see at
least monthly inflows from, state how many inflow comes in from the employer or business name
extracted from the bank statement... [also] check for the narration" — pointing to a real narration
line like "NIP/ROLEZ/CRISP N CLEAN EXCLUSIVE SOLUTIONS LIMITE/February Salary/AT68TRF2...", noting
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
