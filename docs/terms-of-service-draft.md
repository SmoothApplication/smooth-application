# Terms of Service — DRAFT

**Status: draft for lawyer review. Do not publish as-is.** The most important job of a real ToS
here is drawing a clear line around the regulatory risk described below — get that reviewed by a
lawyer before this product scales or takes on paying/professional relationships.

## 1. What this is

Smooth Application ("the tool") is a free, self-service document-preparation checklist for
applicants preparing a UK Standard Visitor visa or Canada visitor visa (TRV) application. It
helps you organize and sanity-check documents you plan to submit yourself, directly to the
relevant government authority or your Visa Application Centre.

## 2. Not immigration advice — the core boundary

This is the section most worth a lawyer's attention, given the product sits close to a regulated
activity in both the UK (OISC-regulated immigration advice) and Canada (RCIC-regulated
immigration consulting).

- The tool does **not** provide legal or immigration advice.
- The tool does **not** assess your individual eligibility, decide whether you should apply, or
  guarantee any outcome.
- The tool does **not** submit anything on your behalf, and does **not** communicate with UKVI,
  IRCC, or any Visa Application Centre.
- The checklist reflects general, publicly published guidance (gov.uk, canada.ca / IRCC's IMM
  5484) as understood at the time it was written, and general heuristics, not official policy —
  requirements change and can vary by individual case.
- Financial-readiness figures are heuristic starting points, not thresholds guaranteed by any
  authority.
- Automated document scans are a best-effort, on-device technical check (OCR + checksum/format
  validation) and cannot confirm a document is genuine or that your case will succeed.
- Users with complex cases, past refusals, or unusual circumstances are directed to a regulated
  immigration adviser (OISC-registered in the UK, RCIC-registered in Canada).

*[Lawyer note: confirm whether the current feature set already crosses into regulated "immigration
advice"/"immigration consulting" activity under UK or Canadian law, and whether any specific
wording changes (or feature restrictions) are needed to stay clearly on the "self-help tool" side
of that line — this gets more important, not less, as the product adds more automated guidance.]*

*[Lawyer note, added when Sessions 1–3 (passport validation, Travel Experience, Your
responsibilities) were built: Session 2's country-visit "grading" summary uses language —
"Congratulations," "you are qualified for the next level," "high chance of success" — that reads
as an eligibility/outcome prediction, in direct tension with the "does not assess your individual
eligibility... or guarantee any outcome" line above. This was flagged to the product owner before
building; they explicitly chose to keep this language as specified, accepting the risk pending
review. Needs a decision: either soften the copy to informational-only framing (e.g. "this is
commonly seen as a positive sign," not "you qualify"/"you have a high chance"), or confirm the
existing "not immigration advice" disclaimers are legally sufficient to cover it as-is. See
index.html's updateTravelExperienceGrade() function for the exact copy in question.]*

## 3. No warranty / limitation of liability

[Lawyer note: standard "as-is," no warranty of accuracy or fitness for a particular purpose,
liability cap language goes here. Given the subject matter (visa applications, real financial and
legal consequences for users if they rely on inaccurate guidance), this section should be drafted
carefully rather than using a generic template.]

## 4. User responsibilities

- You are responsible for verifying all requirements directly with the relevant government
  authority before submitting your application.
- You are responsible for the accuracy of any information you enter.
- The tool should not be your only source of guidance for a complex or previously refused case.

## 5. No account, no data retention by us

There is no user account. Data you enter is stored only in your own browser (see Privacy Policy).
We do not retain a copy of your documents or answers.

## 6. Availability

The tool is provided free of charge, "as available," with no guaranteed uptime. [Lawyer note: add
language here if/when a paid tier is introduced — see `monetization-strategy.md`.]

## 7. Governing law / jurisdiction

[Lawyer note: needs a decision once the business entity is registered — see
`ip-ownership-notes.md` — since this affects which law applies and where disputes would be
resolved.]

## 8. Changes

[Lawyer note: standard "we may update these terms" language, effective date, contact method.]
