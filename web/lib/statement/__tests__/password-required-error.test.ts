// Direct request: "how can an applicant open his/her passworded bank statement... we need to make
// it easier" — StatementPasswordRequiredError (extractFile.ts) is what getLinesFromPdf now throws
// instead of pdf.js's raw "No password given" exception, so StatementSlot.tsx can show an inline
// password field instead of a dead-end generic error. extractFile.ts itself is CLIENT-ONLY (pdf.js/
// File API), so it can't be exercised end-to-end here — this covers the one piece of it that's pure
// JS: the error class's own shape, which the UI branches on with `instanceof` and `.incorrect`.
import { StatementPasswordRequiredError } from '../extractFile';

test('StatementPasswordRequiredError signals "needs a password" (first attempt) distinctly from "wrong password" (retry)', () => {
  const needsPassword = new StatementPasswordRequiredError(false);
  expect(needsPassword).toBeInstanceOf(Error);
  expect(needsPassword.name).toBe('StatementPasswordRequiredError');
  expect(needsPassword.incorrect).toBe(false);

  const wrongPassword = new StatementPasswordRequiredError(true);
  expect(wrongPassword.incorrect).toBe(true);
});
