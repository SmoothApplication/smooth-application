// Port of index.html's "Travel Experience" session (task #319+ selection "Build travel history
// first, then the full report") — country lists, the five "build history" guides for a first-time
// traveller, and the travel-history grading logic. Ported from index.html lines 4825-4944
// (country lists + TE_NO_HISTORY_GUIDES) and 7397-7422 (updateTravelExperienceGrade).
//
// Deliberately NOT ported here (see CHANGELOG for the full disclosure):
//   - The EU-specific funds-readiness sub-flow (te_euFundsBox/te_euSingleEntryComfort/
//     te_euUkAdviceBox) — informational only, not required by the "next steps" report this is
//     ultimately feeding, and specific to a European-destination framing this app's country
//     checklists don't share.
//   - The custom searchable country-combobox widget (wireCountryCombo) — replaced with a plain
//     native <select> populated from TE_COUNTRY_LIST, consistent with every other dropdown in
//     this port.
//   - The country-guide "steps + cost estimate" content rendering into a modal
//     (#teCountryGuideModalBody) — rendered inline instead, consistent with this port's existing
//     <details>/inline pattern, avoiding introducing a new modal system.
//   - updateTravelExperienceReasons() (the "Reasons" tab integration) — that tab's architecture is
//     a separate, not-yet-ported piece of the original; the grading logic below returns its info
//     lines directly to the caller instead of pushing them into a shared REASONS array.

// ---------------- Country lists ----------------
// Small curated lists (not exhaustive) — only need to support the specific grading rules below.

export const TE_AFRICAN_COUNTRIES: string[] = [
  'Ghana', 'Kenya', 'Ethiopia', 'Morocco', 'Egypt', 'South Africa', 'Senegal', 'Rwanda',
  'Tanzania', 'Uganda', 'Ivory Coast', 'Cameroon', 'Benin', 'Togo', 'Zambia', 'Botswana',
  'Namibia', 'Tunisia',
];

export const TE_EU_COUNTRIES: string[] = [
  'France', 'Germany', 'Italy', 'Spain', 'Portugal', 'Netherlands', 'Belgium', 'Luxembourg',
  'Austria', 'Sweden', 'Denmark', 'Finland', 'Poland', 'Czechia', 'Greece', 'Hungary', 'Romania',
  'Bulgaria', 'Croatia', 'Slovakia', 'Slovenia', 'Estonia', 'Latvia', 'Lithuania', 'Malta',
  'Cyprus',
];

// Named individually per the original's grading spec (each treated as a strong "1st-world" /
// high-GDP signal on its own, distinct from the African/EU groupings above).
export const TE_NAMED_HIGH_VALUE_COUNTRIES: string[] = [
  'United States', 'Canada', 'United Kingdom', 'China', 'Ireland', 'Singapore',
];

export const TE_ASIAN_COUNTRIES: string[] = [
  'Japan', 'South Korea', 'United Arab Emirates', 'Qatar', 'India', 'Malaysia', 'Thailand',
  'Saudi Arabia', 'Turkey', 'Indonesia', 'Vietnam',
];

// "High chance of success" trio called out explicitly in the original's spec.
export const TE_HIGH_SUCCESS_COUNTRIES: string[] = ['South Africa', 'Morocco', 'Kenya'];

export const TE_COUNTRY_LIST: string[] = (function build() {
  const seen: Record<string, boolean> = {};
  const out: string[] = [];
  ([] as string[])
    .concat(
      TE_AFRICAN_COUNTRIES,
      TE_EU_COUNTRIES,
      TE_NAMED_HIGH_VALUE_COUNTRIES,
      TE_ASIAN_COUNTRIES,
      ['Australia', 'New Zealand', 'Brazil', 'Other']
    )
    .forEach((c) => {
      if (!seen[c]) {
        seen[c] = true;
        out.push(c);
      }
    });
  return out.sort((a, b) => (a === 'Other' ? 1 : b === 'Other' ? -1 : a.localeCompare(b)));
})();

// ---------------- "Build travel history" country guides ----------------
// Ported verbatim from TE_NO_HISTORY_GUIDES (index.html lines 4852-4944), current as of August/
// September 2026 like every other figure in this app — a starting point, not a guarantee.

export interface TeCostEstimate {
  road: string | null;
  flight: string;
  note?: string;
}

export interface TeCountryGuide {
  visaType: string;
  summary: string;
  steps: string[];
  costEstimate?: TeCostEstimate;
}

