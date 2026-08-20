# Handling real user data safely

This project is built almost entirely off real user reports — screenshots, bank statements,
reconciliation spreadsheets, and direct messages describing a bug in their own words. That's a
strength: it's why the statement-analysis logic handles as many real-world edge cases as it does.
It's also the source of every privacy incident this repo has had so far.

Twice, a real user's data — a name, a business/church name, a passport number and date of birth —
was copy-pasted directly from a bug report into a file that got committed to this public repo,
before anyone thought to fictionalize it. Both times it was found and scrubbed after the fact, on a
manual review. A scanner (`scripts/pii-scan.js`) now runs automatically before every ship and in CI
to catch this going forward — but a scanner is a backstop, not a substitute for doing this right at
the point the data first touches a file.

## The rule

**A real user's name, business name, passport number, account number, phone number, date of birth,
or address never gets typed into a file that will be committed — not as a code comment, not as a
test fixture, not as changelog narrative, not "just for now."**

This applies even when the real data is the whole point of the bug report (e.g. "the parser choked
on my passport number B5xxxxxxx") — especially then, since that's exactly the case that's leaked
twice already.

## The process

When a real user report becomes a regression test or a changelog entry:

1. Read the real report to understand the actual bug. Keep it in the conversation/notes, not in a
   file.
2. Before writing anything to disk, invent replacement data that preserves whatever structural
   property the bug actually depends on — a name that's the same number of words if word-count
   matters to the matching logic, an ID with the same checksum-valid structure if a checksum is
   what's being tested, a business name in the same "word A + word B + generic suffix" shape if a
   stopword rule is under test — but is otherwise unambiguously fictional.
3. Author the fixture/comment/changelog entry using ONLY the fictional data.
4. Run `npm run pii-scan` before shipping (this also runs automatically in CI on every push and PR
   — see below).

If a leak is found later anyway (by the scanner, by a human, by anyone):

1. Scrub it wherever it appears — code comments, test files, fixtures, CHANGELOG.md. A leak in a
   *comment describing* a fixture is just as real as a leak *in* the fixture.
2. Add the exact string(s) to the `DENYLIST` in `scripts/pii-scan.js`, with a one-line note on what
   it was. This is what makes the fix permanent — without it, the same string could silently be
   reintroduced later (e.g. by copying an old local file back in) with nothing to catch it.

## Why PDF fixtures need special care

Grepping a PDF fixture's raw bytes for a name does **not** reliably find it — PDF content streams
are typically compressed, so the visible text isn't present as plain bytes in the file. This is not
hypothetical: it's exactly how a real passport number and name survived two earlier manual scrub
passes inside `dob-digit-misread-fixture.pdf` before the scanner (which extracts text properly via
`pdftotext` first) caught it. Always verify a PDF fixture's actual extracted text — via `pdftotext
-layout file.pdf -` or the scanner — never just its raw bytes.

## Running the scanner

```
npm run pii-scan
```

Scans every git-tracked file by default (or pass specific paths — this is what CI does for a
delivery batch's changed files, and what should happen manually before building a delivery zip).
Exits non-zero if anything on the known-leak `DENYLIST` is found. It also prints (non-blocking)
structural warnings for things that *look like* a real passport number, phone number, or BVN, even
if we don't have a specific denylist entry for it — worth a glance before shipping, but not a
blocker, since our own fixtures deliberately contain realistic-looking fake IDs by design.

## What this doesn't cover

The scanner catches known-shape leaks in text and PDF content. It can't tell a fictional name from
a real one it's never seen before — that's still on whoever's authoring the fixture, following the
process above. Treat the scanner as the last line of defense, not the first.
