import { parsePayslipText, parseFlightText } from '../documentParsers';

it('reads a payslip', () => {
  const t = `EMPLOYEE  PAYSLIP FOR  SEPT2026
CONSOLIDATED MONTHLY SALARY 1,077,976.42
TOTALS 1,077,976.42 429,618.02 NET PAY: 648,358.40`;
  expect(parsePayslipText(t)).toEqual({ month: 'September 2026', gross: 1077976.42, net: 648358.4 });
  expect(parsePayslipText('nothing')).toBeNull();
});
it('reads flight dates and ref', () => {
  const t = `BOOKING REFERENCE (PNR) PASSENGER NAME ISSUE DATE
7X9K2L POPOOLA 01 OCT 2026
FRIDAY, 30 OCTOBER 2026
SUNDAY, 08 NOVEMBER 2026`;
  const f = parseFlightText(t)!;
  expect(f.outboundISO).toBe('2026-10-30');
  expect(f.returnISO).toBe('2026-11-08');
});
