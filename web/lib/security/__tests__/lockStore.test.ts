// Task #500 — lockStore.ts had no dedicated test file before this. It's small, but it's the one
// module every other piece of this feature depends on being correct: AppLockContext decides
// 'locked' vs 'no-pin' from hasLockRecord(), and secureStorage.ts's NEVER_ENCRYPT set assumes
// these two keys are the ones that always stay plaintext. A bug here (e.g. writeLockRecord not
// actually persisting, or hasLockRecord returning true with nothing readable behind it) would be
// silent and catastrophic — either locking every applicant out with no way to unlock, or never
// locking anyone at all.
//
// This repo's jest config runs in the plain 'node' environment (no jsdom global `window`), and
// lockStore.ts deliberately guards every function with `typeof window === 'undefined'` (the SSR
// safety net — see its own file). So to exercise the REAL read/write behavior rather than just the
// SSR no-op path, a minimal `window.localStorage` is installed here, mirroring the pattern
// secureStorage.test.ts already uses for the bare `localStorage` global.
export {}; // forces this file into module scope so its FakeLocalStorage/fakeStorage/loadLockStore
// names don't collide with the same identifiers declared in sibling __tests__ files (ts-jest
// transpiles each file independently, but `tsc --noEmit` type-checks the whole project together,
// and a script file with no top-level import/export pollutes the global scope).

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
}

let fakeStorage: FakeLocalStorage;

beforeEach(() => {
  fakeStorage = new FakeLocalStorage();
  (global as unknown as { window: { localStorage: FakeLocalStorage } }).window = {
    localStorage: fakeStorage,
  };
  jest.resetModules();
});

afterEach(() => {
  delete (global as unknown as { window?: unknown }).window;
});

function loadLockStore() {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  return require('../lockStore') as typeof import('../lockStore');
}
function loadPinLock() {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  return require('../pinLock') as typeof import('../pinLock');
}

describe('lockStore', () => {
  it('hasLockRecord() is false, and readLockRecord() is null, before anything is written', () => {
    const lockStore = loadLockStore();
    expect(lockStore.hasLockRecord()).toBe(false);
    expect(lockStore.readLockRecord()).toBeNull();
  });

  it('writeLockRecord() persists a record that readLockRecord()/hasLockRecord() then pick up', async () => {
    const lockStore = loadLockStore();
    const pinLock = loadPinLock();
    const { lockRecord } = await pinLock.setupPin('1234');

    lockStore.writeLockRecord(lockRecord);

    expect(lockStore.hasLockRecord()).toBe(true);
    expect(lockStore.readLockRecord()).toEqual(lockRecord);
  });

  it('stores the record as plain (non-envelope) JSON on disk — readable before any PIN is entered', async () => {
    const lockStore = loadLockStore();
    const pinLock = loadPinLock();
    const { lockRecord } = await pinLock.setupPin('1234');
    lockStore.writeLockRecord(lockRecord);

    const raw = fakeStorage.getItem(lockStore.LOCK_RECORD_KEY);
    expect(raw).not.toBeNull();
    expect(pinLock.isEncryptedEnvelope(raw!)).toBe(false);
    expect(JSON.parse(raw!)).toEqual(lockRecord);
  });

  it('readLockRecord() returns null (rather than throwing) for corrupted JSON on disk', () => {
    const lockStore = loadLockStore();
    fakeStorage.setItem(lockStore.LOCK_RECORD_KEY, 'this is not valid json{{{');
    expect(lockStore.readLockRecord()).toBeNull();
    expect(lockStore.hasLockRecord()).toBe(false);
  });

  it('setup-dismissed flag starts false and flips true once dismissSetupPrompt() is called', () => {
    const lockStore = loadLockStore();
    expect(lockStore.isSetupPromptDismissed()).toBe(false);
    lockStore.dismissSetupPrompt();
    expect(lockStore.isSetupPromptDismissed()).toBe(true);
    expect(fakeStorage.getItem(lockStore.SETUP_DISMISSED_KEY)).toBe('1');
  });

  it('the lock record and dismissed-flag keys are independent of each other', async () => {
    const lockStore = loadLockStore();
    const pinLock = loadPinLock();
    const { lockRecord } = await pinLock.setupPin('1234');
    lockStore.writeLockRecord(lockRecord);

    // A PIN being set up doesn't imply the setup prompt was ever dismissed, and vice versa.
    expect(lockStore.isSetupPromptDismissed()).toBe(false);
  });

  describe('server-side rendering safety (no `window` global at all)', () => {
    beforeEach(() => {
      delete (global as unknown as { window?: unknown }).window;
    });

    it('every function fails safe instead of throwing when window is undefined', () => {
      const lockStore = loadLockStore();
      expect(() => lockStore.readLockRecord()).not.toThrow();
      expect(lockStore.readLockRecord()).toBeNull();
      expect(lockStore.hasLockRecord()).toBe(false);
      expect(lockStore.isSetupPromptDismissed()).toBe(true); // fails "locked out" safe, not "open"
      expect(() => lockStore.dismissSetupPrompt()).not.toThrow();
    });
  });
});
