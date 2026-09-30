// Task #497 — the encrypted read/write layer everything else in the app goes through, once the
// PIN-lock feature (pinLock.ts for the crypto, AppLockProvider.tsx for the UI/session state) is
// wired in. Every one of the ~20 files that currently call `localStorage.getItem/setItem/removeItem`
// directly (checklist answers, passport fields, statement analysis, financial figures — everything
// the client's original complaint was about) will be mechanically switched to call the same-shaped
// functions here instead (task #499), so the actual find-and-replace stays small and low-risk.
//
// Why this looks synchronous even though the encryption underneath is not: Web Crypto
// (crypto.subtle) is async-only, but nearly every existing call site reads/writes localStorage
// synchronously inside a plain function (`const raw = localStorage.getItem(key); ...`), often
// inside a React event handler or a `useEffect` with no `await`. Rewriting every one of those to
// be async would be a far bigger, far riskier change than the PIN-lock feature itself needs. So
// instead: `unlock()` decrypts EVERYTHING up front into an in-memory plaintext cache (this is the
// one genuinely async step — shown as a brief "Unlocking…" moment on the lock screen); after that,
// `getItem`/`setItem`/`removeItem` just read and write that cache synchronously, and each `setItem`
// kicks off a fire-and-forget async encrypt-and-persist to the real localStorage in the background.
// The cache is the source of truth for anything already read this session; the disk copy is purely
// for surviving a reload, and is never read from directly outside `unlock()`.
//
// Security invariant this file exists to preserve: while locked (no DEK in memory) AND a lock
// record exists on disk, `getItem` always returns null and `setItem`/`removeItem` never touch the
// cache or the disk. There is no "write plaintext as a fallback" path in that state — if the app
// isn't unlocked, nothing about this module reads or writes applicant data, full stop.
// (AppLockGate is what keeps the actual app UI from mounting while locked in the first place — this
// is the second, independent layer underneath it.)
//
// Task #499: the OTHER state this module has to support is "no PIN has ever been set up on this
// device" — true for ~100% of applicants on the day this feature ships, since nobody is force-
// migrated into it (see AppLockContext.tsx's header comment). For that majority, there is no DEK to
// speak of at all, and requiring one would silently turn every `secureStorage.getItem/setItem` call
// across the ~20 migrated files into a no-op — wiping the entire app's save/restore behavior for
// everyone who hasn't opted in. `enablePassthrough()` is the deliberate escape hatch: while in
// passthrough mode, `getItem`/`setItem` read and write the real localStorage directly, in plaintext,
// exactly matching this module's pre-encryption behavior. AppLockContext calls it once, on mount,
// whenever `hasLockRecord()` comes back false. The moment an applicant DOES set up a PIN,
// `unlock(dek)` is called (which also clears passthrough mode) — its own existing legacy-plaintext
// migration logic then picks up every value that was written during passthrough and encrypts it, so
// nothing about that path needed to change for this to work.
import { encryptWithDek, decryptWithDek, isEncryptedEnvelope } from './pinLock';
import { LOCK_RECORD_KEY, SETUP_DISMISSED_KEY } from './lockStore';
import { APP_TRACKER_KEY } from '../tracker/types';

// This app's own localStorage namespace. Anything outside it (a future unrelated key, a
// third-party library's own storage) is never touched by this module.
const MANAGED_PREFIX = 'sa_';

// Task #499: the personal application tracker (task #296) predates this feature and its storage
// key was never given the 'sa_' prefix (`smoothApplication_oppTracker_v1`) — renaming it now would
// silently drop every existing applicant's already-saved tracker entries on their next visit, which
// is worse than just special-casing it here. Any future key that also doesn't follow the 'sa_'
// convention should be added to this list rather than renamed, for the same reason.
const EXTRA_MANAGED_KEYS = new Set<string>([APP_TRACKER_KEY]);

// Keys inside that namespace that must stay in plaintext forever (see lockStore.ts's own header
// comment for why) — excluded from both the encrypted cache and the hydrate/migrate scan below.
const NEVER_ENCRYPT = new Set<string>([LOCK_RECORD_KEY, SETUP_DISMISSED_KEY]);

let dek: string | null = null;
let passthrough = false;
const cache = new Map<string, string>();

// Deliberately checks the bare global `localStorage`, not `window.localStorage` — in a real
// browser those are the same object, but this lets a test running under Node (this repo's jest
// config uses the plain 'node' environment, no jsdom) install a small in-memory polyfill via
// `(global as any).localStorage = ...` and exercise the real hydrate/persist logic, rather than
// only testing this module's pure helpers.
function getLocalStorage(): Storage | null {
  return typeof localStorage !== 'undefined' ? localStorage : null;
}

function isManagedKey(key: string): boolean {
  if (NEVER_ENCRYPT.has(key)) return false;
  return key.startsWith(MANAGED_PREFIX) || EXTRA_MANAGED_KEYS.has(key);
}

