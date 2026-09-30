// Task #498 — small, pure (no React, no crypto, no localStorage) helpers that AppLockContext.tsx
// builds its state machine on top of. Split out specifically so the decision logic (what status to
// start in, whether a typed PIN/recovery phrase is even shaped correctly before bothering to run it
// through Web Crypto) can be unit-tested directly with plain Jest — this repo's jest.config.js runs
// in the plain 'node' environment (no jsdom), so a React context/provider itself can't be rendered
// and tested here the same way lib/ pure functions can (see secureStorage.test.ts's own comment on
// the same constraint). AppLockContext.tsx, LockScreen.tsx and SetupPinPrompt.tsx therefore stay
// intentionally thin wrappers around this file plus pinLock.ts/secureStorage.ts, and are verified via
// `tsc --noEmit` + a live check after shipping, matching every other UI-only component in this app
// (ChecklistSidebar.tsx, SaveProgressPanel.tsx, etc. have no dedicated test files either).

/** The four states AppLockContext's provider can be in. `checking` is the brief moment before the
 * mount effect has read whether a lock record exists yet (see that file's own comment on why this
 * can't be decided synchronously during the render that Next.js uses for server/client hydration
 * without risking a mismatch) — the provider renders nothing but a neutral placeholder during it. */
export type AppLockStatus = 'checking' | 'no-pin' | 'locked' | 'unlocked';

/** Once `checking` resolves: no lock record on disk at all (this applicant has never set up a PIN,
 * or the very common case of every applicant before this feature existed) means there is nothing to
 * unlock — the app should render normally, with only an optional, dismissible invitation to set one
 * up (SetupPinPrompt.tsx). A lock record existing means the app must show LockScreen in its 'unlock'
 * mode until a correct PIN or recovery phrase is entered, every single page load (the DEK only ever
 * lives in memory — see secureStorage.ts's own header comment). */
export function initialLockStatus(hasLockRecord: boolean): 'no-pin' | 'locked' {
  return hasLockRecord ? 'locked' : 'no-pin';
}

// A PIN is deliberately simple to type on a phone (this app's whole audience is applying for a
// visa from a phone, often in a queue or at a cafe with shaky signal) while still being far more
// than a 4-digit guess protects against once combined with PBKDF2 (100,000 rounds) — see pinLock.ts.
// 4-8 digits, numeric only.
const PIN_PATTERN = /^\d{4,8}$/;

/** Shape-only check (never touches crypto) so the UI can show "PIN must be 4-8 digits" instantly,
 * before spending a real PBKDF2 round-trip on something that was never going to work. */
export function isValidPinShape(pin: string): boolean {
  return PIN_PATTERN.test(pin);
}

export function pinsMatch(pin: string, confirmPin: string): boolean {
  return pin.length > 0 && pin === confirmPin;
}

// Mirrors generateRecoveryPhrase()'s own alphabet in pinLock.ts (4 groups of 4 characters,
// hyphen-separated) — kept independent rather than imported so this file has zero dependency on
// pinLock.ts (and therefore zero dependency on Web Crypto being available) to unit test.
const RECOVERY_PHRASE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
const RECOVERY_PHRASE_PATTERN = new RegExp(
  `^[${RECOVERY_PHRASE_ALPHABET}]{4}-[${RECOVERY_PHRASE_ALPHABET}]{4}-[${RECOVERY_PHRASE_ALPHABET}]{4}-[${RECOVERY_PHRASE_ALPHABET}]{4}$`
);

/** Normalizes the same way pinLock.ts's own `normalizeRecoveryPhrase` does (trim, uppercase, strip
 * whitespace) before checking the shape — an applicant copying a handwritten code by hand very
 * plausibly adds stray spaces or gets the case wrong on a letter, and neither should count as a
 * shape failure the way a genuinely wrong or incomplete code should. */
export function isValidRecoveryPhraseShape(phrase: string): boolean {
  const normalized = phrase.trim().toUpperCase().replace(/\s+/g, '');
  return RECOVERY_PHRASE_PATTERN.test(normalized);
}

/** Friendly, specific reason a typed PIN isn't accepted yet — shown inline as the applicant types,
 * before they even hit "Create PIN", rather than only after a failed submit. Returns null when the
 * PIN is fine so far (including simply being empty — an empty field isn't a per-character mistake). */
export function pinShapeError(pin: string): string | null {
  if (pin.length === 0) return null;
  if (!/^\d*$/.test(pin)) return 'PIN can only contain numbers.';
  if (pin.length < 4) return null; // still typing — not an error yet, just incomplete
  if (pin.length > 8) return 'PIN must be 8 digits or fewer.';
  return null;
}
