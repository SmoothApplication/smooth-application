'use client';

import { useEffect, useState } from 'react';
import { Answers, DEFAULT_ANSWERS } from '@/lib/checklist/uk';
import { ALL_CHECKLISTS } from '@/lib/checklist/all';
import { CHECKLIST_UPDATED_EVENT } from '@/lib/checklist/liveUpdateEvents';
import * as secureStorage from '@/lib/security/secureStorage';

// Read-only mirror of the answers/checked state CountryChecklistApp owns (sa_<code>_answers /
// sa_<code>_checked), for pages that need the Documents-readiness score (the sidebar) but aren't
// CountryChecklistApp itself — the statement and financial calculator pages, once they gained a
// session shell + sidebar (task #381). This hook never writes to those keys, only reads them.
//
// Task #503: this used to only read on mount, so a component elsewhere on the page (e.g.
// PassportCheck.tsx auto-ticking 'passport' once a scanned passport is valid) that wrote to
// sa_<code>_checked directly had no way to make the sidebar notice without a full page reload —
// the same gap FINANCIAL_UPDATED_EVENT was added for on the Finances side (task #502). Listening
// for CHECKLIST_UPDATED_EVENT here closes the same gap for the Documents score.
export function useChecklistState(code: string) {
  const { checklist } = ALL_CHECKLISTS[code] ?? { catOrder: [], checklist: [] };
  const [answers, setAnswers] = useState<Answers>(DEFAULT_ANSWERS);
  const [checked, setChecked] = useState<Record<string, boolean>>({});

  useEffect(() => {
    const lower = code.toLowerCase();
    function load() {
      try {
        const a = secureStorage.getItem(`sa_${lower}_answers`);
        const c = secureStorage.getItem(`sa_${lower}_checked`);
        if (a) setAnswers({ ...DEFAULT_ANSWERS, ...JSON.parse(a) });
        if (c) setChecked(JSON.parse(c));
      } catch {
        /* start fresh */
      }
    }
    load();
    window.addEventListener(CHECKLIST_UPDATED_EVENT, load);
    return () => window.removeEventListener(CHECKLIST_UPDATED_EVENT, load);
  }, [code]);

  return { checklist, answers, checked };
}
