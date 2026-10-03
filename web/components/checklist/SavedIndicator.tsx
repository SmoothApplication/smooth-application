'use client';

import { useEffect, useRef, useState } from 'react';

// Shows the person that what they typed was kept. Everything in this app autosaves on the device, but
// without a visible sign people could not tell, so: "Saving…" while they type, then "✓ Saved on this
// device". Nothing is shown until the value actually changes (so untouched fields stay quiet).
export default function SavedIndicator({ value, className = '' }: { value: string; className?: string }) {
  const first = useRef(true);
  const [state, setState] = useState<'idle' | 'saving' | 'saved'>('idle');
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    setState('saving');
    const t = setTimeout(() => setState('saved'), 600);
    return () => clearTimeout(t);
  }, [value]);
  if (state === 'idle') return null;
  return (
    <span role="status" aria-live="polite" className={`text-xs font-medium ${state === 'saved' ? 'text-green-700' : 'text-[#566a76]'} ${className}`}>
      {state === 'saved' ? '✓ Saved on this device' : 'Saving…'}
    </span>
  );
}
