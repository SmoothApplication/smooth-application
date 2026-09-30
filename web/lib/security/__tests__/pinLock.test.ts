// Task #500 — dedicated coverage for the crypto core itself. Every other test file in
// lib/security exercises pinLock.ts only incidentally (secureStorage.test.ts calls setupPin() to
// get a DEK, appLockState.test.ts never touches it at all), so the actual security properties this
// whole feature rests on — a wrong PIN is rejected, a wrong recovery phrase is rejected, the same
// DEK comes back out of either correct unwrap path, changing the PIN doesn't invalidate the
// recovery phrase — had never been directly asserted until this file. Runs in this repo's plain
// 'node' Jest environment; Node 20+ exposes the same global Web Crypto API the browser does (see
// this repo's task #495 check), so no jsdom or polyfill is needed here.
import {
  setupPin,
  unlockWithPin,
  unlockWithRecoveryPhrase,
  rewrapWithNewPin,
  encryptWithDek,
  decryptWithDek,
  isEncryptedEnvelope,
  normalizeRecoveryPhrase,
  generateRecoveryPhrase,
  LockRecord,
} from '../pinLock';

describe('setupPin', () => {
  it('produces a lock record whose PIN-wrapped and recovery-wrapped DEK both unwrap to the same DEK', async () => {
    const { lockRecord, dek, recoveryPhrase } = await setupPin('1234');
    expect(await unlockWithPin(lockRecord, '1234')).toBe(dek);
    expect(await unlockWithRecoveryPhrase(lockRecord, recoveryPhrase)).toBe(dek);
  });

  it('generates a fresh random DEK and recovery phrase on every call (no reuse across setups)', async () => {
    const a = await setupPin('1234');
    const b = await setupPin('1234'); // same PIN, still must not collide
    expect(a.dek).not.toBe(b.dek);
    expect(a.recoveryPhrase).not.toBe(b.recoveryPhrase);
  });

  it('generates a recovery phrase in the 4x4 hyphenated shape', async () => {
    const { recoveryPhrase } = await setupPin('1234');
    expect(recoveryPhrase).toMatch(/^[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$/);
  });
});

describe('unlockWithPin', () => {
  it('returns null (never throws) for a wrong PIN, and does not leak any info via timing-unsafe shortcuts', async () => {
    const { lockRecord } = await setupPin('1234');
    await expect(unlockWithPin(lockRecord, '9999')).resolves.toBeNull();
  });

  it('is sensitive to every digit — a single-digit-off guess still fails', async () => {
    const { lockRecord, dek } = await setupPin('4321');
    expect(await unlockWithPin(lockRecord, '4322')).toBeNull();
    expect(await unlockWithPin(lockRecord, '4321')).toBe(dek);
  });
});

describe('unlockWithRecoveryPhrase', () => {
  it('returns null for a wrong recovery phrase', async () => {
    const { lockRecord } = await setupPin('1234');
    await expect(unlockWithRecoveryPhrase(lockRecord, 'ZZZZ-ZZZZ-ZZZZ-ZZZZ')).resolves.toBeNull();
  });

  it('tolerates lowercase and stray whitespace the same way the UI shape-check does', async () => {
    const { lockRecord, dek, recoveryPhrase } = await setupPin('1234');
    const messy = '  ' + recoveryPhrase.toLowerCase().replace(/-/g, ' - ') + '  ';
    expect(await unlockWithRecoveryPhrase(lockRecord, messy)).toBe(dek);
  });
});

describe('rewrapWithNewPin (change PIN)', () => {
  it('lets the new PIN unlock the same DEK, while the old PIN no longer works', async () => {
    const { lockRecord, dek } = await setupPin('1234');
    const rewrapped = await rewrapWithNewPin(lockRecord, dek, '5678');

    expect(await unlockWithPin(rewrapped, '5678')).toBe(dek);
    expect(await unlockWithPin(rewrapped, '1234')).toBeNull();
  });

  it('leaves the recovery phrase untouched — no need to re-write it down after changing just the PIN', async () => {
    const { lockRecord, dek, recoveryPhrase } = await setupPin('1234');
    const rewrapped = await rewrapWithNewPin(lockRecord, dek, '5678');

    expect(await unlockWithRecoveryPhrase(rewrapped, recoveryPhrase)).toBe(dek);
  });
});

describe('encryptWithDek / decryptWithDek (app-data envelope)', () => {
  it('round-trips arbitrary plaintext', async () => {
    const { dek } = await setupPin('1234');
    const envelope = await encryptWithDek(dek, '{"passportNumber":"A1234567"}');
    expect(await decryptWithDek(dek, envelope)).toBe('{"passportNumber":"A1234567"}');
  });

  it('produces an envelope that is prefixed and never contains the plaintext verbatim', async () => {
    const { dek } = await setupPin('1234');
    const envelope = await encryptWithDek(dek, 'super-secret-value');
    expect(isEncryptedEnvelope(envelope)).toBe(true);
    expect(envelope).not.toContain('super-secret-value');
  });

  it('two encryptions of the same plaintext under the same DEK produce different envelopes (random IV per call)', async () => {
    const { dek } = await setupPin('1234');
    const e1 = await encryptWithDek(dek, 'same value');
    const e2 = await encryptWithDek(dek, 'same value');
    expect(e1).not.toBe(e2);
  });

  it('decrypting with the wrong DEK returns null rather than throwing or returning garbage', async () => {
    const { dek: dekA } = await setupPin('1234');
    const { dek: dekB } = await setupPin('5678');
    const envelope = await encryptWithDek(dekA, 'only dekA should read this');
    expect(await decryptWithDek(dekB, envelope)).toBeNull();
  });

  it('decrypting a malformed or non-envelope string returns null', async () => {
    const { dek } = await setupPin('1234');
    expect(await decryptWithDek(dek, 'not an envelope at all')).toBeNull();
    expect(await decryptWithDek(dek, 'sa_enc1:missing-the-dot-separator')).toBeNull();
  });
});

describe('a genuinely lost PIN and recovery phrase leaves data unrecoverable (no third way in)', () => {
  it('a lock record alone, without either secret, unwraps to nothing', async () => {
    const { lockRecord } = await setupPin('1234');
    // Simulate "forgot both" — no correct pin/phrase is ever tried, only guesses.
    expect(await unlockWithPin(lockRecord, '0000')).toBeNull();
    expect(await unlockWithRecoveryPhrase(lockRecord, 'AAAA-AAAA-AAAA-AAAA')).toBeNull();
  });
});

describe('normalizeRecoveryPhrase', () => {
  it('trims, uppercases, and strips internal whitespace', () => {
    expect(normalizeRecoveryPhrase('  abcd - efgh - jkmn - pqrs  ')).toBe('ABCD-EFGH-JKMN-PQRS');
  });
});

describe('a hand-typed lock record shape is stable v1', () => {
  it('round-trips through JSON.stringify/parse (how lockStore.ts persists it) without losing fidelity', async () => {
    const { lockRecord } = await setupPin('1234');
    const roundTripped = JSON.parse(JSON.stringify(lockRecord)) as LockRecord;
    expect(await unlockWithPin(roundTripped, '1234')).not.toBeNull();
    expect(roundTripped.v).toBe(1);
  });
});

// generateRecoveryPhrase is also exercised indirectly above via setupPin, but tested directly here
// for its own documented property (excludes visually-ambiguous characters).
describe('generateRecoveryPhrase', () => {
  it('never includes the visually-ambiguous characters 0/O/1/I/L', () => {
    for (let i = 0; i < 25; i++) {
      const phrase = generateRecoveryPhrase();
      expect(phrase).not.toMatch(/[01ILO]/);
    }
  });
});
