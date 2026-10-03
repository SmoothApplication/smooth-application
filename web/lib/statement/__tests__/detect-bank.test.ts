import { detectBankName } from '../detectBank';

describe('detectBankName', () => {
  it('reads the bank off the statement header', () => {
    expect(detectBankName(['PROVIDUS BANK PLC', 'Account Statement', 'CUST. NAME   POPOOLA ADEPEJU'])).toBe('Providus Bank');
    expect(detectBankName(['Guaranty Trust Bank Limited', 'Statement of account'])).toBe('GTBank');
  });
  it('earliest header mention wins and narrations lower down are ignored', () => {
    const lines = ['Zenith Bank Plc', ...Array(45).fill('x'), 'TRF TO PROVIDUS'];
    expect(detectBankName(lines)).toBe('Zenith Bank');
    expect(detectBankName(['Statement', 'Opening balance 1,000', 'Date narration', ...Array(45).fill('y'), 'FROM ACCESS BANK'])).toBeNull();
  });
  it('returns null when no bank is named', () => {
    expect(detectBankName(['Account statement', 'Opening balance'])).toBeNull();
  });
});
