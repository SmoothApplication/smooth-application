'use client';

// Task #498 — the React-side half of the "sign out" feature (pinLock.ts is the crypto core,
// secureStorage.ts is the encrypted read/write layer, appLockState.ts is the pure/testable shape
// logic this file builds on). NOT yet mounted anywhere (that's task #499 — wiring this provider
// into the checklist layout and migrating the ~20 existing localStorage call sites to go through
// secureStorage instead), so nothing about this file changes current behavior for any applicant yet.
//
// Why a provider + context instead of a plain hook: the unlocked DEK has to survive client-side
// navigation between checklist session pages (Next.js App Router's <Link> doesn't remount the
// component tree, so React state under a single provider mounted once near the root DOES survive
// those navigations — only a full page reload/tab close clears it, which is exactly the intended
// "sign out means come back and unlock again" behavior). A hook re-created per page would lose the
// unlocked state on every session-to-session Back/Next click, forcing a PIN re-entry on every page —
// wrong.
//
// This file only holds the STATE (context + provider + hook) — it always renders `children`
// unconditionally and never imports LockScreen itself, specifically to avoid a circular import
// (LockScreen needs useAppLock() to call setupPin/unlockWithPin/etc.). The actual "show LockScreen
// instead of the real app while locked" decision is a separate component, AppLockGate.tsx, that
// wraps `<AppLockProvider>`'s children and reads `status` via useAppLock() to decide what to render.
// Task #499 wires both together at the root layout: `<AppLockProvider><AppLockGate>{children}</AppLockGate></AppLockProvider>`.
//
// Why this won't gate the WHOLE app once mounted: most of this app's clientele has never set up a
// PIN (this is a brand-new, opt-in feature — nobody is force-migrated into it), and the landing page,
// quiz, login/admin pages etc. have nothing to do with the applicant-data-at-rest problem this
// feature solves. AppLockGate only renders LockScreen when a lock record already exists on disk
// (`status === 'locked'`, or the brief `'checking'` before that's known); otherwise (`'no-pin'`) it
// renders children exactly as before. This means it's SAFE to mount at the root layout in task #499
// without changing anything for the ~100% of current applicants who haven't opted in.
import { createContext, useCallback, useContext, useEffect, useState, ReactNode } from 'react';
import {
  setupPin as cryptoSetupPin,
  unlockWithPin as cryptoUnlockWithPin,
  unlockWithRecoveryPhrase as cryptoUnlockWithRecoveryPhrase,
} from './pinLock';
import { readLockRecord, writeLockRecord, hasLockRecord } from './lockStore';
import * as secureStorage from './secureStorage';
import { initialLockStatus, AppLockStatus } from './appLockState';

export type { AppLockStatus };

export interface AppLockContextValue {
  /** 'checking' only very briefly on first mount (see this file's header comment on why it can't be
   * decided during the render Next.js uses to hydrate). Consumers that only care about "is the real
   * app safe to show" should treat 'checking' the same as 'locked' — i.e. don't render applicant data. */
  status: AppLockStatus;
  /** True once a PIN has ever been set up on this device, independent of whether it's currently
   * unlocked this session — lets e.g. a settings page say "Change PIN" instead of "Set up a PIN". */
  hasPinSetup: boolean;
  /** Set by a failed unlock attempt; cleared by clearError() or the next attempt. Never set for a
   * setupPin() shape-validation failure — LockScreen checks that itself via appLockState.ts before
   * ever calling into this context, so those get to have field-level errors of their own. */
  error: string | null;
  /** True while an unlock/setup attempt's async crypto work (PBKDF2 + AES-GCM, both deliberately
   * slow) is in flight — lets LockScreen disable its buttons and show a spinner rather than let an
   * applicant mash "Unlock" mid-attempt. */
  busy: boolean;
  /** Generates a brand-new DEK, wraps it under `pin` and a fresh recovery phrase, writes the lock
   * record to disk, and immediately unlocks secureStorage under the new DEK. Returns the recovery
   * phrase to show the applicant once (never persisted anywhere in readable form) — the caller
   * (LockScreen) is responsible for making them confirm they've written it down before treating setup
   * as fully done, but the app is already functionally unlocked by the time this resolves. */
  setupPin: (pin: string) => Promise<{ recoveryPhrase: string } | null>;
  unlockWithPin: (pin: string) => Promise<boolean>;
  unlockWithRecoveryPhrase: (phrase: string) => Promise<boolean>;
  /** "Sign out": drops the in-memory DEK (via secureStorage.lock()) and returns to the LockScreen.
   * The encrypted data on disk is untouched — just unreadable again until the next unlock. */
  signOut: () => void;
  clearError: () => void;
}

