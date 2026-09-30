// Direct client complaint: "he would prefer he can sign out and come back, so that his
// information is not accessible to anyone who gains access to his laptop." Everything this app
// stores (checklist answers, passport data, bank statement analysis, financial figures) currently
// sits in plain, unencrypted localStorage — a "Sign out" button alone wouldn't fix that, since
// anyone who can open the browser's dev tools can read localStorage directly with no login of any
// kind. This module is the real fix: a PIN unlocks a random Data Encryption Key (DEK); every value
// this app persists is encrypted under that DEK before it ever reaches localStorage; the DEK itself
// lives only in memory for the current unlocked session, never on disk. "Sign out" (see
// AppLockProvider.tsx) just drops the in-memory DEK — the encrypted data on disk becomes
// unreadable gibberish again until the PIN is typed back in.
//
// Built entirely on the browser's native Web Crypto API (crypto.subtle) — no new dependency, no
// extra supply-chain surface, and it's available in both the browser and this repo's Node-based
// jest tests (Node 20+ exposes the same WebCrypto global). AES-256-GCM for actual encryption
// (authenticated — a wrong key throws instead of silently returning garbage), PBKDF2 (100,000
// rounds) to turn a short PIN into a real key.
//
// Envelope-encryption scheme: the applicant's short PIN never encrypts the real data directly.
// Instead, a separate random 256-bit DEK does the real encrypting, and the PIN only wraps (encrypts)
// that DEK. This is what makes the recovery phrase possible without a second copy of every
// encrypted value: setup also wraps the SAME DEK under a recovery-phrase-derived key, stored
// alongside the PIN-wrapped copy. Forgetting the PIN but keeping the recovery phrase still unwraps
// the same DEK and decrypts everything; losing both means the data is genuinely, permanently
// unrecoverable — the honest tradeoff of real encryption, not a "reset password" email flow, since
// nothing about this app talks to a server that could reset anything.
const PBKDF2_ITERATIONS = 100000;
const DEK_BYTES = 32; // AES-256
const SALT_BYTES = 16;
const IV_BYTES = 12; // recommended for AES-GCM

export interface LockRecord {
  v: 1;
  pinSalt: string;
  pinIterations: number;
  pinIv: string;
  wrappedDekByPin: string;
  recoverySalt: string;
  recoveryIterations: number;
  recoveryIv: string;
  wrappedDekByRecovery: string;
}

function getSubtle(): SubtleCrypto {
  const c = (globalThis as typeof globalThis & { crypto?: Crypto }).crypto;
  if (!c || !c.subtle) {
    throw new Error('Web Crypto (crypto.subtle) is not available in this environment.');
  }
  return c.subtle;
}

function getRandomBytes(n: number): Uint8Array {
  const c = (globalThis as typeof globalThis & { crypto?: Crypto }).crypto;
  if (!c) throw new Error('crypto.getRandomValues is not available in this environment.');
  return c.getRandomValues(new Uint8Array(n));
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return typeof btoa === 'function' ? btoa(binary) : Buffer.from(bytes).toString('base64');
}

