'use client';

// Task #498. Triggered from SetupPinPrompt's "Set up a PIN" button. Two steps: choose+confirm a
// PIN (calls AppLockContext's setupPin(), which is already functionally unlocked by the time it
// resolves — see that file's own comment), then show the generated recovery phrase and require an
// explicit "I've saved it" confirmation before closing, since it's never shown again and never
// recoverable from anywhere else (see pinLock.ts's header comment on the honest tradeoff of real
// encryption with no server-side reset path).
import { useState } from 'react';
import { useAppLock } from '@/lib/security/AppLockContext';
import { isValidPinShape, pinsMatch, pinShapeError } from '@/lib/security/appLockState';

type Step = 'choose' | 'reveal';

export default function SetupPinModal({ onClose }: { onClose: () => void }) {
  const { setupPin, busy, error } = useAppLock();
  const [step, setStep] = useState<Step>('choose');
  const [pin, setPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [localError, setLocalError] = useState<string | null>(null);
  const [recoveryPhrase, setRecoveryPhrase] = useState<string | null>(null);

  async function handleChooseSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLocalError(null);
    if (!isValidPinShape(pin)) {
      setLocalError('PIN must be 4-8 digits.');
      return;
    }
    if (!pinsMatch(pin, confirmPin)) {
      setLocalError("PINs don't match.");
      return;
    }
    const result = await setupPin(pin);
    if (result) {
      setRecoveryPhrase(result.recoveryPhrase);
      setStep('reveal');
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="card-surface w-full max-w-sm p-6">
        {step === 'choose' ? (
          <form onSubmit={handleChooseSubmit} className="flex flex-col gap-3">
            <h2 className="text-lg font-semibold text-[#12232e]">Choose a PIN</h2>
            <p className="text-xs text-[#4c6270]">
              4-8 digits. You&apos;ll enter this each time you come back to unlock your saved data.
            </p>
            <input
              type="password"
              inputMode="numeric"
              autoFocus
              autoComplete="off"
              value={pin}
              onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 8))}
              placeholder="New PIN"
              className="field-input text-center text-lg tracking-[0.3em]"
            />
            {pin.length > 0 && pinShapeError(pin) && (
              <p className="text-xs font-semibold text-warn-text">{pinShapeError(pin)}</p>
            )}
            <input
              type="password"
              inputMode="numeric"
              autoComplete="off"
              value={confirmPin}
              onChange={(e) => setConfirmPin(e.target.value.replace(/\D/g, '').slice(0, 8))}
              placeholder="Confirm PIN"
              className="field-input text-center text-lg tracking-[0.3em]"
            />
            {(localError || error) && (
              <p className="text-xs font-semibold text-warn-text">{localError || error}</p>
            )}
            <div className="mt-2 flex gap-2">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 rounded-lg border border-black/10 px-4 py-2.5 text-sm font-semibold text-[#12232e]"
              >
                Cancel
              </button>
              <button type="submit" disabled={busy} className="btn-primary flex-1 text-sm">
                {busy ? 'Setting up…' : 'Create PIN'}
              </button>
            </div>
          </form>
        ) : (
          <div className="flex flex-col gap-3">
            <h2 className="text-lg font-semibold text-[#12232e]">Write down your recovery phrase</h2>
            <p className="text-xs text-[#4c6270]">
              If you ever forget your PIN, this is the only other way back into your saved data — nobody, including
              us, can reset it for you. Write it down somewhere safe before you continue.
            </p>
            <p className="rounded-lg bg-accent-wash px-4 py-3 text-center text-lg font-semibold tracking-wide text-accent-dark">
              {recoveryPhrase}
            </p>
            <button
              type="button"
              onClick={onClose}
              className="btn-primary mt-2 text-sm"
            >
              I&apos;ve written it down
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
