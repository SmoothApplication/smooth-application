'use client';

// Task #498. Rendered by AppLockGate whenever the app is locked (a PIN was set up on this device,
// and this browser session hasn't unlocked it yet) or still 'checking' whether that's even the case.
// Unlock-only — the first-time "choose a PIN" flow is a separate, smaller UI (SetupPinModal.tsx,
// triggered from the opt-in SetupPinPrompt banner) since it only ever runs while the app is already
// unblocked (status 'no-pin'), never from here.
import { useState } from 'react';
import { useAppLock } from '@/lib/security/AppLockContext';
import { isValidRecoveryPhraseShape } from '@/lib/security/appLockState';

type Mode = 'pin' | 'recovery';

export default function LockScreen() {
  const { status, error, busy, unlockWithPin, unlockWithRecoveryPhrase, clearError } = useAppLock();
  const [mode, setMode] = useState<Mode>('pin');
  const [pin, setPin] = useState('');
  const [phrase, setPhrase] = useState('');

  // Brief moment before the provider's mount effect has determined whether a lock record even
  // exists — a neutral placeholder, never an unlock form asking for a PIN that might not exist.
  if (status === 'checking') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-cream">
        <p className="text-sm text-[#4c6270]">Loading…</p>
      </div>
    );
  }

  function switchMode(next: Mode) {
    setMode(next);
    clearError();
  }

  async function handlePinSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (busy || pin.length < 4) return;
    const ok = await unlockWithPin(pin);
    if (!ok) setPin('');
  }

  async function handleRecoverySubmit(e: React.FormEvent) {
    e.preventDefault();
    if (busy || !isValidRecoveryPhraseShape(phrase)) return;
    const ok = await unlockWithRecoveryPhrase(phrase);
    if (!ok) setPhrase('');
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-cream p-6">
      <div className="card-surface w-full max-w-sm p-6">
        <p className="text-center text-3xl">🔒</p>
        <h1 className="mt-2 text-center text-lg font-semibold text-[#12232e]">Your data is locked</h1>
        <p className="mt-1 text-center text-sm text-[#4c6270]">
          {mode === 'pin'
            ? 'Enter your PIN to unlock your saved checklist, documents, and bank statement analysis.'
            : 'Enter your recovery phrase — the 4 groups of 4 characters you wrote down when you set up your PIN.'}
        </p>

        {mode === 'pin' ? (
          <form onSubmit={handlePinSubmit} className="mt-4 flex flex-col gap-3">
            <input
              type="password"
              inputMode="numeric"
              autoFocus
              autoComplete="off"
              value={pin}
              onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 8))}
              placeholder="Enter your PIN"
              className="field-input text-center text-lg tracking-[0.3em]"
            />
            {error && <p className="text-xs font-semibold text-warn-text">{error}</p>}
            <button type="submit" disabled={busy || pin.length < 4} className="btn-primary">
              {busy ? 'Unlocking…' : 'Unlock'}
            </button>
            <button
              type="button"
              onClick={() => switchMode('recovery')}
              className="text-xs font-semibold text-[#4c6270] underline"
            >
              Forgot your PIN? Use your recovery phrase
            </button>
          </form>
        ) : (
          <form onSubmit={handleRecoverySubmit} className="mt-4 flex flex-col gap-3">
            <input
              type="text"
              autoFocus
              autoComplete="off"
              value={phrase}
              onChange={(e) => setPhrase(e.target.value.toUpperCase())}
              placeholder="ABCD-EFGH-JKMN-PQRS"
              className="field-input text-center uppercase tracking-widest"
            />
            {error && <p className="text-xs font-semibold text-warn-text">{error}</p>}
            <button
              type="submit"
              disabled={busy || !isValidRecoveryPhraseShape(phrase)}
              className="btn-primary"
            >
              {busy ? 'Unlocking…' : 'Unlock with recovery phrase'}
            </button>
            <button
              type="button"
              onClick={() => switchMode('pin')}
              className="text-xs font-semibold text-[#4c6270] underline"
            >
              ← Back to PIN
            </button>
          </form>
        )}

        <p className="mt-4 text-center text-xs text-[#93a3ac]">
          Lost both your PIN and recovery phrase? Your saved data on this device can&apos;t be recovered —
          that&apos;s the tradeoff of it being genuinely encrypted and never sent anywhere. You can always
          start over with a fresh checklist.
        </p>
      </div>
    </div>
  );
}