export const TE_NO_HISTORY_GUIDES: Record<string, TeCountryGuide> = {
  Ghana: {
    visaType: 'Visa-free (ECOWAS)',
    summary:
      "The simplest of the five - Nigerians don't need a visa to enter Ghana at all under the ECOWAS free movement protocol.",
    steps: [
      "Make sure your Nigerian international passport has at least 6 months' validity left.",
      "Get (or renew) your Yellow Fever vaccination card - this is strictly required at entry and you can be turned back without it.",
      "Book a return or onward flight if flying into Accra - it's recommended, and immigration may ask to see it.",
      "Be ready to explain your travel purpose, where you're staying, and when you're returning - immigration can ask, even though no visa is needed.",
      'No visa application, no fee, no embassy visit - you\'re done. Sources: current ECOWAS free-movement guidance and Nigeria–Ghana travel-requirement guides.',
    ],
    costEstimate: {
      road:
        "Cross-border coach - ABC Transport's own booking site listed their Sprinter Service (2+2 seating) at ₦100,000 one-way, Lagos Jibowu–Accra, checked directly Sept 2026; a Standard Coach seat may be cheaper if one's available on your date. Scheduled journey time is shown as around 14 hours, though the booking site's own listed arrival can span into the following day - check the exact schedule before paying.",
      flight: 'Direct flights (Air Peace and others) - roughly $150–350 one-way (~1 hour).',
      note:
        'The price gap between road and flight is narrower than it might look at first glance - compare both directly for your actual travel dates rather than assuming road is automatically the cheaper option.',
    },
  },
  Kenya: {
    visaType: 'Visa/eTA-exempt (since July 2025)',
    summary:
      "Kenya exempted Nigeria from its eTA requirement via Legal Notice No. 93 (effective 14 July 2025) - no eTA or visa needed for a short visit, and no online application to make.",
    steps: [
      "Make sure your passport has at least 6 months' validity and a blank page.",
      'Get (or renew) your Yellow Fever vaccination card - Kenya requires this from travellers arriving from Nigeria, and you can be refused entry without it.',
      "Book a return or onward flight - immigration can ask to see it on arrival even though no visa is needed.",
      'Have proof of accommodation and funds ready in case a border official asks - not a formal requirement, but sensible to carry.',
      "No eTA, no visa, no fee, no online application - present your passport and documents on arrival. Entry is commonly granted for up to 60 days. Source: Kenya's Legal Notice No. 93 (May 2025) and current Kenyan immigration guidance.",
    ],
    costEstimate: {
      road: null,
      flight:
        'Flight-only trip - no realistic overland route exists from Nigeria. Direct/one-stop economy fares (Kenya Airways and others) run roughly $400–750 one-way, 5–9 hours depending on routing.',
      note:
        'Intra-Africa fares vary a lot by how far ahead you book - check several dates before settling on one, and weigh this against the cheaper Ghana option if cost is the main constraint.',
    },
  },
  Ethiopia: {
    visaType: 'e-Visa required (~$82, online)',
    summary:
      'Nigerians can no longer get a visa on arrival in Ethiopia (that changed for several nationalities in 2026) - you need to apply for an e-Visa before you travel.',
    steps: [
      "Make sure your passport has at least 6 months' validity.",
      'Apply only through the official site - evisa.gov.et - never a third-party site that charges extra.',
      'Fill in the form and upload a passport photo, your return ticket, and proof of accommodation.',
      'Pay the fee (around $82) with an international Visa/Mastercard.',
      'Wait for your e-Visa by email - usually about 3 business days.',
      'This gets you a single entry, valid 90 days from issue, for stays of up to 30 days.',
      "Bring a Yellow Fever certificate if you're arriving from a country where it's required. Source: Ethiopia's official e-Visa process, current entry-requirement guides.",
    ],
    costEstimate: {
      road: null,
      flight:
        'Flight-only trip - no realistic overland route exists from Nigeria. Ethiopian Airlines flies direct from Lagos roughly 14 times a week; economy fares vary widely, roughly $500–1,200+ one-way depending on season and how far ahead you book.',
      note:
        "This route's fares swing more than most on this list depending on booking window - worth comparing several dates rather than booking the first price you see.",
    },
  },
  Morocco: {
    visaType: 'Visa-free (up to 30 days) for most applicants',
    summary:
      "Ordinary Nigerian passport holders can enter Morocco visa-free for stays of up to 30 days - no application needed. A separate, narrow e-visa (evis.ma) exists only for Nigerians who already hold a valid multiple-entry Schengen/US/UK/Canada visa or residence permit - that's not the general case most first-time travellers are in.",
    steps: [
      "Make sure your passport is valid for at least 6 months beyond your travel date, with at least 1 blank page for the entry stamp.",
      'Book a return or onward flight - airlines and border officials commonly expect to see one.',
      'Have proof of accommodation and funds ready in case a border official asks - not a formal requirement, but sensible to carry.',
      'No visa application, no fee, no embassy visit needed for stays of up to 30 days.',
      "Already hold a valid multiple-entry Schengen/US/UK/Canada visa or residence permit with enough remaining validity? You may alternatively qualify for Morocco's e-visa at evis.ma - check eligibility there if it applies to you.",
      "Source: Morocco's published visa-exemption policy for Nigerian passport holders and evis.ma's eligibility guidance.",
    ],
  },
  'South Africa': {
    visaType: 'Visa required (VFS Global)',
    summary:
      "South Africa requires a visa in advance, applied for in person with biometrics - this is the most document-heavy of the five, so it's worth starting early.",
    steps: [
      "Download and complete Form BI-84 from the VFS Global portal or South Africa's Department of Home Affairs site - it needs to be signed.",
      'Book an appointment at VFS Global in Lagos, or the South African High Commission in Abuja, for biometrics and document submission.',
      "Gather your documents: passport (6+ months validity, 2 blank pages), 2 passport photos, 3 months' bank statements, an employment letter confirming your role/salary/approved leave/return date, 3 months' payslips, return flight booking, proof of accommodation for your whole stay, a day-by-day itinerary, Yellow Fever certificate, and evidence of ties to Nigeria (things that show you'll come back - job, property, family).",
      'Attend your appointment, submit your documents, and give your biometric data (fingerprints/photo).',
      "Pay the fee - around ZAR 1,520 (roughly $80) plus VFS's own service fee, paid at the centre.",
      "Get your passport back in about 10–15 business days with the visa sticker or a decision letter. Source: current South Africa visitor-visa guidance for Nigerian applicants.",
    ],
    costEstimate: {
      road: null,
      flight:
        'Flight-only trip - no realistic overland route exists from Nigeria. Direct/one-stop economy fares (Ethiopian Airlines and others) run roughly $320–820 one-way, 8–12 hours depending on routing.',
      note:
        'This is also the most document-heavy of the five (see the visa steps above) - factor in the visa fee, VFS service fee, and biometrics appointment time alongside the flight cost.',
    },
  },
};

