'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import PassportScan from '@/components/checklist/PassportScan';
import {
  FieldState,
  PersistedPassportFields,
  serializePassportFields,
  deserializePassportFields,
  hasPassportFields,
} from '@/lib/passport/persist';

// Phase 3 of the passport-MRZ port: the real, linked checklist page — reuses PassportScan's
// existing camera/file capture -> OCR -> parse pipeline (Phase 2) rather than duplicating it (same
// call-site-reuse approach as web/app/checklist/uk/statement/page.tsx reusing the statement engine),
// plus localStorage persistence so revisiting this page doesn't require re-scanning the passport.
//
// Privacy: unchanged from Phase 2 — the photo is captured and OCR'd entirely in this tab and never
// uploaded anywhere, and is discarded as soon as it's read. What DOES get saved is the small
// plain-data set of six editable fields (see lib/passport/persist.ts) under one localStorage key,
// sa_uk_passport. No photo, canvas, or raw OCR text is ever stored.
const STORAGE_KEY = 'sa_uk_passport';

function loadSaved(): FieldState | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as PersistedPassportFields;
    const fields = deserializePassportFields(parsed);
    if (!hasPassportFields(fields)) return null;
    return fields;
  } catch {
    return null;
  }
}

export default function UKPassportScanPage() {
  const [loaded, setLoaded] = useState(false);
  const [recalled, setRecalled] = useState(false);
  const [savedFields, setSavedFields] = useState<FieldState | null>(null);
  // Bumped on "Scan a different passport" to force PassportScan to fully remount with fresh,
  // empty internal state (rather than trying to imperatively reset it from the outside).
  const [resetCount, setResetCount] = useState(0);

  const fieldsRef = useRef<FieldState | null>(null);

  // Restore a previously-saved scan on mount, so this page can skip straight to the editable
  // fields instead of asking the applicant to re-scan every visit - same "recalled, no need to
  // re-scan" UX the rest of this app already uses for other saved answers.
  useEffect(() => {
    const saved = loadSaved();
    if (saved) {
      setSavedFields(saved);
      fieldsRef.current = saved;
      setRecalled(true);
    }
    setLoaded(true);
  }, []);

  function handleFieldsChange(fields: FieldState) {
    fieldsRef.current = fields;
    // Save on every field edit, once loaded - same debounce-free pattern as
    // web/app/checklist/uk/financial/page.tsx and web/app/checklist/uk/statement/page.tsx. Only
    // saves once there's at least one non-empty field; an aborted/empty scan never touches
    // localStorage.
    if (!hasPassportFields(fields)) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(serializePassportFields(fields)));
    } catch {
      /* ignore */
    }
  }

  function clearSaved() {
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      /* ignore */
    }
    fieldsRef.current = null;
    setSavedFields(null);
    setRecalled(false);
    setResetCount((n) => n + 1);
  }

  if (!loaded) return null;

  return (
    <main className="mx-auto flex min-h-screen max-w-4xl flex-col gap-5 p-6 pb-16">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h1 className="text-xl font-semibold text-[#12232e]">🛂 Passport scan</h1>
          <p className="mt-1 text-sm text-[#4c6270]">
            Photograph or upload your passport&apos;s photo page and we&apos;ll try to read the details
            automatically.
          </p>
        </div>
        {recalled && (
          <button type="button" onClick={clearSaved} className="text-xs text-accent underline">
            Scan a different passport
          </button>
        )}
      </div>

      {recalled && (
        <div className="rounded-lg bg-accent-wash p-3 text-sm text-accent" role="status">
          📄 Details recalled from your last visit — no need to re-scan.
        </div>
      )}

      <PassportScan
        key={resetCount}
        initialFields={savedFields}
        onFieldsChange={handleFieldsChange}
        title="🛂 Passport scan"
        description="Photograph or upload your passport's photo page and we'll try to read the details automatically."
        standalone={false}
      />

      <Link href="/checklist/uk" className="text-center text-xs text-accent underline">
        ← Back to checklist
      </Link>
    </main>
  );
}
