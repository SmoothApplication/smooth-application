// Ported from tests/missing-salary-month-current-and-grace.test.js.
// User report, off a real statement filled in mid-August: "August Salary" got flagged as missing even
// though August wasn't over yet. Fixed two ways: (1) never flag the CURRENT calendar month or anything
// after it, and (2) give last month a short grace window (first week of a new month), since payroll
// commonly posts a few days into the following month. The original test used Playwright's clock API to
// pin "today"; here we use Jest fake timers to pin the same two "today" values and call
// detectMissingSalaryMonths directly.
import { detectMissingSalaryMonths } from '../classify';
import { txn } from './testHelpers';

// Two genuine "<Month> Salary" narrations (May and June) establish the monthly-salary pattern;
// July has other activity but no salary narration at all — a genuine, completed gap by mid-August.
// August also has activity but no salary narration — must NOT be flagged while August is still
// in progress (scenario 1) or during the first-week-of-September grace window (scenario 2).
function buildTxns() {
  return [
    txn({ narration: 'NIP/EMPLOYER LTD/May Salary', credit: 200000, dateISO: '2026-05-05' }),
    txn({ narration: 'NIP/EMPLOYER LTD/June Salary', credit: 200000, dateISO: '2026-06-05' }),
    // July: some other (non-salary) activity, no salary narration.
    txn({ narration: 'NIP/SOME PERSON/gift', credit: 5000, dateISO: '2026-07-10' }),
    // August: some other (non-salary) activity, no salary narration.
    txn({ narration: 'NIP/SOME PERSON/gift', credit: 5000, dateISO: '2026-08-10' }),
  ];
}

afterEach(() => {
  jest.useRealTimers();
});

test('flags a completed past month with no salary, but never the current in-progress month', () => {
  jest.useFakeTimers();
  jest.setSystemTime(new Date('2026-08-19T10:00:00'));

  const missing = detectMissingSalaryMonths(buildTxns(), []);
  expect(missing).not.toBeNull();
  expect(missing).toContain('July');
  expect(missing).not.toContain('August');
});

test('gives last month a payroll grace window during the first week of a new month', () => {
  jest.useFakeTimers();
  jest.setSystemTime(new Date('2026-09-03T10:00:00'));

  const missing = detectMissingSalaryMonths(buildTxns(), []);
  expect(missing).not.toBeNull();
  expect(missing).toContain('July');
  // August should get a grace period in the first week of September, even though a new month has
  // started.
  expect(missing).not.toContain('August');
});
