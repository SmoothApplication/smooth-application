// Task #500 — every other test file in lib/security exercises exactly one module (pinLock's
// crypto, secureStorage's cache, lockStore's persistence, appLockState's pure shape-checks) in
// isolation. None of them walk through the actual sequence a real applicant produces once task
// #499 wired AppLockContext into the root layout: set up a PIN, save some checklist data, close the
// laptop (sign out), come back later, unlock again, and only then trust that the same data is still
// there. This file is that walk-through — the closest thing to an end-to-end test this repo's
// jsdom-less Jest setup allows (AppLockContext.tsx itself is a thin React wrapper around exactly
// this sequence; see appLockState.ts's own comment on why the React layer isn't unit-tested here).
//
// Both `localStorage` (secureStorage.ts reads the bare global) and `window.localStorage`
// (lockStore.ts reads it off `window`) are pointed at the SAME fake store, so this test sees
// exactly what a real browser tab would: one disk, shared by both modules.
export {}; // forces this file into module scope — see lockStore.test.ts's own comment on why.

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
}

let disk: FakeLocalStorage;

beforeEach(() => {
  disk = new FakeLocalStorage();
  (global as unknown as { localStorage: FakeLocalStorage }).localStorage = disk;
  (global as unknown as { window: { localStorage: FakeLocalStorage } }).window = { localStorage: disk };
  jest.resetModules();
});

function loadAll() {
  return {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    secureStorage: require('../secureStorage') as typeof import('../secureStorage'),
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    pinLock: require('../pinLock') as typeof import('../pinLock'),
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    lockStore: require('../lockStore') as typeof import('../lockStore'),
  };
}

/** A fresh require of secureStorage/pinLock/lockStore, simulating a new page load / tab open —
 * the in-memory DEK and cache are gone (exactly like a real reload), but `disk` (the fake
 * localStorage) persists across this, exactly like a real browser's disk does. */
function simulateReload() {
  jest.resetModules();
  return loadAll();
}

