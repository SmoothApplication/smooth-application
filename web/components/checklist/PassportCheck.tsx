'use client';

import { useEffect, useRef, useState } from 'react';
import PassportScan from '@/components/checklist/PassportScan';
import ResumeReminderLinks from '@/components/checklist/ResumeReminderLinks';
import SessionShell from '@/components/checklist/SessionShell';
import { COUNTRIES } from '@/lib/checklist/countries';
import { getPassportValidityStatus } from '@/lib/passport';
import { dispatchChecklistUpdated } from '@/lib/checklist/liveUpdateEvents';
import {
  FieldState,
  PersistedPassportFields,
  serializePassportFields,
  deserializePassportFields,
  hasPassportFields,
} from '@/lib/passport/persist';
import * as secureStorage from '@/lib/security/secureStorage';

// Task #503: the document checklist's "passport" item (lib/checklist/uk.ts etc., id: 'passport',
// "Valid passport (covers your whole trip)") was never auto-ticked here — an applicant could scan
// a perfectly valid passport and see the Documents readiness score sit at its old value forever,
// because nothing on this page ever wrote to sa_<code>_checked. Ticking it automatically once the
// scanned/recalled expiry date clears the same 6-months-remaining bar the passport-scan page
// already shows a "🎉 Congratulations" banner for (lib/passport/validity.ts) means the applicant
// never has to separately remember to go tick a box for something we already told them is fine —
// and, since this only ever sets the flag to true (never clears it), a manual tick the applicant
// made elsewhere (or before this fix existed) is never undone by revisiting this page.
function autoTickPassportIfValid(checkedStorageKey: string, fields: FieldState) {
  const validity = getPassportValidityStatus(fields.expiryDate);
  if (!validity || validity.level !== 'ok') return;
  try {
    const raw = secureStorage.getItem(checkedStorageKey);
    const current = raw ? (JSON.parse(raw) as Record<string, boolean>) : {};
    if (current.passport) return; // already ticked — nothing changed, don't dispatch a no-op event
    secureStorage.setItem(checkedStorageKey, JSON.stringify({ ...current, passport: true }));
    dispatchChecklistUpdated();
  } catch {
    /* ignore — worst case the applicant ticks it by hand on the checklist */
  }
}

// Generalized out of the original UK-only web/app/checklist/uk/passport/page.tsx (Phase 3 of the
// passport-MRZ port, task #244) so the same passport-scan checklist page (reusing PassportScan's
// camera/file capture -> OCR -> parse pipeline) can be reused for every supported country's
// /checklist/<country>/passport route, not just the UK's. MRZ parsing itself (lib/passport/*) is
// based on the applicant's own nationality, not the destination country — this component is now
// parameterized by `countryCode` instead of hardcoding "uk".
//
// Privacy: unchanged — the photo is captured and OCR'd entirely in this tab and never uploaded
// anywhere, and is discarded as soon as it's read. What DOES get saved is the small plain-data set
// of six editable fields (see lib/passport/persist.ts) under one localStorage key,
// sa_<countryCode>_passport. No photo, canvas, or raw OCR text is ever stored.
//
// Only a plain string (`countryCode`) crosses the Server -> Client boundary from the page files
// that render this component — see the comment at the top of lib/checklist/all.ts for why a
// function-bearing prop broke the production build previously.
export type PassportCheckProps = {
  countryCode: string;
};

function loadSaved(storageKey: string): FieldState | null {
  try {
    const raw = secureStorage.getItem(storageKey);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as PersistedPassportFields;
    const fields = deserializePassportFields(parsed);
    if (!hasPassportFields(fields)) return null;
    return fields;
  } catch {
    return null;
  }
}

export default function PassportCheck({ countryCode }: PassportCheckProps) {
  const lowerCode = countryCode.toLowerCase();
  const storageKey = `sa_${lowerCode}_passport`;
  const checkedStorageKey = `sa_${lowerCode}_checked`;
  const countryInfo = COUNTRIES.find((c) => c.code === countryCode.toUpperCase());
  const visaName = countryInfo?.visaName || 'visa';
  const countryName = countryInfo?.name || countryCode;

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
    const saved = loadSaved(storageKey);
    if (saved) {
      setSavedFields(saved);
      fieldsRef.current = saved;
      setRecalled(true);
      autoTickPassportIfValid(checkedStorageKey, saved);
    }
    setLoaded(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storageKey]);

  function handleFieldsChange(fields: FieldState) {
    fieldsRef.current = fields;
    // Save on every field edit, once loaded - same debounce-free pattern as
    // web/components/checklist/FinancialCalculator.tsx and StatementCheck.tsx. Only saves once
    // there's at least one non-empty field; an aborted/empty scan never touches localStorage.
    if (!hasPassportFields(fields)) return;
    try {
      secureStorage.setItem(storageKey, JSON.stringify(serializePassportFields(fields)));
    } catch {
      /* ignore */
    }
    autoTickPassportIfValid(checkedStorageKey, fields);
  }

  function clearSaved() {
    try {
      secureStorage.removeItem(storageKey);
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
    <SessionShell code={countryCode} name={countryName} session="passport">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h1 className="font-serif text-xl font-semibold text-[#12232e]">🛂 Passport scan</h1>
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

      {/* Resume reminder (task #319+): only shown before the passport is scanned/recalled — once
          the applicant already has these details saved, a "go get your passport" nudge no longer
          applies. The original showed this unconditionally in its single-session HTML; gating it
          here is a deliberate adaptation to the Next app's own recalled/not-recalled UI. */}
      {!recalled && (
        <ResumeReminderLinks
          visaName={visaName}
          whatToBring="my international passport"
          prompt="Need to go get your passport first? Send yourself a reminder with the link back to this page:"
        />
      )}

      <PassportScan
        key={resetCount}
        initialFields={savedFields}
        onFieldsChange={handleFieldsChange}
        title="🛂 Passport scan"
        description="Photograph or upload your passport's photo page and we'll try to read the details automatically."
        standalone={false}
      />

    </SessionShell>
  );
}
