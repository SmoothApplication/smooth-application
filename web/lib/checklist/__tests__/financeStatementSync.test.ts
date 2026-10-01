// Direct user report (live, mid-session, screenshot of /checklist/uk/statement): a bank statement
// analyzed to 649 transactions, yet the sidebar's "Finances" score still read 0%/"Enter your
// figures". Root-caused to a React effect-ordering race in StatementSlot.tsx: the finance-sync
// effect (which calls syncFinancialInputsFromStatement, below) re-reads sa_<code>_statement from
// storage rather than using the in-memory txns it was just handed, and — before this fix — was
// declared BEFORE the sibling effect that actually persists a freshly-analyzed statement to that
// same storage key. Both effects fire in the same commit on a fresh upload (txns is in both their
// dep arrays), so the sync effect ran first, found nothing yet in storage, and silently no-opped.
// The fix (StatementSlot.tsx) reorders the two effects; this file is the regression coverage for
// the underlying sync function's OWN correctness (this repo has no React component-test harness —
// see lib/security/__tests__/secureStorage.test.ts's own comment on the jest environment — so the
// effect-ordering race itself isn't directly reproducible here, but this at minimum locks down that
// syncFinancialInputsFromStatement does the right thing once storage genuinely has a statement in it,
// and that it correctly no-ops when there's nothing there yet, matching the exact failure mode).
export {}; // module scope, same reason as secureStorage.test.ts

class FakeLocalStorage {
  private store = new Map<string, string>();
  getItem(key: string): string | null {
    return this.store.has(key) ? this.store.get(key)! : null;
  }
  setItem(key: string, value: string): void {
    this.store.set(key, value);
  }
  removeItem(key: string): void {
    this.store.delete(key);
  }
  key(index: number): string | null {
    return Array.from(this.store.keys())[index] ?? null;
  }
  get length(): number {
    return this.store.size;
  }
  clear(): void {
    this.store.clear();
  }
}

let fakeStorage: FakeLocalStorage;

beforeEach(() => {
  fakeStorage = new FakeLocalStorage();
  (global as unknown as { localStorage: FakeLocalStorage }).localStorage = fakeStorage;
  // syncFinancialInputsFromStatement starts with `if (typeof window === 'undefined') return;` (an
  // SSR guard) — this repo's jest config runs in the plain 'node' environment with no `window`
  // global at all (same reason lockStore.test.ts/fullLockFlow.test.ts stub this), so without this
  // every call would silently no-op regardless of what's in storage.
  (global as unknown as { window: unknown }).window = {};
  jest.resetModules();
});

afterEach(() => {
  delete (global as unknown as { window?: unknown }).window;
});

function load() {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const secureStorage = require('../../security/secureStorage') as typeof import('../../security/secureStorage');
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const sync = require('../financeStatementSync') as typeof import('../financeStatementSync');
  secureStorage.enablePassthrough(); // no PIN set up — matches the vast majority of real applicants
  return { secureStorage, sync };
}

function samplePersistedStatement() {
  return {
    txns: [
      { dateISO: '2026-01-15T00:00:00.000Z', narration: 'SALARY', credit: 500000, debit: 0, balance: 500000 },
      { dateISO: '2026-02-15T00:00:00.000Z', narration: 'SALARY', credit: 500000, debit: 0, balance: 950000 },
    ],
    applicantName: '',
    maidenName: '',
    nameCorrections: {},
  };
}

describe('syncFinancialInputsFromStatement', () => {
  it('seeds sa_<code>_financial cash flow + closing balance once a statement is actually in storage', () => {
    const { secureStorage, sync } = load();
    secureStorage.setItem('sa_uk_statement', JSON.stringify(samplePersistedStatement()));

    sync.syncFinancialInputsFromStatement('uk');

    const raw = secureStorage.getItem('sa_uk_financial');
    expect(raw).not.toBeNull();
    const parsed = JSON.parse(raw as string);
    expect(parsed.funds.closingBalance).toBe(950000);
    expect(parsed.cashFlow.some((r: { inflow: number }) => r.inflow > 0)).toBe(true);
  });

  it('is a no-op (matches the reported bug) when nothing has been saved to sa_<code>_statement yet', () => {
    // This is exactly the race's failure mode: calling sync before the statement is actually
    // persisted must not throw, and must not write a (wrongly empty) sa_<code>_financial payload.
    const { secureStorage, sync } = load();
    sync.syncFinancialInputsFromStatement('uk');
    expect(secureStorage.getItem('sa_uk_financial')).toBeNull();
  });

  it('never overwrites a closing balance or cash-flow row the applicant already typed by hand', () => {
    const { secureStorage, sync } = load();
    secureStorage.setItem('sa_uk_statement', JSON.stringify(samplePersistedStatement()));
    secureStorage.setItem(
      'sa_uk_financial',
      JSON.stringify({
        funds: { closingBalance: 123456, savings: 0, other: 0 },
        cashFlow: [{ month: 'Jan', inflow: 1, outflow: 0, balance: '1' }],
        trip: {},
      })
    );

    sync.syncFinancialInputsFromStatement('uk');

    const parsed = JSON.parse(secureStorage.getItem('sa_uk_financial') as string);
    expect(parsed.funds.closingBalance).toBe(123456); // untouched
    expect(parsed.cashFlow[0]).toEqual({ month: 'Jan', inflow: 1, outflow: 0, balance: '1' }); // untouched
  });

  it('combines both statement slots (dual-account support) when deriving the closing balance', () => {
    const { secureStorage, sync } = load();
    secureStorage.setItem('sa_uk_statement', JSON.stringify(samplePersistedStatement()));
    secureStorage.setItem(
      'sa_uk_statement_2',
      JSON.stringify({
        txns: [{ dateISO: '2026-03-15T00:00:00.000Z', narration: 'SIDE INCOME', credit: 50000, debit: 0, balance: 50000 }],
        applicantName: '',
        maidenName: '',
        nameCorrections: {},
      })
    );

    const combined = sync.readPersistedTxnsForCashFlow('uk');
    expect(combined.length).toBe(3);
  });
});