function base64ToBytes(b64: string): Uint8Array {
  if (typeof atob === 'function') {
    const binary = atob(b64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return bytes;
  }
  return new Uint8Array(Buffer.from(b64, 'base64'));
}

const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();

/** Derives an AES-256-GCM key from a short secret (the PIN, or the recovery phrase) + salt via
 * PBKDF2. The derived key is used only to wrap/unwrap the real DEK — never to encrypt app data
 * directly — so it deliberately isn't marked extractable. */
async function deriveWrappingKey(secret: string, salt: Uint8Array, iterations: number): Promise<CryptoKey> {
  const subtle = getSubtle();
  const baseKey = await subtle.importKey('raw', textEncoder.encode(secret), 'PBKDF2', false, ['deriveKey']);
  return subtle.deriveKey(
    { name: 'PBKDF2', salt, iterations, hash: 'SHA-256' },
    baseKey,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

/** Normalizes a recovery phrase before hashing so a typo in case or stray whitespace (easy to
 * introduce copying a handwritten code) doesn't turn a correct phrase into a wrong one. */
export function normalizeRecoveryPhrase(phrase: string): string {
  return phrase.trim().toUpperCase().replace(/\s+/g, '');
}

/** Generates a human-writeable-down backup code: 4 groups of 4 characters from an alphabet that
 * excludes visually ambiguous characters (0/O, 1/I/L), so it's easy to copy correctly by hand.
 * ~79 bits of entropy — far beyond what a PIN alone provides, appropriate for something only used
 * as a rarely-needed backup. */
export function generateRecoveryPhrase(): string {
  const alphabet = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  const bytes = getRandomBytes(16);
  let out = '';
  for (let g = 0; g < 4; g++) {
    for (let i = 0; i < 4; i++) {
      out += alphabet[bytes[g * 4 + i] % alphabet.length];
    }
    if (g < 3) out += '-';
  }
  return out;
}

export interface SetupResult {
  lockRecord: LockRecord;
  dek: string; // base64 — hold only in memory, never persist
  recoveryPhrase: string; // show once; the applicant must write it down themselves
}

/** Sets up a brand-new lock: generates a random DEK, wraps it under both the chosen PIN and a
 * freshly generated recovery phrase, and returns everything needed to start an unlocked session
 * immediately (the caller shouldn't make the applicant re-type the PIN they just chose). */
export async function setupPin(pin: string): Promise<SetupResult> {
  const dekBytes = getRandomBytes(DEK_BYTES);
  const dek = bytesToBase64(dekBytes);

  const pinSaltBytes = getRandomBytes(SALT_BYTES);
  const pinIvBytes = getRandomBytes(IV_BYTES);
  const pinKey = await deriveWrappingKey(pin, pinSaltBytes, PBKDF2_ITERATIONS);
  const subtle = getSubtle();
  const wrappedByPin = await subtle.encrypt({ name: 'AES-GCM', iv: pinIvBytes }, pinKey, dekBytes);

  const recoveryPhrase = generateRecoveryPhrase();
  const recoverySaltBytes = getRandomBytes(SALT_BYTES);
  const recoveryIvBytes = getRandomBytes(IV_BYTES);
  const recoveryKey = await deriveWrappingKey(normalizeRecoveryPhrase(recoveryPhrase), recoverySaltBytes, PBKDF2_ITERATIONS);
  const wrappedByRecovery = await subtle.encrypt({ name: 'AES-GCM', iv: recoveryIvBytes }, recoveryKey, dekBytes);

  const lockRecord: LockRecord = {
    v: 1,
    pinSalt: bytesToBase64(pinSaltBytes),
    pinIterations: PBKDF2_ITERATIONS,
    pinIv: bytesToBase64(pinIvBytes),
    wrappedDekByPin: bytesToBase64(new Uint8Array(wrappedByPin)),
    recoverySalt: bytesToBase64(recoverySaltBytes),
    recoveryIterations: PBKDF2_ITERATIONS,
    recoveryIv: bytesToBase64(recoveryIvBytes),
    wrappedDekByRecovery: bytesToBase64(new Uint8Array(wrappedByRecovery)),
  };

  return { lockRecord, dek, recoveryPhrase };
}

async function unwrap(
  wrappedB64: string,
  ivB64: string,
  saltB64: string,
  iterations: number,
  secret: string
): Promise<string | null> {
  try {
    const key = await deriveWrappingKey(secret, base64ToBytes(saltB64), iterations);
    const subtle = getSubtle();
    const plainBuf = await subtle.decrypt(
      { name: 'AES-GCM', iv: base64ToBytes(ivB64) },
      key,
      base64ToBytes(wrappedB64)
    );
    return bytesToBase64(new Uint8Array(plainBuf));
  } catch {
    // Wrong PIN/recovery phrase — AES-GCM's auth tag check fails and decrypt() throws. This is
    // the expected, safe outcome for a bad guess, not a bug.
    return null;
  }
}

/** Attempts to recover the DEK using a typed PIN. Returns the DEK (base64) on success, or null on
 * a wrong PIN — never throws, so callers can show a plain "wrong PIN" message either way. */
export function unlockWithPin(lockRecord: LockRecord, pin: string): Promise<string | null> {
  return unwrap(lockRecord.wrappedDekByPin, lockRecord.pinIv, lockRecord.pinSalt, lockRecord.pinIterations, pin);
}

/** Same as unlockWithPin, but via the recovery phrase — the "I forgot my PIN" path. */
export function unlockWithRecoveryPhrase(lockRecord: LockRecord, phrase: string): Promise<string | null> {
  return unwrap(
    lockRecord.wrappedDekByRecovery,
    lockRecord.recoveryIv,
    lockRecord.recoverySalt,
    lockRecord.recoveryIterations,
    normalizeRecoveryPhrase(phrase)
  );
}

/** Lets an already-unlocked applicant change their PIN without re-generating (and having to
 * re-write-down) their recovery phrase — only the PIN-wrapped copy of the DEK changes. */
export async function rewrapWithNewPin(lockRecord: LockRecord, dek: string, newPin: string): Promise<LockRecord> {
  const dekBytes = base64ToBytes(dek);
  const pinSaltBytes = getRandomBytes(SALT_BYTES);
  const pinIvBytes = getRandomBytes(IV_BYTES);
  const pinKey = await deriveWrappingKey(newPin, pinSaltBytes, PBKDF2_ITERATIONS);
  const subtle = getSubtle();
  const wrappedByPin = await subtle.encrypt({ name: 'AES-GCM', iv: pinIvBytes }, pinKey, dekBytes);
  return {
    ...lockRecord,
    pinSalt: bytesToBase64(pinSaltBytes),
    pinIterations: PBKDF2_ITERATIONS,
    pinIv: bytesToBase64(pinIvBytes),
    wrappedDekByPin: bytesToBase64(new Uint8Array(wrappedByPin)),
  };
}

const ENVELOPE_PREFIX = 'sa_enc1:';

/** Encrypts an arbitrary string (callers JSON.stringify their own data first) under the DEK,
 * producing a single self-contained envelope string safe to hand straight to
 * localStorage.setItem. Prefixed so secureStorage.ts can tell an encrypted value apart from
 * legacy plaintext left over from before this feature existed. */
export async function encryptWithDek(dek: string, plaintext: string): Promise<string> {
  const subtle = getSubtle();
  const keyBytes = base64ToBytes(dek);
  const key = await subtle.importKey('raw', keyBytes, { name: 'AES-GCM' }, false, ['encrypt']);
  const iv = getRandomBytes(IV_BYTES);
  const cipherBuf = await subtle.encrypt({ name: 'AES-GCM', iv }, key, textEncoder.encode(plaintext));
  return ENVELOPE_PREFIX + bytesToBase64(iv) + '.' + bytesToBase64(new Uint8Array(cipherBuf));
}

/** Reverses encryptWithDek. Returns null (never throws) on a malformed envelope or a wrong DEK,
 * so a caller can fall back to "treat this as unreadable" rather than crashing. */
export async function decryptWithDek(dek: string, envelope: string): Promise<string | null> {
  if (!envelope.startsWith(ENVELOPE_PREFIX)) return null;
  const body = envelope.slice(ENVELOPE_PREFIX.length);
  const parts = body.split('.');
  if (parts.length !== 2) return null;
  try {
    const subtle = getSubtle();
    const keyBytes = base64ToBytes(dek);
    const key = await subtle.importKey('raw', keyBytes, { name: 'AES-GCM' }, false, ['decrypt']);
    const plainBuf = await subtle.decrypt(
      { name: 'AES-GCM', iv: base64ToBytes(parts[0]) },
      key,
      base64ToBytes(parts[1])
    );
    return textDecoder.decode(plainBuf);
  } catch {
    return null;
  }
}

/** Whether a string looks like one of our encrypted envelopes (vs. legacy plaintext, or some
 * other unrelated localStorage value). Pure string check — no crypto, safe to call without a DEK. */
export function isEncryptedEnvelope(value: string): boolean {
  return value.startsWith(ENVELOPE_PREFIX);
}
