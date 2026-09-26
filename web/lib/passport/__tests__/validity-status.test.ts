// Ported from tests/passport-validate-status.test.js. The original test drove this through a real
// browser (typing into #f_passportExpiry and reading the rendered #passportValidateStatus message);
// this exercises the same three real-world date scenarios directly against the pure
// getPassportValidityStatus function it now runs on. Relative dates (computed from "today" at test
// run time, same as the original) rather than fixed calendar dates, so this keeps passing regardless
// of when it runs.
import { getPassportValidityStatus } from '../validity';

function isoDate(d: Date): string {
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}

test('returns null when there is no expiry date to check yet', () => {
  expect(getPassportValidityStatus(null)).toBeNull();
  expect(getPassportValidityStatus(undefined)).toBeNull();
  expect(getPassportValidityStatus('')).toBeNull();
  expect(getPassportValidityStatus('not a date')).toBeNull();
});

test('a date well over 6 months out is "ok"', () => {
  const farFuture = new Date();
  farFuture.setMonth(farFuture.getMonth() + 18);
  const status = getPassportValidityStatus(isoDate(farFuture));
  expect(status).toEqual({ level: 'ok', expired: false });
});

test('a date just 1 month out is "warn", not expired', () => {
  const soonExpiry = new Date();
  soonExpiry.setMonth(soonExpiry.getMonth() + 1);
  const status = getPassportValidityStatus(isoDate(soonExpiry));
  expect(status).toEqual({ level: 'warn', expired: false });
});

test('a date in the past is "warn" and expired specifically', () => {
  const past = new Date();
  past.setMonth(past.getMonth() - 2);
  const status = getPassportValidityStatus(isoDate(past));
  expect(status).toEqual({ level: 'warn', expired: true });
});

test('accepts a Date object directly, not just a string', () => {
  const farFuture = new Date();
  farFuture.setMonth(farFuture.getMonth() + 18);
  expect(getPassportValidityStatus(farFuture)).toEqual({ level: 'ok', expired: false });
});
