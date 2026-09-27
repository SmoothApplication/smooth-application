'use client';

import { useEffect, useState } from 'react';
import { Answers, DEFAULT_ANSWERS } from '@/lib/checklist/uk';
import { ALL_CHECKLISTS } from '@/lib/checklist/all';

// Read-only mirror of the answers/checked state CountryChecklistApp owns (sa_<code>_answers /
// sa_<code>_checked), for pages that need the Documents-readiness score (the sidebar) but aren't
// CountryChecklistApp itself — the statement and financial calculator pages, once they gained a
// session shell + sidebar (task #381). This hook never writes to those keys, only reads them.
export function useChecklistState(code: string) {
  const { checklist } = ALL_CHECKLISTS[code] ?? { catOrder: [], checklist: [] };
  const [answers, setAnswers] = useState<Answers>(DEFAULT_ANSWERS);
  const [checked, setChecked] = useState<Record<string, boolean>>({});

  useEffect(() => {
    const lower = code.toLowerCase();
    try {
      const a = localStorage.getItem(`sa_${lower}_answers`);
      const c = localStorage.getItem(`sa_${lower}_checked`);
      if (a) setAnswers({ ...DEFAULT_ANSWERS, ...JSON.parse(a) });
      if (c) setChecked(JSON.parse(c));
    } catch {
      /* start fresh */
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code]);

  return { checklist, answers, checked };
}