describe('full lock lifecycle (mirrors what AppLockContext.tsx orchestrates)', () => {
  it('a brand-new applicant: no lock record, passthrough is on, data saves and loads in plaintext on disk', () => {
    const { secureStorage, lockStore } = loadAll();
    expect(lockStore.hasLockRecord()).toBe(false);

    // This is exactly what AppLockContext's mount effect does when !hasLockRecord().
    secureStorage.enablePassthrough();
    secureStorage.setItem('sa_uk_answers', '{"married":false}');

    expect(secureStorage.getItem('sa_uk_answers')).toBe('{"married":false}');
    expect(disk.getItem('sa_uk_answers')).toBe('{"married":false}'); // real plaintext on disk
  });

  it('opting in: setupPin() + writeLockRecord() + unlock() migrates passthrough data to encrypted, readable immediately', async () => {
    const { secureStorage, pinLock, lockStore } = loadAll();

    // Applicant has been using the app for a while first (passthrough).
    secureStorage.enablePassthrough();
    secureStorage.setItem('sa_uk_answers', '{"married":false}');
    secureStorage.setItem('sa_uk_passport', '{"passportNumber":"A1234567"}');

    // Now they set up a PIN — this is setupPin() in AppLockContext.tsx, step by step.
    const { lockRecord, dek, recoveryPhrase } = await pinLock.setupPin('1234');
    lockStore.writeLockRecord(lockRecord);
    await secureStorage.unlock(dek);

    expect(lockStore.hasLockRecord()).toBe(true);
    expect(secureStorage.isPassthrough()).toBe(false);
    // Everything saved before opting in is still there, unchanged, no re-entry needed.
    expect(secureStorage.getItem('sa_uk_answers')).toBe('{"married":false}');
    expect(secureStorage.getItem('sa_uk_passport')).toBe('{"passportNumber":"A1234567"}');

    // Give the fire-and-forget encrypt-and-persist time to land (see secureStorage.test.ts's own
    // note on why a bare setTimeout(0) isn't reliably enough for real crypto.subtle work).
    await new Promise((r) => setTimeout(r, 50));
    expect(pinLock.isEncryptedEnvelope(disk.getItem('sa_uk_answers')!)).toBe(true);
    expect(pinLock.isEncryptedEnvelope(disk.getItem('sa_uk_passport')!)).toBe(true);
    // The lock record itself never becomes an envelope — it has to stay readable pre-unlock.
    expect(pinLock.isEncryptedEnvelope(disk.getItem(lockStore.LOCK_RECORD_KEY)!)).toBe(false);

    // Sanity for the next tests in this file.
    expect(recoveryPhrase).toMatch(/^[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$/);
  });

  it('sign out then close the tab: data is unreadable until the next unlock, and survives the reload intact on disk', async () => {
    const { secureStorage, pinLock, lockStore } = loadAll();
    const { lockRecord, dek } = await pinLock.setupPin('1234');
    lockStore.writeLockRecord(lockRecord);
    await secureStorage.unlock(dek);
    secureStorage.setItem('sa_uk_financial', '{"closingBalance":500000}');
    await new Promise((r) => setTimeout(r, 50));

    // "Sign out" — AppLockContext.signOut().
    secureStorage.lock();
    expect(secureStorage.getItem('sa_uk_financial')).toBeNull(); // unreadable in memory now

    // Simulate closing the tab and reopening it (fresh module state; disk persists).
    const reloaded = simulateReload();
    expect(reloaded.lockStore.hasLockRecord()).toBe(true); // still knows a PIN exists
    expect(reloaded.secureStorage.getItem('sa_uk_financial')).toBeNull(); // still locked

    // Unlock with the same PIN — the data comes back exactly as it was.
    const record = reloaded.lockStore.readLockRecord()!;
    const recoveredDek = await reloaded.pinLock.unlockWithPin(record, '1234');
    expect(recoveredDek).not.toBeNull();
    await reloaded.secureStorage.unlock(recoveredDek!);
    expect(reloaded.secureStorage.getItem('sa_uk_financial')).toBe('{"closingBalance":500000}');
  });

  it('a wrong PIN after reload never unlocks the data, and leaves the encrypted disk copy untouched', async () => {
    const { secureStorage, pinLock, lockStore } = loadAll();
    const { lockRecord, dek } = await pinLock.setupPin('1234');
    lockStore.writeLockRecord(lockRecord);
    await secureStorage.unlock(dek);
    secureStorage.setItem('sa_uk_answers', '{"married":true}');
    await new Promise((r) => setTimeout(r, 50));
    secureStorage.lock();

    const reloaded = simulateReload();
    const record = reloaded.lockStore.readLockRecord()!;
    const wrongAttempt = await reloaded.pinLock.unlockWithPin(record, '0000');
    expect(wrongAttempt).toBeNull();
    // Never even calls secureStorage.unlock() on a failed attempt (matches AppLockContext's own
    // guard) — still locked, on-disk copy untouched and still a valid envelope.
    expect(reloaded.secureStorage.isUnlocked()).toBe(false);
    expect(reloaded.pinLock.isEncryptedEnvelope(disk.getItem('sa_uk_answers')!)).toBe(true);
  });

  it("forgot the PIN, but the recovery phrase still unlocks the same data (the whole point of the envelope scheme)", async () => {
    const { secureStorage, pinLock, lockStore } = loadAll();
    const { lockRecord, dek, recoveryPhrase } = await pinLock.setupPin('1234');
    lockStore.writeLockRecord(lockRecord);
    await secureStorage.unlock(dek);
    secureStorage.setItem('sa_uk_travelhistory', '{"firstTimeAnswer":"yes"}');
    await new Promise((r) => setTimeout(r, 50));
    secureStorage.lock();

    const reloaded = simulateReload();
    const record = reloaded.lockStore.readLockRecord()!;

    // Forgot the PIN entirely — every guess fails.
    expect(await reloaded.pinLock.unlockWithPin(record, '9999')).toBeNull();

    // Recovery phrase (handwritten down at setup time) still works.
    const recoveredDek = await reloaded.pinLock.unlockWithRecoveryPhrase(record, recoveryPhrase);
    expect(recoveredDek).not.toBeNull();
    await reloaded.secureStorage.unlock(recoveredDek!);
    expect(reloaded.secureStorage.getItem('sa_uk_travelhistory')).toBe('{"firstTimeAnswer":"yes"}');
  });

  it('changing the PIN (rewrapWithNewPin) while unlocked: old PIN stops working, new PIN and the original recovery phrase both still do', async () => {
    const { secureStorage, pinLock, lockStore } = loadAll();
    const { lockRecord, dek, recoveryPhrase } = await pinLock.setupPin('1234');
    lockStore.writeLockRecord(lockRecord);
    await secureStorage.unlock(dek);
    secureStorage.setItem('sa_uk_answers', '{"married":true}');
    await new Promise((r) => setTimeout(r, 50));

    // Change PIN while unlocked (a settings-page action this app doesn't expose in the UI yet, but
    // the crypto primitive it would call already exists and needs to keep working correctly).
    const newRecord = await pinLock.rewrapWithNewPin(lockRecord, dek, '5678');
    lockStore.writeLockRecord(newRecord);
    secureStorage.lock();

    const reloaded = simulateReload();
    const record = reloaded.lockStore.readLockRecord()!;
    expect(await reloaded.pinLock.unlockWithPin(record, '1234')).toBeNull(); // old PIN dead
    const withNewPin = await reloaded.pinLock.unlockWithPin(record, '5678');
    expect(withNewPin).toBe(dek); // new PIN unwraps the SAME dek — data isn't re-encrypted, just re-wrapped
    const withRecovery = await reloaded.pinLock.unlockWithRecoveryPhrase(record, recoveryPhrase);
    expect(withRecovery).toBe(dek); // original recovery phrase is untouched by a PIN-only change

    await reloaded.secureStorage.unlock(withNewPin!);
    expect(reloaded.secureStorage.getItem('sa_uk_answers')).toBe('{"married":true}');
  });

  it('the personal-tracker key (non-sa_-prefixed, EXTRA_MANAGED_KEYS) survives the same lock/unlock cycle as every sa_-prefixed key', async () => {
    const { secureStorage, pinLock, lockStore } = loadAll();
    // Mirrors lib/tracker/types.ts's real APP_TRACKER_KEY without importing it, so this test has no
    // dependency on that module's location — only on the behavior EXTRA_MANAGED_KEYS documents.
    const TRACKER_KEY = 'smoothApplication_oppTracker_v1';
    disk.setItem(TRACKER_KEY, '{"entries":[{"name":"Chevening"}]}'); // written during passthrough, pre-opt-in

    const { lockRecord, dek } = await pinLock.setupPin('1234');
    lockStore.writeLockRecord(lockRecord);
    await secureStorage.unlock(dek);

    expect(secureStorage.getItem(TRACKER_KEY)).toBe('{"entries":[{"name":"Chevening"}]}');
    await new Promise((r) => setTimeout(r, 50));
    expect(pinLock.isEncryptedEnvelope(disk.getItem(TRACKER_KEY)!)).toBe(true);

    secureStorage.lock();
    const reloaded = simulateReload();
    const record = reloaded.lockStore.readLockRecord()!;
    const recoveredDek = await reloaded.pinLock.unlockWithPin(record, '1234');
    await reloaded.secureStorage.unlock(recoveredDek!);
    expect(reloaded.secureStorage.getItem(TRACKER_KEY)).toBe('{"entries":[{"name":"Chevening"}]}');
  });

  it('a genuinely corrupted lock record on disk fails safe: hasLockRecord() is false, nothing throws', async () => {
    const { lockStore } = loadAll();
    disk.setItem(lockStore.LOCK_RECORD_KEY, '{not valid json');
    expect(() => lockStore.hasLockRecord()).not.toThrow();
    expect(lockStore.hasLockRecord()).toBe(false);
  });

  it('losing both the PIN and the recovery phrase leaves the encrypted data on disk permanently unreadable (the honest tradeoff, not a bug)', async () => {
    const { secureStorage, pinLock, lockStore } = loadAll();
    const { lockRecord, dek } = await pinLock.setupPin('1234');
    lockStore.writeLockRecord(lockRecord);
    await secureStorage.unlock(dek);
    secureStorage.setItem('sa_uk_answers', '{"married":true}');
    await new Promise((r) => setTimeout(r, 50));
    secureStorage.lock();

    const reloaded = simulateReload();
    const record = reloaded.lockStore.readLockRecord()!;
    // Every recovery path exhausted, none succeed — there's no back door.
    expect(await reloaded.pinLock.unlockWithPin(record, '0000')).toBeNull();
    expect(await reloaded.pinLock.unlockWithRecoveryPhrase(record, 'ZZZZ-ZZZZ-ZZZZ-ZZZZ')).toBeNull();
    // The ciphertext is still sitting there, intact — genuinely encrypted, not just hidden.
    const onDisk = disk.getItem('sa_uk_answers');
    expect(onDisk).not.toBeNull();
    expect(reloaded.pinLock.isEncryptedEnvelope(onDisk!)).toBe(true);
  });
});
