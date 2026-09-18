# Per-bank SEO guides — ready to publish

Three long-form guides per `marketing-plan.md` §6 ("How [bank] statements are read for UK visa
applications" — one per bank already validated in the engine). Written as standalone landing
pages/articles, not forum posts (see `seo-blog-posts.md` for the shorter Nairaland-style version) —
these are meant to actually rank for their target keyword, so they're longer, more structured, and
lean on genuine specificity nobody else can credibly write, since nobody else has actually parsed
these banks' narration formats. Same honest framing as everywhere else: document-organization tool,
not immigration advice, no probability/outcome claims (see `marketing-plan.md` §5's OISC caution —
this is the one thing to never drift on, even in a single line of marketing copy).

Zenith is where the whole product started — the founder built and tested the very first version of
the statement analyzer against his own real Zenith statement, and two of the engine's genuine bugs
(a missing-salary-month gap, blank-narration employer transfers) were found on that real statement,
not invented for a demo. Worth leading with that origin story in the Zenith guide specifically — it's
true, and it's a stronger trust signal than a generic "I built this" line.

Guides 4 (Fidelity) and 5 (WEMA/ALAT) below were added after real Fidelity and WEMA statements were
tested against the engine directly. The WEMA test found one genuine bug (an undecoded "eTZ:" channel
code bleeding into extracted sender names, fixed the same way the earlier ROLEZ/ONB/NIP channel-code
bugs were), which is worth mentioning honestly rather than pretending every bank was already perfect —
it's the same "we actually test against real statements" claim the Zenith guide makes, just repeated
with fresh evidence. All names, account numbers, and addresses from the real statements are fictionalized
below per the same anonymization approach as everywhere else in this file.

**Target keywords:** "[bank] statement UK visa", "UK visa proof of funds Nigeria" (see
`marketing-plan.md` §6 for the full cluster). **Where to publish:** either as real pages on the site
itself (best for SEO — the marketing plan flags the current single-page app as "thin on crawlable
text") or as standalone blog posts if a blog isn't part of the site yet. Track referral source via
the existing `?src=` GoatCounter pattern (see `landing-source-tracking.test.js`) if posted
externally, e.g. `?src=seo-sterling-guide`.

---

## Guide 1 — Sterling Bank

**How Sterling Bank statements are read for a UK visa application**

If you bank with Sterling and you're preparing a UK Standard Visitor visa application, your bank
statement is about to become the single most scrutinized document in your file. UK visitor visa
refusals for Nigerian applicants ran at 38.6% in 2025 — nearly 2 in 5 — and financial evidence is
the most common reason cited, according to the Home Office's own published entry-clearance data.
Most of those refusals aren't about not having enough money. They're about a statement that doesn't
tell a clear, traceable story.

Here's what actually happens when a reviewer opens a Sterling Bank statement, and what's worth
checking on your own before you submit.

**Your salary credits need a name attached, not just a code.** Sterling's own transfer narrations
often show up as something like `BANKNIP From 090405 PAYREF: - SENDER: [name]` — the sender field is
there, but it's easy to overlook if you're just scanning for the amount. If your declared employer's
name doesn't actually appear anywhere in that narration, a reviewer has no way to connect your stated
job to the money in your account. Worth checking every salary credit against this, not just the most
recent one.

**Reversed transactions look like real inflows unless you know what to look for.** A failed or
reversed transfer often shows up marked `RVSL` — or, just as often on real Sterling statements,
`RSVL` (the letters transposed) — sitting right alongside genuine credits. If your total income
figure quietly includes money that bounced back to you, your real income looks higher than it
actually is, which is worse than it sounds: a reviewer who later notices the reversal will wonder
what else in your statement doesn't add up.

**Self-transfers between your own accounts aren't income, but they can look like it.** Moving money
from your savings to your current account, or between two accounts in your own name, often narrates
with your own name as the "sender" — which, read naively, looks like a third party paying you
repeatedly. A reviewer who doesn't recognize this pattern may flag it as an unexplained recurring
source; one who does will just wonder why it's there at all.

**A single large, unexplained credit is the single most common flag.** Whether it's a business
payment, a gift, or a loan repayment, a big number with no narration and nothing before it to explain
where it came from reads as "borrowed for the application" — even when it isn't. The fix costs
nothing: write a one-line note for yourself (or your covering letter) for every inflow like this,
before a reviewer has to guess.

None of this means your Sterling statement is a problem — most aren't. It means a statement is much
stronger when you've gone through it the way a reviewer will, before they do. I built a free tool
that does exactly this for Sterling and several other Nigerian banks — reads your statement narration
by narration, flags reversed transactions, matches salary credits against your declared employer,
separates your own self-transfers from real income, and lists every inflow that would need a one-line
explanation. Everything runs in your own browser; nothing you upload ever leaves your device. Not
immigration advice — just an honest second pair of eyes before your appointment:
https://smoothapplication.github.io/smooth-application/

---

## Guide 2 — Opay

**How Opay statements are read for a UK visa application**

Opay has become one of the most commonly used accounts among younger Nigerian applicants preparing a
UK visitor visa — and it comes with a few narration quirks that trip up both applicants and, if
they're not careful, the tools meant to help them.

The Home Office's own 2025 data puts the UK visitor visa refusal rate for Nigerian applicants at
38.6%, and financial evidence is consistently the most-cited reason. A statement that reads clearly
is worth more than one that just shows a healthy balance. Here's what's specific to Opay.

**"OWealth Interest Earned" credits are not income — and they can look genuinely strange if
misread.** Opay's automatic savings product, OWealth, pays small daily interest credits that narrate
with no sender name at all — just a timestamp, the product name, and a long reference token, e.g. "07
Aug 2026 01:40:30 OWealth Interest Earned -- Mobile uJ 260808994uHYYGJHzJblKYq3Jmt1". Read
naively, that reference token can get mistaken for a person's name, producing a garbled "sender" that
looks like unexplained income from someone unidentifiable. It isn't income from a person or company
at all — it's interest your own money earned sitting in your own wallet, and it should never need an
explanation. Worth checking that any statement-review process (yours, an agent's, or a tool's)
recognizes this and doesn't flag it as a mystery sender.

**Airtime top-ups and SMS charges are small enough to hide in "recurring income" if you're not
careful.** Frequent small debits and their related notification charges can, purely by coincidence of
rounding, cluster around the same amount as a genuinely recurring source — which risks a real gift or
small side income getting misclassified, or worse, genuinely irrelevant charges getting swept into an
"income" total that's supposed to represent your real financial picture.

**NIP transfers into Opay carry the same "unexplained large credit" risk as any other bank.** A
big one-off transfer with no narration reads the same way here as anywhere else — as unexplained,
not necessarily as fraudulent, but as something a reviewer will want a story for.

**Self-transfers between your own Opay wallet and a linked account can narrate with your own name,**
the same self-transfer pattern seen on traditional bank statements — easy to mistake for a repeating
third-party sender if you're going through the statement quickly.

If you're relying on Opay as your primary account for a UK visa application, it's worth going through
your statement narration by narration rather than just checking the closing balance. I built a free
tool that already handles Opay's specific quirks — separates OWealth interest from real income,
excludes airtime/SMS charges from your income total, flags self-transfers, and lists every genuinely
unexplained inflow that needs a one-line note — alongside the rest of your document checklist.
Everything runs in your own browser; nothing you upload is ever sent anywhere. Not immigration advice
— just what's worth checking before you submit: https://smoothapplication.github.io/smooth-application/

---

## Guide 3 — Zenith Bank

**How Zenith Bank statements are read for a UK visa application**

I built the very first version of this tool against my own Zenith Bank statement. Not a sample file,
not a demo dataset — my real statement, with all the messy narration formatting real Nigerian bank
statements actually have. Two of the genuine bugs I found and fixed came straight from going through
it line by line, and they're both things worth knowing if Zenith is your own bank.

The Home Office's own published data puts the UK visitor visa refusal rate for Nigerian applicants at
38.6% in 2025 — nearly 2 in 5 — and financial evidence is the most commonly cited reason. Here's what
a Zenith statement specifically needs checking for.

**A gap in a month-named salary pattern stands out more than you'd think.** Some employers' payments
through Zenith narrate with the month spelled right into the transaction — "...February Salary...",
"...March Salary..." — which is genuinely helpful, until one month goes missing. On my own statement,
salary payments continued from the same employer for months, but one particular month never got its
own "<Month> Salary"-labelled payment. To someone reviewing it quickly, that's an easy thing to miss.
To someone building software to check it automatically, that's an easy thing to get wrong too — my
first version didn't catch it either, until I went back through my own months side by side and
noticed the gap myself. If any of your salary payments name their own month, it's worth checking every
month in between is actually accounted for, not just the most recent one.

**A payment can be confirmed from your employer and still carry zero useful detail.** Some genuine
salary-source payments through Zenith narrate as nothing more than "TRANSFER TO [your name] FROM
[employer name]" — the sender is right there, confirmed, but there's no further detail about what
that specific payment actually was for that month. It's not suspicious, it's just terse. The fix
isn't to guess — it's to have a short, honest note ready for payments like this, since "confirmed from
my employer, no further detail available" is a perfectly reasonable thing to tell a reviewer, but only
if you've actually noticed the gap yourself first.

**The usual patterns apply here too.** A large one-off credit with no narration, a reversed transfer
that shouldn't count toward your real income, or a self-transfer between your own accounts narrating
with your own name as the "sender" — none of these are Zenith-specific, but they show up on Zenith
statements exactly as often as anywhere else, and they're worth checking for regardless of which bank
you use.

I ended up building the free version of this check because I wanted to go through my own Zenith
statement the way a visa reviewer actually would, not just glance at the closing balance — and it
grew from there into a tool that now checks statements from Sterling, Opay, and several other Nigerian
banks too. It reads your statement narration by narration, flags missing salary months, separates
genuine income from reversals and self-transfers, and lists every inflow that would need a one-line
explanation, alongside the rest of your document checklist. Everything runs in your own browser;
nothing you upload ever leaves your device. Not immigration advice — just the same check I ran on my
own statement before building this for everyone else:
https://smoothapplication.github.io/smooth-application/

---

## Guide 4 — Fidelity Bank

**How Fidelity Bank statements are read for a UK visa application**

Fidelity is one of the more detailed statement formats among Nigerian banks — every single transaction,
right down to a ₦12 SMS alert charge, gets its own line, with a running balance after each one. That
level of detail is genuinely useful for a visa reviewer, but it also means a Fidelity statement can run
to a dozen or more pages, and it's easy for a handful of things that actually matter to get lost in the
noise of small recurring charges.

The Home Office's own published data puts the UK visitor visa refusal rate for Nigerian applicants at
38.6% in 2025, and financial evidence is the most commonly cited reason. Here's what's worth checking
specifically on a Fidelity statement.

**Salary and gift credits carry the sender's name after a short reference code — worth reading past
the code, not just the amount.** Fidelity's own transfer narrations often read like "AROMIRE
RAMAT /Gift to [your name]" or "ISIOMA MARYLIND/MOBILE TRF TO FID Gift from isioma" — the sender's
name is right there, but it sits after a slash-separated reference marker that's easy to skim past.
Worth checking that every credit you're relying on actually has a real name attached, not just a
reference code.

**Transfers between your own linked accounts narrate with your own name as the "sender," the same
self-transfer pattern seen on every other bank.** A line like "IBUKUNOLUWA ADE/MOBILE TRF TO FID
IBUKUNOLUWA ADE" is money moving from one of your own accounts to another, not third-party income —
easy to mistake for a repeating outside source if you're reading quickly. This gets more confusing
still if you've changed your name (married name vs. maiden name, for instance) since some of these
self-transfers may show up under a name that doesn't match your current ID at first glance, even
though it's genuinely you.

**A single large, recurring "business" sender is worth having a one-line explanation ready for, even
if it's completely legitimate.** Repeated large credits from the same named source (an FX transfer, a
business partner, a remittance company) look, on paper, exactly like the "unexplained large credit"
pattern reviewers are trained to flag — the difference is whether you can explain it in one sentence.
If it's genuinely part of your income, say so plainly rather than leaving it to speak for itself.

**Stamp duty charges on nearly every transfer are normal, not a red flag.** Fidelity charges a small
stamp duty (usually ₦50) on many transfers in and out — this is a standard Nigerian bank charge, not
something specific to your account, and doesn't need an explanation.

None of this means anything is wrong with a Fidelity statement — it means a statement this detailed is
worth actually reading through once, the way a reviewer will, rather than just checking the final
balance. I built a free tool that does exactly this — reads every narration, separates real income from
self-transfers and charges, and flags every credit that would need a one-line explanation, alongside
the rest of your document checklist. Everything runs in your own browser; nothing you upload ever
leaves your device. Not immigration advice — just an honest second pair of eyes before your appointment:
https://smoothapplication.github.io/smooth-application/

---

## Guide 5 — WEMA Bank / ALAT

**How WEMA Bank (ALAT) statements are read for a UK visa application**

ALAT, WEMA's digital banking product, has its own narration style — and one real quirk that, until
recently, wasn't handled correctly by the tool below either, which is worth being upfront about rather
than pretending every bank format was perfect from day one.

The Home Office's own 2025 data puts the UK visitor visa refusal rate for Nigerian applicants at
38.6%, and financial evidence is the most commonly cited reason among refusals. Here's what's specific
to a WEMA/ALAT statement.

**Some inbound transfers narrate with an "eTZ:" channel code stuck directly in front of the sender's
name.** A real ALAT narration can read "eTZ:[sender name]-[note]" — "eTZ" is short for eTranzact, one
of the interbank transfer channels a sending bank can use, not part of anyone's actual name. Read
naively (by a person skimming quickly, or by an automated tool that hasn't specifically been taught to
recognise it), that channel code can end up glued onto the front of the extracted name, turning a clean
sender into something that reads like a garbled, unrecognisable one. This is exactly the kind of thing
that makes a statement look messier and less trustworthy than it actually is. It's also, honestly, a
bug this tool itself had until a real WEMA statement surfaced it — fixed the same way the equivalent
NIP/ONB channel-code issues were fixed for other banks, by teaching the parser to recognise and skip
past it.

**Self-transfers between your own accounts narrate with your own full name as the "sender," same as
every other bank.** A line like "NIP:[your own name]-House Maintenance" or an "ALAT NIP TRANSFER TO
[your name] FROM [your name]" is money moving between accounts you control, not third-party income —
worth recognising as such rather than counting it toward your real income total.

**If you use your ALAT account to collect recurring payments from many different people for the same
stated reason — rent, utility contributions, service fees — that pattern is real income, but it looks
unusual enough that a reviewer will want it explained clearly, not left to speak for itself.** Several
different named senders, each paying a similar amount for the same one- or two-word reason, repeating
month after month, reads very differently from a single employer's salary — neither better nor worse,
just a pattern worth having a short, clear explanation ready for (what the payments are for, and why
they come from several people rather than one).

**Outgoing ALAT transfers show their VAT and commission as separate line items.** You'll see a single
transfer split into two or three lines — the transfer itself, a "COMM" (commission) charge, and a
"VAT" charge — all for the same underlying payment. This is normal ALAT formatting, not duplicate
transactions, and doesn't affect your income total since all three are debits.

I built a free tool that reads WEMA/ALAT statements narration by narration — recognising the eTZ
channel code, separating self-transfers from real income, and flagging every credit that would need a
one-line explanation — alongside the rest of your document checklist. Everything runs in your own
browser; nothing you upload ever leaves your device. Not immigration advice — just what's worth
checking before you submit: https://smoothapplication.github.io/smooth-application/

---

## Guide 6 — GTBank (GTCO)

**How GTBank statements are read for a UK visa application**

GTBank's statement format splits each transaction across a "Reference" column and a longer free-text
"Remarks" column — the reference alone ('GTW', 'BR', 'API' and similar) tells you almost nothing; the
actual sender, purpose, and channel are all in the remarks. Worth reading the remarks column in full
rather than the short reference code next to it.

The Home Office's own 2025 data puts the UK visitor visa refusal rate for Nigerian applicants at
38.6%, and financial evidence is consistently the most-cited reason. Here's what's worth checking
specifically on a GTBank statement.

**Some family transfers identify the sender only by a relationship label, not a full registered
name.** Unlike Sterling or Fidelity, where the sender's name almost always appears in full, a GTBank
"Transfer Between Customers" remark can read something like "...MOBILE TRF TO GTB FROM MUM -
[purpose]" — the sender shows up as "MUM," not a name. That's genuinely useful context for you (you
know exactly who it is), but it isn't something a reviewer — or an automated reader — can verify or
match against anything. Worth having a short note ready that spells out who the relationship label
actually refers to.

**Dividend payments from a share registrar look unlike any other kind of credit on the statement.** A
remark like "...FROM DATAMAX REGISTRARS/GTCO DIV PYT..." is a dividend payout processed through a
registrar company, not a person or an employer — genuine income, but worth explaining as investment
income specifically, since on its face it doesn't match "salary" or "family gift" and a reviewer
shouldn't have to guess which it is.

**Self-transfers between a linked mobile wallet (e.g. Opay) and your GTBank account narrate with your
own name on both sides,** the same self-transfer pattern seen on every other bank — worth recognising
as money moving between your own accounts, not third-party income.

**Every outward transfer on GTBank shows its VAT, commission, and stamp duty as separate line items,**
the same as WEMA/ALAT — normal formatting, not duplicate transactions, and none of it affects your
income total since these are all debits.

I built a free tool that reads GTBank statements remark by remark, separates real income (salary,
family transfers, dividends) from self-transfers and charges, and flags every credit that would need a
one-line explanation, alongside the rest of your document checklist. Everything runs in your own
browser; nothing you upload ever leaves your device. Not immigration advice — just an honest second
pair of eyes before your appointment: https://smoothapplication.github.io/smooth-application/
