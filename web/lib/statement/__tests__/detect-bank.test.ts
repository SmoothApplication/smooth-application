import { detectBankName } from '../detectBank';

describe('detectBankName', () => {
  it('reads the bank off the statement header', () => {
    expect(detectBankName(['PROVIDUS BANK PLC', 'Account Statement', 'CUST. NAME   POPOOLA ADEPEJU'])).toBe('Providus Bank');
    expect(detectBankName(['Guaranty Trust Bank Limited', 'Statement of account'])).toBe('GTBank');
  });
  it('earliest header mention wins and narrations lower down are ignored', () => {
    const lines = ['Zenith Bank Plc', ...Array(45).fill('x'), 'TRF TO PROVIDUS'];
    expect(detectBankName(['STATEMENT OF ACCOUNT', 'CUST. NAME  A B', ...Array(6).fill('h'), 'OUTWARD TRANSFER TO GLOBUS BANK|UNICAF', ...Array(60).fill('row'), "subject to ProvidusBank Plc's Terms"])).toBe('Providus Bank');
    expect(detectBankName(lines)).toBe('Zenith Bank');
    expect(detectBankName(['Statement', ...Array(45).fill('y'), 'FROM ACCESS BANK', ...Array(45).fill('z')])).toBeNull();
  });
  it('falls back to the footer disclaimer (Providus names itself only there)', () => {
    const lines = ['STATEMENT OF ACCOUNT', 'CUST. NAME  POPOOLA', ...Array(60).fill('row'), "Note, all products and services are subject to ProvidusBank Plc's existing Terms"];
    expect(detectBankName(lines)).toBe('Providus Bank');
  });
  it('a short header ends at the column titles, so the first transaction is never read as header', () => {
    const lines = ['STATEMENT OF ACCOUNT', 'CUST. NAME  A B', 'ACC. NO. 1', 'CURRENCY NGN', 'TXN DATE VAL DATE REMARKS DEBIT CREDIT BALANCE', '02-03-2026 02-03-2026 OUTWARD TRANSFER TO GLOBUS BANK|UNICAF 50,000.00 950,000.00', "ProvidusBank Plc's Terms"];
    expect(detectBankName(lines)).toBe('Providus Bank');
  });
  it('returns null when no bank is named', () => {
    expect(detectBankName(['Account statement', 'Opening balance'])).toBeNull();
  });
});
