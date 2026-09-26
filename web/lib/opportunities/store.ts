// Pure logic for the funded-opportunities directory's pathway filter — ported from the filter-row
// building and shown-list logic inside index.html's renderOpportunities() (~line 12758). No
// DOM/React here; web/app/opportunities/page.tsx renders these.

import { Opportunity, Pathway, PATHWAY_META } from './types';

export function getPathwayCounts(opportunities: Opportunity[]): Partial<Record<Pathway, number>> {
  const counts: Partial<Record<Pathway, number>> = {};
  for (const o of opportunities) {
    counts[o.pathway] = (counts[o.pathway] ?? 0) + 1;
  }
  return counts;
}

/** 'all' first, then every pathway that has at least one program — in PATHWAY_META's own
 * declaration order (not the order programs happen to appear in the data), same as the original's
 * `['all'].concat(Object.keys(PATHWAY_META).filter(...))`. A pathway with zero current programs is
 * left out entirely rather than shown as an empty filter. */
export function getVisibleFilterKeys(opportunities: Opportunity[]): ('all' | Pathway)[] {
  const counts = getPathwayCounts(opportunities);
  const pathwayKeys = (Object.keys(PATHWAY_META) as Pathway[]).filter((k) => !!counts[k]);
  return ['all', ...pathwayKeys];
}

export function filterOpportunities(opportunities: Opportunity[], pathway: 'all' | Pathway): Opportunity[] {
  return pathway === 'all' ? opportunities : opportunities.filter((o) => o.pathway === pathway);
}
