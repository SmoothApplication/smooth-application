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

test('recognises "Client Name" / "Account Title" / "Name of Customer" / "Full Name" label variants (user report: name not being extracted)', () => {
  expect(extractAccountHolderName('Client Name: DAVID OYELARAN\nAccount No: 222')).toMatch(/DAVID OYELARAN/i);
  expect(extractAccountHolderName('Account Title: CHIOMA NWACHUKWU\nSort Code: 123')).toMatch(/CHIOMA NWACHUKWU/i);
  expect(extractAccountHolderName('Name of Customer: BOLA SHOWUNMI\nBranch: Ikeja')).toMatch(/BOLA SHOWUNMI/i);
  expect(extractAccountHolderName('Full Name: TOLU ADEBAYO\nStatement Period: 01/01/2026')).toMatch(/TOLU ADEBAYO/i);
});

test('recognises tabular (no-colon) "CUST. NAME" header — real Providus statement format (user report: "it did not read her name")', () => {
  // Providus (and similar) print the header as a column table, not "Label: Value" lines — pdftotext
  // -layout extracts this as one long line with the value separated from the label by a run of
  // spaces (column alignment), not a colon. The old colon-anchored patterns never matched this at
  // all, so the holder name silently went undetected for every Providus statement.
  const statementText =
    'CUST. NAME              POPOOLA ADEPEJU ADETUTU                                             START DATE          11-03-2026\n' +
    'ADDRESS                 47, EMILY AKINOLA STREET AKOKA                                      END DATE            11-09-2026\n' +
    'ACC. NO.                6507032249                                                          OPENING BAL.       1,288,940.58';
  const holder = extractAccountHolderName(statementText);
  expect(holder).toMatch(/POPOOLA ADEPEJU ADETUTU/i);
  expect(namesLooselyMatch('Adepeju Popoola', holder as string)).toBe('ok');
});

test('tabular "ACCT. NAME" / "ACCOUNT NAME" (no colon) variants also match', () => {
  expect(extractAccountHolderName('ACCT. NAME     CHIDI OKAFOR     ACC. NO.     1234567890')).toMatch(/CHIDI OKAFOR/i);
  expect(extractAccountHolderName('ACCOUNT NAME     BOLA ADENIYI     BRANCH     IKEJA')).toMatch(/BOLA ADENIYI/i);
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
