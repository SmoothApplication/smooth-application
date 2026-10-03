// "Who pays your salary?" - the letter is strongest when the employer name matches what actually
// appears on the statement (a visa officer weighs steady, sustainable monthly income heavily). To make
// that easy to fill, we offer the payer names already visible in the statement as one-tap choices.
import type { SourceGroups, ParsedTxn } from '@/lib/statement/types';
import { extractRemitaPurpose, extractRemitaRemitter } from '@/lib/statement/remitaReason';

export interface EmployerSuggestion {
  name: string;
  count: number;
  total: number;
}

function titleCase(s: string): string {
  return s.toLowerCase().replace(/\b[a-z]/g, (c) => c.toUpperCase());
}


export function suggestEmployerNames(groups: SourceGroups): EmployerSuggestion[] {
  const found = new Map<string, EmployerSuggestion>();
  const add = (raw: string, t: ParsedTxn | null, totalOverride?: number, countOverride?: number) => {
    const name = titleCase(raw.trim());
    if (name.length < 3) return;
    const cur = found.get(name.toLowerCase()) || { name, count: 0, total: 0 };
    cur.count += countOverride ?? 1;
    cur.total += totalOverride ?? (t ? t.credit : 0);
    found.set(name.toLowerCase(), cur);
  };
  groups.forEach((g) => {
    if (g.type === 'salary') {
      g.txns.forEach((t) => {
        const r = extractRemitaRemitter(t.narration);
        if (r) add(r, t);
      });
    } else if (g.type === 'company') {
      add(g.name, null, g.total, g.count);
      // A company paying through Remita is almost certainly the employer.
      if (g.txns.some((t) => extractRemitaPurpose(t.narration))) {
        g.txns.forEach((t) => {
          const r = extractRemitaRemitter(t.narration);
          if (r && r.toLowerCase() !== g.name.toLowerCase()) add(r, t);
        });
      }
    }
  });
  return Array.from(found.values()).sort((a, b) => b.total - a.total).slice(0, 4);
}

/** Does the statement show salary-like income? Then an employer name should be required. */
export function hasSalaryLikeIncome(groups: SourceGroups): boolean {
  return groups.some((g) => g.type === 'salary' || (g.type === 'company' && g.txns.some((t) => extractRemitaPurpose(t.narration))));
}
