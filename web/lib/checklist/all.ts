// Fix for the Phase 4 production build failure: the checklist page files (app/checklist/uk/page.tsx,
// app/checklist/[country]/page.tsx, and their /reasons variants) are Server Components — that's
// required so app/checklist/[country]/page.tsx can export generateStaticParams. Passing a
// ChecklistItem[] array as a prop from a Server Component into a Client Component doesn't work:
// each item's `appliesIf` is a function, and functions can't cross the React Server Components
// serialization boundary. That's what hung `/checklist/uk`'s static generation on Vercel (build
// log: "Static page generation for /checklist/uk is still timing out after 3 attempts").
//
// Fix: the page files now pass only plain strings (code, flag, name, etc — all serializable).
// CountryChecklistApp and ReasonsView (both Client Components) look up their own checklist data
// by `code` from THIS module instead of receiving it as a prop — the import happens entirely
// inside client-bundled code, so no function ever needs to cross the server/client boundary.
import { ChecklistItem, CAT_ORDER_UK, CHECKLIST_UK } from './uk';
import { CAT_ORDER_CA, CHECKLIST_CA } from './ca';
import { CAT_ORDER_EU, CHECKLIST_EU } from './eu';
import { CAT_ORDER_ZA, CHECKLIST_ZA } from './za';
import { CAT_ORDER_GH, CHECKLIST_GH } from './gh';
import { CAT_ORDER_KE, CHECKLIST_KE } from './ke';
import { CAT_ORDER_ET, CHECKLIST_ET } from './et';
import { CAT_ORDER_MA, CHECKLIST_MA } from './ma';

export type CountryChecklistData = {
  catOrder: string[];
  checklist: ChecklistItem[];
};

export const ALL_CHECKLISTS: Record<string, CountryChecklistData> = {
  UK: { catOrder: CAT_ORDER_UK, checklist: CHECKLIST_UK },
  CA: { catOrder: CAT_ORDER_CA, checklist: CHECKLIST_CA },
  EU: { catOrder: CAT_ORDER_EU, checklist: CHECKLIST_EU },
  ZA: { catOrder: CAT_ORDER_ZA, checklist: CHECKLIST_ZA },
  GH: { catOrder: CAT_ORDER_GH, checklist: CHECKLIST_GH },
  KE: { catOrder: CAT_ORDER_KE, checklist: CHECKLIST_KE },
  ET: { catOrder: CAT_ORDER_ET, checklist: CHECKLIST_ET },
  MA: { catOrder: CAT_ORDER_MA, checklist: CHECKLIST_MA },
};
