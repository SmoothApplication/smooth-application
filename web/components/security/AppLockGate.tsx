'use client';

// Task #498. The actual "show the real app, or show LockScreen instead" decision, kept separate
// from AppLockContext.tsx's provider (see that file's header comment for why: avoiding a circular
// import with LockScreen, which needs useAppLock() itself). Not yet mounted anywhere — task #499
// wires this into the root layout, wrapped inside <AppLockProvider>.
import { ReactNode } from 'react';
import { useAppLock } from '@/lib/security/AppLockContext';
import LockScreen from './LockScreen';

export default function AppLockGate({ children }: { children: ReactNode }) {
  const { status } = useAppLock();

  // 'checking' (the brief moment before the provider's mount effect has read whether a lock record
  // exists) is treated the same as 'locked': render LockScreen, never a flash of the real app. Once
  // hasLockRecord() comes back false, status flips straight to 'no-pin' and children render normally
  // — LockScreen's own 'checking' treatment shows a neutral placeholder, not an unlock form, so this
  // is never visible as a false "you have a PIN" moment for the ~100% of applicants who don't.
  if (status === 'unlocked' || status === 'no-pin') {
    return <>{children}</>;
  }

  return <LockScreen />;
}
