// Phase 4a of task #244: registry tying each ready country's checklist data (lib/checklist/{code}.ts)
// to the generic /checklist/[country] page. UK keeps its own dedicated /checklist/uk route (built in
// Phase 2, and the financial calculator lives under it) rather than moving into this registry —
// this just covers the 7 newly-ported countries so /checklist/[country] can render any of them.
import { ChecklistItem } from './uk';
import { CAT_ORDER_CA, CHECKLIST_CA } from './ca';
import { CAT_ORDER_EU, CHECKLIST_EU } from './eu';
import { CAT_ORDER_ZA, CHECKLIST_ZA } from './za';
import { CAT_ORDER_GH, CHECKLIST_GH } from './gh';
import { CAT_ORDER_KE, CHECKLIST_KE } from './ke';
import { CAT_ORDER_ET, CHECKLIST_ET } from './et';
import { CAT_ORDER_MA, CHECKLIST_MA } from './ma';

export type CountryChecklistData = {
  code: string;
  flag: string;
  name: string;
  catOrder: string[];
  checklist: ChecklistItem[];
};

export const COUNTRY_CHECKLISTS: Record<string, CountryChecklistData> = {
  CA: { code: 'CA', flag: '🇨🇦', name: 'Canada', catOrder: CAT_ORDER_CA, checklist: CHECKLIST_CA },
  EU: { code: 'EU', flag: '🇪🇺', name: 'Schengen', catOrder: CAT_ORDER_EU, checklist: CHECKLIST_EU },
  ZA: { code: 'ZA', flag: '🇿🇦', name: 'South Africa', catOrder: CAT_ORDER_ZA, checklist: CHECKLIST_ZA },
  GH: { code: 'GH', flag: '🇬🇭', name: 'Ghana', catOrder: CAT_ORDER_GH, checklist: CHECKLIST_GH },
  KE: { code: 'KE', flag: '🇰🇪', name: 'Kenya', catOrder: CAT_ORDER_KE, checklist: CHECKLIST_KE },
  ET: { code: 'ET', flag: '🇪🇹', name: 'Ethiopia', catOrder: CAT_ORDER_ET, checklist: CHECKLIST_ET },
  MA: { code: 'MA', flag: '🇲🇦', name: 'Morocco', catOrder: CAT_ORDER_MA, checklist: CHECKLIST_MA },
};
