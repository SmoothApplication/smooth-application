// Direct user pushback: "this is not user friendly, the user would not know he needs to upload
// another bank statement." Renaming the re-upload button (see StatementSlot.tsx's own history) only
// ever fixed half the problem — an applicant has no way to know a parsing fix shipped at all unless
// someone personally tells her to go click something. The actual fix: stamp every saved statement
// with the parser version that produced it, and have the app itself notice when that's behind the
// CURRENT version, so it can say so plainly instead of leaving staleness invisible.
//
// Bump this whenever a change to the parsing/name-extraction/classification pipeline would produce
// a MEANINGFULLY DIFFERENT result for an already-saved statement — a new narration pattern handled,
// a grouping/name-cleanup fix, a new transaction-type keyword recognised, and so on. Do NOT bump it
// for UI-only changes, new optional fields, or anything that doesn't change what gets extracted from
// the SAME raw statement text.
//
// History:
//   1 — baseline (every payload saved before this stamp existed is treated as version 0/undefined,
//       always "behind" — see isStatementStale below)
//   2 — REMITA "U:" field-separator truncation + "REMITA INFLOW R" boilerplate trim (task #515/#516)
//   3 — "ACCOUNT TRANSFERS" leading-wrap opener keyword + glued-repeated-name corruption detection
//       (this change)
export const CURRENT_PARSER_VERSION = 3;

/** True when a previously-saved statement's parser version is older than the running app's, meaning
 * a parsing/name-cleanup fix has shipped since it was last analyzed and re-uploading the SAME file
 * would very likely produce a cleaner result. Missing/undefined (any payload saved before this
 * stamp existed) always counts as stale — there is no way to know what it was analyzed with, and in
 * practice every real fix to date predates this stamp's introduction anyway. */
export function isStatementStale(savedParserVersion: number | undefined | null): boolean {
  return !savedParserVersion || savedParserVersion < CURRENT_PARSER_VERSION;
}
