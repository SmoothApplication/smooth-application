import { computeWorkNameCheck } from '../workNameCheck';
import type { ParsedTxn } from '../types';

function txn(day: number, credit: number, narration: string): ParsedTxn {
  return { date: new Date(2026, 3, day), narration, credit, debit: 0, balance: 0 } as unknown as ParsedTxn;
}

describe('employer name check with a bank-truncated Remita remitter', () => {
  it('counts payments whose remitter is the start of the typed employer name', () => {
    const txns = [
      txn(1, 1000000, 'INFLOW R-12345/NIGERIAN U : STAFFALLOWANCEFORMARCH2026'),
      txn(2, 500000, 'INFLOW R-12346/NIGERIAN U : STAFFSALARYFORMARCH2026'),
      txn(3, 20000, 'TRANSFER FROM SOMEONE ELSE'),
    ];
    const r = computeWorkNameCheck(
      { label: 'employer', name: 'Nigerian Upstream Petroleum Regulatory Commission' },
      txns
    );
    expect(r.inflowMatches.length).toBe(2);
  });
});
