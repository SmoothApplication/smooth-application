// Ported from tests/account-holder-name-check.test.js.
// User question: "How do we handle those who upload wrong bank statement that doesn't tally with
// their names" -- extractAccountHolderName reads the "Account Name:" (or Customer Name / Name of
// holder / A/C Name) header off the statement text itself; namesLooselyMatch is then used to
// cross-check that detected holder name against the name the applicant typed in, flagging a clear
// mismatch instead of silently accepting a statement that isn't theirs. The original test drove this
// through a full PDF-upload UI cycle; here we call extractAccountHolderName/namesLooselyMatch
// directly against realistic extracted statement text.
import { extractAccountHolderName, namesLooselyMatch } from '../names';

test('extracts the account holder name from an "Account Name:" header and matches the applicant', () => {
  const statementText =
    'BANK STATEMENT\nAccount Name: TEST APPLICANT\nAccount Number: 0123456789\nStatement Period: 01/01/2026 - 31/03/2026';
  const holder = extractAccountHolderName(statementText);
  expect(holder).not.toBeNull();
  expect(namesLooselyMatch('Test Applicant', holder as string)).toBe('ok');
});

test('flags a clear mismatch when the statement belongs to someone else', () => {
  const statementText = 'BANK STATEMENT\nAccount Name: MICHAEL EMEKA OKONKWO\nAccount Number: 9988776655';
  const holder = extractAccountHolderName(statementText);
  expect(holder).not.toBeNull();
  expect(/MICHAEL EMEKA OKONKWO/i.test(holder as string)).toBe(true);
  expect(namesLooselyMatch('Test Applicant', holder as string)).toBe('fail');
});

test('recognises "Customer Name" / "Name of holder" / "A/C Name" label variants too', () => {
  expect(extractAccountHolderName('Customer Name: JANE DOE\nAccount No: 111')).toMatch(/JANE DOE/i);
  expect(extractAccountHolderName('Name of Account Holder: JOHN SMITH\nBranch: Lagos')).toMatch(/JOHN SMITH/i);
  expect(extractAccountHolderName('A/C Name: MARY JONES\nCurrency: NGN')).toMatch(/MARY JONES/i);
});

test('returns null (no check performed) when the statement format is not recognised at all', () => {
  expect(extractAccountHolderName('SOME RANDOM STATEMENT TEXT WITH NO RECOGNISED LABEL')).toBeNull();
  // Guard: with no applicant name typed in, there is nothing to cross-check against, so the caller
  // simply never invokes namesLooselyMatch — extractAccountHolderName itself doesn't need an
  // applicant name and returning a holder name here is independent of that guard, exercised instead
  // at the call-site (an empty/undefined applicant name skips the comparison in the app entirely).
  const holder = extractAccountHolderName('Account Name: SOME PERSON');
  expect(namesLooselyMatch('', holder as string)).toBeNull();
});