// ---------------- Travel history / overstay rows ----------------

export interface TravelHistoryRow {
  country: string;
  /** 'YYYY-MM', matching the original's separate month/year selects recombined. */
  date: string;
  reason: string;
  /** Kept as a string (raw input value) like the original; parse with parseTravelDays. */
  days: string;
}

export interface OverstayRow {
  country: string;
  /** Kept as a string (raw input value) like the original; parse with parseTravelDays. */
  days: string;
}

// Port of index.html's parseNum (line 7689) — used here specifically for the "days" fields.
export function parseTravelDays(value: string | number | null | undefined): number {
  if (!value) return 0;
  const n = parseFloat(String(value).replace(/[^0-9.-]/g, ''));
  return Number.isNaN(n) ? 0 : n;
}

// ---------------- Grading ----------------

export interface TravelExperienceGrade {
  /** Graduated info lines, same content/order as the original's infoLines. Empty when nothing to show. */
  infoLines: string[];
  /** Whether any overstay row has a positive days value. */
  overstayedAny: boolean;
}

// Port of updateTravelExperienceGrade (index.html lines 7397-7422), split into a pure function:
// the DOM writes (box.innerHTML, updateTravelExperienceReasons) are the caller's job now. Returns
// null when there's nothing to grade yet (no rows), matching the original's early-return behavior.
export function computeTravelExperienceGrade(
  historyRows: TravelHistoryRow[],
  overstayRows: OverstayRow[]
): TravelExperienceGrade | null {
  const countries = historyRows.map((r) => r.country).filter(Boolean);
  if (!countries.length) return null;

  const africanCount = countries.filter((c) => TE_AFRICAN_COUNTRIES.indexOf(c) !== -1).length;
  const euCount = countries.filter((c) => TE_EU_COUNTRIES.indexOf(c) !== -1).length;
  const visitedHighValue = countries.some(
    (c) => TE_NAMED_HIGH_VALUE_COUNTRIES.indexOf(c) !== -1 || TE_ASIAN_COUNTRIES.indexOf(c) !== -1
  );
  const visitedHighSuccess = countries.some((c) => TE_HIGH_SUCCESS_COUNTRIES.indexOf(c) !== -1);
  const overstayedAny = overstayRows.some((r) => r.country && parseTravelDays(r.days) > 0);

  const infoLines: string[] = [];
  if (africanCount >= 3) infoLines.push("You've visited 3 or more African countries - a solid, well-rounded travel history.");
  else if (africanCount === 2) infoLines.push("You've visited 2 African countries - a good, growing travel history.");
  else if (africanCount === 1) infoLines.push("You've visited 1 African country - a start to building your travel history.");

  if (euCount >= 2) infoLines.push("You've visited 2 or more EU countries - this is commonly seen as a positive factor for another Schengen or similar visa.");
  else if (euCount === 1) infoLines.push("You've visited 1 EU country - this is commonly seen as a positive factor too.");

  if (visitedHighValue) {
    infoLines.push(
      "You've visited a major/high-GDP destination (US, Canada, UK, China, Ireland, Singapore, or another Asian country) - that travel history is generally considered a positive factor, provided your finances show you can afford this visit."
    );
  }
  if (visitedHighSuccess && !overstayedAny) {
    infoLines.push("You've visited South Africa, Morocco, and/or Kenya without overstaying - this is generally viewed as a positive sign for a UK visa application.");
  }

  return { infoLines, overstayedAny };
}
