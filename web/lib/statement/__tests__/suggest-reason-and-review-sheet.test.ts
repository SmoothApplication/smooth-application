// Consultant-workflow feature: suggest a reason the client only has to confirm, and carry the
// confirmed / edited / needs-review status into the downloadable sheet.
import { suggestReasonForGroup, reviewStatusFor, REVIEW_STATUS_LABEL } from '../suggestReason';
import { UNEXPLAINED_REASON_OPTIONS } from '../flaggedReasons';
import { buildIncomeBreakdownAoa } from '../exportBreakdown';
import type { ParsedTxn, SourceGroup, SourceGroups } from '../types';

function t(narration: string, credit = 100000): ParsedTxn {
  return { date: new Date(2026, 4, 5), narration, credit, debit: 0, balance: 0 } as ParsedTxn;
}
function g(type: string, narrations: string[]): SourceGroup {
  const txns = narrations.map((n) => t(n));
  return { name: 'Sender', type, count: txns.length, total: txns.length * 100000, firstDate: txns[0].date, lastDate: txns[0].date, txns };
}

describe('suggestReasonForGroup', () => {
  test('keyword in narration drives the suggestion', () => {
    expect(suggestReasonForGroup(g('personal', ['NIP/AYO BELLO/house rent for may']))?.value).toBe('rent');
    expect(suggestReasonForGroup(g('personal', ['TRF FROM SOLA ADE HBD token']))?.value).toBe('gift');
    expect(suggestReasonForGroup(g('personal', ['NIP/UCHE/loan repayment']))?.value).toBe('loan');
  });
  test('falls back to group type, and says why', () => {
    expect(suggestReasonForGroup(g('family', ['NIP/X/transfer']))).toMatchObject({ value: 'family' });
    expect(suggestReasonForGroup(g('company', ['NIP/ACME/transfer']))).toMatchObject({ value: 'business' });
  });
  test('no guess when there is no real signal', () => {
    expect(suggestReasonForGroup(g('personal', ['NIP/TUNDE BAKARE/transfer']))).toBeNull();
  });
  test('never suggests for the applicant\'s own money or automatic movements', () => {
    ['salary', 'self', 'reversal', 'interest', 'internal', 'other'].forEach((ty) =>
      expect(suggestReasonForGroup(g(ty, ['rent gift loan']))).toBeNull()
    );
  });
  test('suggestion labels stay in sync with the dropdown options', () => {
    ['rent', 'loan', 'gift', 'refund', 'sale', 'savings_group', 'business', 'family'].forEach((v) => {
      const probe: Record<string, string> = {
        rent: 'rent', loan: 'loan', gift: 'birthday', refund: 'refund', sale: 'sale', savings_group: 'ajo', business: 'invoice',
      };
      const s = v === 'family' ? suggestReasonForGroup(g('family', ['x'])) : suggestReasonForGroup(g('personal', [probe[v]]));
      const opt = UNEXPLAINED_REASON_OPTIONS.find((o) => o.value === v);
      expect(s?.label).toBe(opt?.label);
    });
  });
});

describe('reviewStatusFor', () => {
  const s = { value: 'gift', label: 'Gift', why: 'x' };
  test('confirmed / edited / needs review', () => {
    expect(reviewStatusFor(s, 'Gift')).toBe('confirmed');
    expect(reviewStatusFor(s, 'Loan or loan repayment')).toBe('edited');
    expect(reviewStatusFor(s, '')).toBe('needs_review');
    expect(reviewStatusFor(null, 'My own words')).toBe('edited');
  });
});

describe('review columns in the spreadsheet', () => {
  const groups = [g('personal', ['TRF FROM SOLA ADE birthday'])] as SourceGroups;
  test('original 7-column shape is unchanged when no review callback is given', () => {
    const aoa = buildIncomeBreakdownAoa(groups, (n) => n);
    expect(aoa[0]).toHaveLength(7);
  });
  test('adds Suggested reason + Review status when asked', () => {
    const aoa = buildIncomeBreakdownAoa(groups, (n) => n, { Sender: 'Gift' }, {}, (gr) => {
      const sug = suggestReasonForGroup(gr);
      return { suggested: sug?.label || '', status: REVIEW_STATUS_LABEL[reviewStatusFor(sug, 'Gift')] };
    });
    expect(aoa[0].slice(-2)).toEqual(['Suggested reason', 'Review status']);
    const first = aoa.find((r) => r[0] === 'Sender') as (string | number)[];
    expect(first.slice(-2)).toEqual(['Gift', 'Confirmed']);
  });
});

describe('Remita payroll', () => {
  test('explains it as employer pay, not a generic company', () => {
    const s = suggestReasonForGroup(g('company', ['REMITA INFLOW R-1/NIGERIAN U:STAFFSALARY']));
    expect(s?.why).toMatch(/Remita/);
    expect(s?.why).toMatch(/employer/);
  });
});

import { researchNoteKey, getResearchNote } from '../researchNotes';
describe('research notes', () => {
  test('stored under a prefixed key, read back trimmed', () => {
    const e = { [researchNoteKey('Dentist')]: '  Dental clinic in Lagos - real  ', Dentist: 'Business or trade payment' };
    expect(getResearchNote(e, 'Dentist')).toBe('Dental clinic in Lagos - real');
    expect(getResearchNote(e, 'Nobody')).toBe('');
  });
  test('sheet gets a Research note column only when a note exists', () => {
    const groups = [g('personal', ['TRF FROM SOLA ADE birthday'])] as SourceGroups;
    const mk = (note: string) => buildIncomeBreakdownAoa(groups, (n) => n, {}, {}, () => ({ suggested: 'Gift', status: 'Needs your review', note }));
    expect(mk('')[0].slice(-2)).toEqual(['Suggested reason', 'Review status']);
    const withNote = mk('Real business, Lagos');
    expect(withNote[0].slice(-3)).toEqual(['Suggested reason', 'Review status', 'Research note']);
    const first = withNote.find((r) => r[0] === 'Sender') as (string | number)[];
    expect(first.slice(-3)).toEqual(['Gift', 'Needs your review', 'Real business, Lagos']);
  });
});
