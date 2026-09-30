'use client';

// Task #498. The opt-in invitation to turn this feature on at all — direct client complaint this
// whole feature exists for: "he would prefer he can sign out and come back, so that his information
// is not accessible to anyone who gains access to his laptop." Nobody is forced into setting up a
// PIN (see AppLockContext.tsx's header comment on why), so this renders only while `hasPinSetup` is
// false AND the applicant hasn't already dismissed it once (dismissSetupPrompt(), a plain boolean
// flag — never itself encrypted, see lockStore.ts's own header comment). Task #499 places this
// component somewhere in the checklist layout (SessionShell/ChecklistSidebar are the likely spots);
// not wired into either yet.
import { useEffect, useState } from 'react';
import { useAppLock } from '@/lib/security/AppLockContext';
import { isSetupPromptDismissed, dismissSetupPrompt } from '@/lib/security/lockStore';
import SetupPinModal from './SetupPinModal';

export default function SetupPinPrompt() {
  const { hasPinSetup } = useAppLock();
  const [dismissed, setDismissed] = useState(true); // default hidden until the client-only check below runs
  const [modalOpen, setModalOpen] = useState(false);

  useEffect(() => {
    setDismissed(isSetupPromptDismissed());
  }, []);

  if (hasPinSetup || dismissed) return null;

  function handleDismiss() {
    dismissSetupPrompt();
    setDismissed(true);
  }

  return (
    <>
      <div className="card-surface flex items-center justify-between gap-3 p-4">
        <div>
          <p className="text-sm font-semibold text-[#12232e]">🔒 Lock your saved data with a PIN</p>
          <p className="mt-1 text-xs text-[#4c6270]">
            Add a PIN so anyone else who opens this browser can&apos;t read your checklist, passport details, or
            bank statement analysis. Takes under a minute.
          </p>
        </div>
        <div className="flex shrink-0 flex-col gap-2 sm:flex-row">
          <button type="button" onClick={handleDismiss} className="text-xs font-semibold text-[#4c6270]">
            Not now
          </button>
          <button
            type="button"
            onClick={() => setModalOpen(true)}
            className="rounded-full bg-accent px-4 py-2 text-xs font-semibold text-white hover:bg-accent-dark"
          >
            Set up a PIN
          </button>
        </div>
      </div>
      {modalOpen && <SetupPinModal onClose={() => setModalOpen(false)} />}
    </>
  );
}
