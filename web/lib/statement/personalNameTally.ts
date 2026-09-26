// Port of index.html's account-holder-name-vs-applicant's-own-declared-name check (~line 14811-
// 14842) — the PERSONAL-statement counterpart to businessDrawings.ts's buildNameTallyMessage (built
// for the business statement's own "Business name" field, follow-up selection "Wire travel history
// into the Reasons tab"'s predecessor). Kept as its own function rather than reused, since the
// wording and behavior differ in two ways the original itself specifies:
//   - A married applicant who's declared their spouse as sponsor (workAnswers.married &&
//     workAnswers.spouseSponsoring && workAnswers.spouseName) is the one case where a mismatched
//     account holder is EXPECTED, not a red flag — index.html confirms it "looks right" rather than
//     warning, since the whole point of that flow is using the spouse's own statement instead of
//     the applicant's.
//   - The failure message itself points toward sponsor documentation rather than "upload a
//     statement in your own name", since a genuine third-party statement is a real, valid path here
//     (via a signed sponsor letter) — unlike the business ledger, where the business name IS the
//     applicant's own declared business and there's no equivalent "someone else's" path.
//
// Deliberately excludes the original's coarser "does the applicant's name appear anywhere in the
// statement text" fallback for when no account-holder header is found (nameAppearsInStatementText,
// original ~14836-14840) — same reasoning already disclosed for the business-statement version:
// this app never persists raw statement text, and re-running that fallback later (if the applicant
// edits their typed name after scanning — the same order of operations as the business ledger's
// "Business name" field) would require keeping the raw text around just to make it possible. Stays
// silent in that case instead of a check that might read a stale answer.
import { namesLooselyMatch } from './names';

export type PersonalNameTallyStatus = 'ok' | 'warn';

export interface PersonalNameTallyMessage {
  status: PersonalNameTallyStatus;
  message: string;
}

/** Just the three fields this check needs from the wider Answers type — kept narrow so this module
 * doesn't need to import the UK-specific Answers shape (this check applies to every country). */
export interface SpouseSponsorDeclaration {
  married: boolean;
  spouseSponsoring: boolean;
  spouseName: string;
}

export function buildPersonalNameTallyMessage(
  declaredName: string,
  detectedHolderName: string | null,
  spouse: SpouseSponsorDeclaration
): PersonalNameTallyMessage | null {
  if (!declaredName || !declaredName.trim() || !detectedHolderName) return null;
  const match = namesLooselyMatch(declaredName, detectedHolderName);

  if (match === 'fail') {
    const isDeclaredSpouseStatement =
      spouse.married &&
      spouse.spouseSponsoring &&
      !!spouse.spouseName &&
      namesLooselyMatch(spouse.spouseName, detectedHolderName) !== 'fail';

    if (isDeclaredSpouseStatement) {
      return {
        status: 'ok',
        message: `This looks like your spouse's statement (account holder "${detectedHolderName}") - since you've declared them as your sponsor, that's expected. Just make sure their signed sponsor letter is attached alongside it.`,
      };
    }
    return {
      status: 'warn',
      message: `This statement's account holder appears to be "${detectedHolderName}", which doesn't match the name you entered ("${declaredName}"). If this is your own account, double-check you've uploaded the right file, or that your name is spelled/typed the same way here as on your account. If it genuinely belongs to someone else supporting your trip (a parent, spouse, relative, etc.), it needs to go through sponsor documentation instead - a third party's statement generally isn't accepted as evidence of your OWN funds without a covering sponsor letter explaining the relationship.`,
    };
  }

  if (match === 'ok') {
    return {
      status: 'ok',
      message: `Account holder name detected as "${detectedHolderName}" - matches what you entered as your name, a good sign this is your own statement.`,
    };
  }

  // 'partial' - some but not all name words matched. Stays silent, same as the business-statement
  // version, rather than raising an alarm (or false reassurance) off an ambiguous match.
  return null;
}
