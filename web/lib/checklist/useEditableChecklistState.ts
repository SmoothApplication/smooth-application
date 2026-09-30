'use client';

import { useEffect, useState } from 'react';
import { Answers, DEFAULT_ANSWERS } from '@/lib/checklist/uk';
import { ALL_CHECKLISTS } from '@/lib/checklist/all';
import * as secureStorage from '@/lib/security/secureStorage';

// Task #383 (document-checklist split into per-category sessions): a writable counterpart to
// useChecklistState.ts's read-only mirror. CountryChecklistApp already had this exact
// load/save-on-change pattern inline for its own qualifying-questions form and (previously) its
// single combined checklist body — pulled out here so the new per-category session pages
// (ChecklistCategorySession.tsx) can read AND toggle the same sa_<code>_answers/sa_<code>_checked
// localStorage keys without duplicating that logic a second time, and without CountryChecklistApp
// needing to change how it manages its own copy of the same state.
export function useEditableChecklistState(code: string) {
  const { catOrder, checklist } = ALL_CHECKLISTS[code.toUpperCase()] ?? { catOrder: [], checklist: [] };
  const answersKey = `sa_${code.toLowerCase()}_answers`;
  const checkedKey = `sa_${code.toLowerCase()}_checked`;

  const [answers, setAnswers] = useState<Answers>(DEFAULT_ANSWERS);
  const [checked, setChecked] = useState<Record<string, boolean>>({});
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    try {
      const a = secureStorage.getItem(answersKey);
      const c = secureStorage.getItem(checkedKey);
      if (a) setAnswers({ ...DEFAULT_ANSWERS, ...JSON.parse(a) });
      if (c) setChecked(JSON.parse(c));
    } catch {
      /* start fresh */
    }
    setLoaded(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code]);

  useEffect(() => {
    if (!loaded) return;
    try {
      secureStorage.setItem(answersKey, JSON.stringify(answers));
    } catch {
      /* ignore */
    }
  }, [answers, loaded, answersKey]);

  useEffect(() => {
    if (!loaded) return;
    try {
      secureStorage.setItem(checkedKey, JSON.stringify(checked));
    } catch {
      /* ignore */
    }
  }, [checked, loaded, checkedKey]);

  function toggle(id: string) {
    setChecked((prev) => ({ ...prev, [id]: !prev[id] }));
  }

  return { catOrder, checklist, answers, setAnswers, checked, setChecked, toggle, loaded };
}
