// Ported from index.html's updatePassportValidateStatus (~line 6959). Most visa applications
// require at least 6 months' passport validity remaining from the (unknown, at this point in the
// flow) travel date — the original app checked against 6 months from TODAY rather than the trip's
// travel date, since the applicant hasn't necessarily reached the trip-details step yet when they
// scan their passport. Kept identical here for the same reason: this runs from the passport-scan
// page alone, with no guarantee a trip date has been entered yet.
//
// Pure logic only — no JSX/copy here. The exact wording (including the passport-renewal link) lives
// in the component that renders this, same split already used elsewhere (e.g. dates.ts vs. the
// components that format its output for display).

export type PassportValidityLevel = 'ok' | 'warn';

export interface PassportValidityStatus {
  level: PassportValidityLevel;
  /** Only meaningful when level === 'warn' — whether the expiry date has already passed (vs. just
   * being under the 6-month threshold). */
  expired: boolean;
}

/** `expiryDate` accepts a Date, a parseable date string (e.g. "YYYY-MM-DD" from a <input type="date">),
 * or null/undefined/invalid — all of which return null (no status to show, matching the original
 * app's `box.innerHTML = ''` early-return). */
export function getPassportValidityStatus(
  expiryDate: Date | string | null | undefined
): PassportValidityStatus | null {
  if (!expiryDate) return null;
  const d = typeof expiryDate === 'string' ? new Date(expiryDate) : expiryDate;
  if (!d || Number.isNaN(d.getTime())) return null;

  const sixMonthsFromToday = new Date();
  sixMonthsFromToday.setMonth(sixMonthsFromToday.getMonth() + 6);
  sixMonthsFromToday.setHours(0, 0, 0, 0);

  if (d >= sixMonthsFromToday) return { level: 'ok', expired: false };

  const expired = d < new Date();
  return { level: 'warn', expired };
}
