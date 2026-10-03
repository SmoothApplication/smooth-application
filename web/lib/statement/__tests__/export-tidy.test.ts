import { cleanReason, tidyNarration } from '../exportBreakdown';
import { buildActionPlan } from '../actionPlan';

it('tidies narration digits and junk reasons', () => {
  expect(tidyNarration('R-1/90144578 81620')).toBe('R-1/9014457881620');
  expect(cleanReason('TO POPOOLA')).toBe('');
  expect(cleanReason('Staff salary')).toBe('Staff salary');
});
it('adds employer-letter tip when allowances dominate', () => {
  const base = { openingBalance: 0, closingBalance: 1, totalInflow: 1, totalOutflow: 0, recommendedFundsFloor: 1, hasSalaryIncome: true, hasOtherRecurringIncome: false, statementCurrencyIssues: [], unexplainedGroupCount: 0 } as const;
  expect(buildActionPlan({ ...base, largeEmployerAllowances: true, statementCurrencyIssues: [] }).doList.join(' ')).toMatch(/larger than your basic salary, which is normal/);
});

import { suggestReasonForGroup } from '../suggestReason';
it('suggests the allowance reason for the allowances group', () => {
  expect(suggestReasonForGroup({ type: 'salary', name: 'Allowances and bonuses from employer', txns: [] })?.value).toBe('allowance');
  expect(suggestReasonForGroup({ type: 'salary', name: 'Salary', txns: [] })?.value).toBe('salary');
});
