// Plaintext bootstrapping metadata for the PIN-lock feature (pinLock.ts does the actual
// encryption; secureStorage.ts is the encrypted read/write layer everything else goes through).
// The two keys here are deliberately NEVER encrypted — the lock record has to be readable before
// any PIN has been typed (it's the salt/wrapped-DEK material the PIN unwraps), and the
// "dismissed the setup prompt" flag is just a UI preference, not app data.
import type { LockRecord } from './pinLock';

export const LOCK_RECORD_KEY = 'sa_lock_v1';
export const SETUP_DISMISSED_KEY = 'sa_lock_dismissed';

export function readLockRecord(): LockRecord | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(LOCK_RECORD_KEY);
    return raw ? (JSON.parse(raw) as LockRecord) : null;
  } catch {
    return null;
  }
}

export function writeLockRecord(record: LockRecord): void {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(LOCK_RECORD_KEY, JSON.stringify(record));
}

export function hasLockRecord(): boolean {
  return readLockRecord() !== null;
}

export function isSetupPromptDismissed(): boolean {
  if (typeof window === 'undefined') return true;
  return window.localStorage.getItem(SETUP_DISMISSED_KEY) === '1';
}

export function dismissSetupPrompt(): void {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(SETUP_DISMISSED_KEY, '1');
}