/** Fire-and-forget: encrypts `value` under the current DEK and writes the envelope to the real
 * localStorage. Never awaited by callers (setItem is synchronous from their point of view) — if it
 * fails (quota exceeded, DEK went away mid-flight because the applicant just locked the app), the
 * in-memory cache still has the correct value for the rest of this session; only surviving a
 * reload is at risk, not anything currently on screen. */
function persist(key: string, value: string): void {
  const dekAtCallTime = dek;
  const ls = getLocalStorage();
  if (!dekAtCallTime || !ls) return;
  encryptWithDek(dekAtCallTime, value)
    .then((envelope) => {
      // If the app was locked (or a NEW dek set, e.g. PIN changed) while this was in flight, don't
      // write an envelope encrypted under a DEK that's no longer the current one.
      if (dek !== dekAtCallTime) return;
      try {
        ls.setItem(key, envelope);
      } catch {
        /* localStorage full or unavailable — cache still holds the value for this session */
      }
    })
    .catch(() => {
      /* encryption failure (shouldn't happen with a valid DEK) — same fallback as above */
    });
}

/** Called once, right after a correct PIN/recovery phrase unwraps the DEK (see
 * AppLockProvider.tsx). Decrypts every existing managed key into the in-memory cache; any key
 * still in plaintext (an applicant's data from before this feature existed) is read as-is and
 * immediately re-persisted encrypted, so the on-disk copy is never left as plaintext once a PIN
 * has been set up. Safe to call more than once (e.g. the applicant changes their PIN mid-session)
 * — it just re-scans and re-populates. */
export async function unlock(newDek: string): Promise<void> {
  dek = newDek;
  passthrough = false;
  cache.clear();
  const ls = getLocalStorage();
  if (!ls) return;

  const keys: string[] = [];
  for (let i = 0; i < ls.length; i++) {
    const k = ls.key(i);
    if (k && isManagedKey(k)) keys.push(k);
  }

  await Promise.all(
    keys.map(async (key) => {
      const raw = ls.getItem(key);
      if (raw === null) return;
      if (isEncryptedEnvelope(raw)) {
        const plain = await decryptWithDek(newDek, raw);
        // A decrypt failure here means either real corruption or (should be impossible, since the
        // caller only reaches unlock() after pinLock.ts already confirmed this DEK unwraps
        // correctly) a mismatched DEK — either way, safer to drop the value than to surface
        // decrypted-looking garbage as if it were real data.
        if (plain !== null) cache.set(key, plain);
        return;
      }
      // Legacy plaintext from before this feature existed (or the lock/dismissed keys, already
      // excluded above) — adopt as-is, then upgrade the on-disk copy to encrypted right away.
      cache.set(key, raw);
      persist(key, raw);
    })
  );
}

/** "Sign out": drops the DEK and the entire decrypted cache from memory. The encrypted envelopes
 * already on disk are untouched and become unreadable gibberish again until the next unlock(). */
export function lock(): void {
  dek = null;
  cache.clear();
}

export function isUnlocked(): boolean {
  return dek !== null;
}

/** See this file's header comment. Call once, on mount, whenever no lock record exists yet — never
 * call this once a lock record exists (that would defeat the point of the PIN). */
export function enablePassthrough(): void {
  passthrough = true;
}

export function isPassthrough(): boolean {
  return passthrough;
}

/** Drop-in replacement for `localStorage.getItem` for any `sa_`-prefixed key. In passthrough mode
 * (no PIN ever set up — see enablePassthrough()) reads straight from the real localStorage,
 * unencrypted, exactly like the raw `localStorage.getItem` calls this replaces. Otherwise, returns
 * null whenever the app is locked, regardless of what (encrypted) bytes might be sitting on disk. */
export function getItem(key: string): string | null {
  if (passthrough) {
    const ls = getLocalStorage();
    return ls ? ls.getItem(key) : null;
  }
  if (!dek) return null;
  const v = cache.get(key);
  return v === undefined ? null : v;
}

/** Drop-in replacement for `localStorage.setItem`. In passthrough mode, writes straight through,
 * unencrypted (see enablePassthrough()). Otherwise, a no-op (besides being silently dropped) while
 * locked — see this file's header comment for why that's the correct, intentional behavior. */
export function setItem(key: string, value: string): void {
  if (passthrough) {
    const ls = getLocalStorage();
    if (ls) {
      try {
        ls.setItem(key, value);
      } catch {
        /* localStorage full or unavailable */
      }
    }
    return;
  }
  if (!dek) return;
  cache.set(key, value);
  persist(key, value);
}

/** Drop-in replacement for `localStorage.removeItem`. */
export function removeItem(key: string): void {
  cache.delete(key);
  const ls = getLocalStorage();
  if (ls) {
    try {
      ls.removeItem(key);
    } catch {
      /* ignore */
    }
  }
}
