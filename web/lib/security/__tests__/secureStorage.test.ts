// This repo's jest config runs in the plain 'node' environment (no jsdom — see jest.config.js's
// own comment), so there is no real `localStorage` global here. secureStorage.ts deliberately
// reads the bare global `localStorage` rather than `window.localStorage` (see its own comment) so
// a small in-memory polyfill installed here can exercise the real hydrate/persist logic end to
// end, not just this module's pure helpers.
export {}; // module scope — avoids a FakeLocalStorage naming collision with sibling __tests__ files
// under `tsc --noEmit`'s whole-project type-check (ts-jest itself transpiles each file
// independently, so this only ever showed up under tsc, never under a plain jest run).

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
  jest.resetModules();
});

// Re-imported fresh after each jest.resetModules() so the module-level `dek`/cache state doesn't
// leak between tests.
function loadSecureStorage() {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  return require('../secureStorage') as typeof import('../secureStorage');
}
function loadPinLock() {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  return require('../pinLock') as typeof import('../pinLock');
}

describe('secureStorage', () => {
  it('getItem/setItem are no-ops while locked (no DEK set)', () => {
    const secureStorage = loadSecureStorage();
    expect(secureStorage.isUnlocked()).toBe(false);
    secureStorage.setItem('sa_uk_answers', '{"a":1}');
    expect(secureStorage.getItem('sa_uk_answers')).toBeNull();
    // Nothing should have reached the underlying disk store either.
    expect(fakeStorage.getItem('sa_uk_answers')).toBeNull();
  });

  it('setItem after unlock is readable via getItem immediately, and persists an encrypted envelope', async () => {
    const secureStorage = loadSecureStorage();
    const pinLock = loadPinLock();
    const { dek } = await pinLock.setupPin('1234');
    await secureStorage.unlock(dek);

    secureStorage.setItem('sa_uk_answers', '{"married":true}');
    expect(secureStorage.getItem('sa_uk_answers')).toBe('{"married":true}');

    // The fire-and-forget disk write is async — give the real crypto.subtle work (importKey +
    // AES-GCM encrypt) time to resolve. A bare `setTimeout(r, 0)` only flushes one macrotask tick,
    // which isn't reliably enough time for that native work to finish.
    await new Promise((r) => setTimeout(r, 50));
    const onDisk = fakeStorage.getItem('sa_uk_answers');
    expect(onDisk).not.toBeNull();
    expect(pinLock.isEncryptedEnvelope(onDisk!)).toBe(true);
    expect(onDisk).not.toContain('married'); // never sits on disk as readable plaintext
  });

  it('unlock() decrypts an existing encrypted value back into a readable cache', async () => {
    const pinLock = loadPinLock();
    const { dek } = await pinLock.setupPin('1234');
    const envelope = await pinLock.encryptWithDek(dek, '{"passportNumber":"A1234567"}');
    fakeStorage.setItem('sa_uk_passport', envelope);

    const secureStorage = loadSecureStorage();
    await secureStorage.unlock(dek);
    expect(secureStorage.getItem('sa_uk_passport')).toBe('{"passportNumber":"A1234567"}');
  });

  it('unlock() adopts legacy plaintext values and upgrades the on-disk copy to encrypted', async () => {
    fakeStorage.setItem('sa_uk_checked', '{"passport":true}');

    const secureStorage = loadSecureStorage();
    const pinLock = loadPinLock();
    const { dek } = await pinLock.setupPin('1234');
    await secureStorage.unlock(dek);

    // Readable immediately, even though it started out as plaintext on disk.
    expect(secureStorage.getItem('sa_uk_checked')).toBe('{"passport":true}');

    await new Promise((r) => setTimeout(r, 50));
    const onDisk = fakeStorage.getItem('sa_uk_checked');
    expect(pinLock.isEncryptedEnvelope(onDisk!)).toBe(true);
  });

  it('lock() clears the cache; getItem returns null and setItem no-ops again', async () => {
    const secureStorage = loadSecureStorage();
    const pinLock = loadPinLock();
    const { dek } = await pinLock.setupPin('1234');
    await secureStorage.unlock(dek);
    secureStorage.setItem('sa_uk_answers', '{"married":true}');
    expect(secureStorage.getItem('sa_uk_answers')).toBe('{"married":true}');
    // Let the fire-and-forget encrypt-and-persist actually reach disk before locking — locking
    // deliberately discards any write still in flight under the DEK that's about to go away (see
    // persist()'s own comment), so this test's own intent (the on-disk envelope from BEFORE
    // locking survives) needs that write to have landed first. A bare `setTimeout(r, 0)` only
    // flushes one macrotask tick, which isn't reliably enough time for the real crypto.subtle
    // work (importKey + AES-GCM encrypt) to resolve — a short real delay is needed instead.
    await new Promise((r) => setTimeout(r, 50));

    secureStorage.lock();
    expect(secureStorage.isUnlocked()).toBe(false);
    expect(secureStorage.getItem('sa_uk_answers')).toBeNull();

    // The on-disk envelope from before locking is untouched — still there, still encrypted.
    await new Promise((r) => setTimeout(r, 0));
    const onDisk = fakeStorage.getItem('sa_uk_answers');
    expect(onDisk).not.toBeNull();
    expect(pinLock.isEncryptedEnvelope(onDisk!)).toBe(true);
  });

  it('never manages the lock record or setup-dismissed keys — they pass straight through untouched', async () => {
    const { LOCK_RECORD_KEY, SETUP_DISMISSED_KEY } = require('../lockStore') as typeof import('../lockStore');
    fakeStorage.setItem(LOCK_RECORD_KEY, 'plain-json-not-an-envelope');
    fakeStorage.setItem(SETUP_DISMISSED_KEY, '1');

    const secureStorage = loadSecureStorage();
    const pinLock = loadPinLock();
    const { dek } = await pinLock.setupPin('1234');
    await secureStorage.unlock(dek);

    // Not pulled into the encrypted cache at all — callers read these two keys straight off
    // localStorage via lockStore.ts, never via secureStorage.
    expect(secureStorage.getItem(LOCK_RECORD_KEY)).toBeNull();
    await new Promise((r) => setTimeout(r, 50));
    // And never rewritten/touched on disk either.
    expect(fakeStorage.getItem(LOCK_RECORD_KEY)).toBe('plain-json-not-an-envelope');
    expect(fakeStorage.getItem(SETUP_DISMISSED_KEY)).toBe('1');
  });

  it('removeItem clears both the cache and the on-disk copy, even while locked', () => {
    const secureStorage = loadSecureStorage();
    fakeStorage.setItem('sa_uk_passport', 'sa_enc1:whatever');
    secureStorage.removeItem('sa_uk_passport');
    expect(fakeStorage.getItem('sa_uk_passport')).toBeNull();
  });

  // Task #499: the ~100% of applicants who haven't set up a PIN yet must see EXACTLY the same
  // read/write behavior as the raw `localStorage.getItem/setItem` calls this module replaces —
  // otherwise migrating those ~20 call sites to secureStorage would silently break saving for
  // everyone who hasn't opted into this feature. See secureStorage.ts's own header comment.
  describe('passthrough mode (no PIN ever set up on this device)', () => {
    it('getItem reads straight from real localStorage, unencrypted, with no unlock() call at all', () => {
      fakeStorage.setItem('sa_uk_answers', '{"married":true}');
      const secureStorage = loadSecureStorage();
      secureStorage.enablePassthrough();
      expect(secureStorage.isPassthrough()).toBe(true);
      expect(secureStorage.getItem('sa_uk_answers')).toBe('{"married":true}');
    });

    it('setItem writes straight through to real localStorage, unencrypted, immediately (no fire-and-forget delay)', () => {
      const secureStorage = loadSecureStorage();
      secureStorage.enablePassthrough();
      secureStorage.setItem('sa_uk_answers', '{"married":true}');
      // Unlike the encrypted path, this is synchronous — no need to wait a tick.
      expect(fakeStorage.getItem('sa_uk_answers')).toBe('{"married":true}');
    });

    it('unlock() turns passthrough off and migrates whatever plaintext was written during it', async () => {
      const secureStorage = loadSecureStorage();
      const pinLock = loadPinLock();
      secureStorage.enablePassthrough();
      secureStorage.setItem('sa_uk_answers', '{"married":true}');

      const { dek } = await pinLock.setupPin('1234');
      await secureStorage.unlock(dek);
      expect(secureStorage.isPassthrough()).toBe(false);
      // Still readable through the normal (now-encrypted) path...
      expect(secureStorage.getItem('sa_uk_answers')).toBe('{"married":true}');
      await new Promise((r) => setTimeout(r, 50));
      // ...and the on-disk copy has been upgraded from plaintext to an encrypted envelope.
      expect(pinLock.isEncryptedEnvelope(fakeStorage.getItem('sa_uk_answers')!)).toBe(true);
    });
  });
});