const AppLockContext = createContext<AppLockContextValue | null>(null);

export function useAppLock(): AppLockContextValue {
  const ctx = useContext(AppLockContext);
  if (!ctx) {
    throw new Error('useAppLock() must be called within an <AppLockProvider>.');
  }
  return ctx;
}

export function AppLockProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<AppLockStatus>('checking');
  const [hasPinSetup, setHasPinSetup] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Deliberately in an effect (runs after the first client-side render) rather than a useState
  // lazy initializer — this file's header comment explains why: doing it during render risks a
  // server/client hydration mismatch, since the server has no localStorage to check at all.
  useEffect(() => {
    const exists = hasLockRecord();
    setHasPinSetup(exists);
    // No lock record at all (true for ~100% of applicants the day this ships — nobody is
    // force-migrated into this feature) means secureStorage has no DEK to speak of yet; without
    // this, every migrated call site's reads/writes would silently no-op. See secureStorage.ts's
    // own header comment on why this passthrough mode exists.
    if (!exists) {
      secureStorage.enablePassthrough();
    }
    setStatus(initialLockStatus(exists));
  }, []);

  const clearError = useCallback(() => setError(null), []);

  const setupPin = useCallback(async (pin: string): Promise<{ recoveryPhrase: string } | null> => {
    setBusy(true);
    setError(null);
    try {
      const { lockRecord, dek, recoveryPhrase } = await cryptoSetupPin(pin);
      writeLockRecord(lockRecord);
      await secureStorage.unlock(dek);
      setHasPinSetup(true);
      setStatus('unlocked');
      return { recoveryPhrase };
    } catch {
      setError('Something went wrong setting up your PIN. Please try again.');
      return null;
    } finally {
      setBusy(false);
    }
  }, []);

  const unlockWithPin = useCallback(async (pin: string): Promise<boolean> => {
    const record = readLockRecord();
    if (!record) {
      // Shouldn't be reachable (LockScreen only offers PIN entry when status is 'locked', which
      // implies a record exists) but fail safe rather than throw if it somehow is.
      setError('No PIN is set up on this device.');
      return false;
    }
    setBusy(true);
    setError(null);
    try {
      const dek = await cryptoUnlockWithPin(record, pin);
      if (!dek) {
        setError('Incorrect PIN. Try again, or use your recovery phrase.');
        return false;
      }
      await secureStorage.unlock(dek);
      setStatus('unlocked');
      return true;
    } finally {
      setBusy(false);
    }
  }, []);

  const unlockWithRecoveryPhrase = useCallback(async (phrase: string): Promise<boolean> => {
    const record = readLockRecord();
    if (!record) {
      setError('No PIN is set up on this device.');
      return false;
    }
    setBusy(true);
    setError(null);
    try {
      const dek = await cryptoUnlockWithRecoveryPhrase(record, phrase);
      if (!dek) {
        setError("That recovery phrase doesn't match. Double-check each group of 4 characters.");
        return false;
      }
      await secureStorage.unlock(dek);
      setStatus('unlocked');
      return true;
    } finally {
      setBusy(false);
    }
  }, []);

  const signOut = useCallback(() => {
    secureStorage.lock();
    setError(null);
    // hasPinSetup is unaffected by signing out — the lock record on disk is untouched, only the
    // in-memory DEK is dropped, so the next render must go straight back to the unlock screen.
    setStatus('locked');
  }, []);

  const value: AppLockContextValue = {
    status,
    hasPinSetup,
    error,
    busy,
    setupPin,
    unlockWithPin,
    unlockWithRecoveryPhrase,
    signOut,
    clearError,
  };

  return <AppLockContext.Provider value={value}>{children}</AppLockContext.Provider>;
}
