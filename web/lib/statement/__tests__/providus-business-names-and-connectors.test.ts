// Real Providus statement (Adepeju Popoola): business senders were truncated or split, and payroll was
// "personal". Narrations below are copied from that statement.
import { extractNameCandidates, classifySourceType } from '../names';

const first = (n: string) => extractNameCandidates(n)[0];

describe('business names keep their "and" and lose trailing notes', () => {
  test('AND inside a name', () => {
    expect(first('ACCOUNT TRANSFERS MOB: TRF FROM AMUSE GAMES AND ENTERTAINMENT 54******0936 TO POPOOLA ADEPEJU ADETUTU')).toBe('AMUSE GAMES AND ENTERTAINMENT');
    expect(first('INWARD TRANSFER (N) FROM STERLING/ DAVID AND ADENIKE POPOOLA-ONEBANK TRANSFER')).toBe('DAVID AND ADENIKE POPOOLA');
  });
  test('"Transfer between customers ... FROM ( X )" resolves to X', () => {
    expect(extractNameCandidates('TRANSFER BETWEEN CUSTOMERS TRZL-TRANSFER TO ( POPOOLA ADEPEJU ADETUTU ) FROM ( AMUSE GAMES AND ENTERTAINMENT)|TRF')).toContain('AMUSE GAMES AND ENTERTAINMENT');
  });
  test('trailing free-text notes are dropped', () => {
    expect(first('INWARD TRANSFER (N) FROM WEMA/ DENTIST AT YOUR DOOR DENTAL CLINIC_6507032249-EVENT FUNDS/0000172')).toBe('DENTIST AT YOUR DOOR DENTAL CLINIC');
    expect(first('INWARD TRANSFER(H) FROM GTBANK/ LADENIKA ADEBOWALE-HAPPY BIRTHDAY SIS TO POPOOLA ADEPE/00001')).toBe('LADENIKA ADEBOWALE');
  });
  test('a lone AND is still a stopword', () => {
    expect(first('NIP/TUNDE BAKARE AND SALARY')).toBe('TUNDE BAKARE');
  });
});

describe('company vs personal', () => {
  test('payroll, entertainment and dental senders read as companies', () => {
    expect(classifySourceType('REMITA INFLOW R-1445788162/NIGERIAN U:STAFFSALARY')).toBe('company');
    expect(classifySourceType('TRF FROM AMUSE GAMES AND ENTERTAINMENT')).toBe('company');
    expect(classifySourceType('FROM DENTIST AT YOUR DOOR DENTAL CLINIC')).toBe('company');
    expect(classifySourceType('FROM OLUWAYEMISI WASILAT AKINTONWA')).toBe('personal');
  });
});
