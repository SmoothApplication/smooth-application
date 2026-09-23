// Country data for the consent gate (/checklist/start), ported from index.html's COUNTRIES object.
// Disclaimer text is copied verbatim from the live checklist (as of the September 2026 index.html)
// — this is real legal-adjacent copy, not placeholder text, so it's reproduced rather than
// rewritten. Only the 7 "ready" countries carry full disclaimers; US/AU/CN are listed as
// coming-soon exactly as they are in index.html.
export type CountryInfo = {
  code: string;
  flag: string;
  name: string;
  visaName: string;
  ready: boolean;
  disclaimerHeadline?: string;
  disclaimerBullets?: string[];
  disclaimerFullHtml?: string;
};

export const COUNTRIES: CountryInfo[] = [
  {
    code: 'UK',
    flag: '🇬🇧',
    name: 'United Kingdom',
    visaName: 'Standard Visitor visa',
    ready: true,
    disclaimerHeadline: 'Not immigration advice. A personal prep tool — it doesn’t decide, submit, or guarantee your application.',
    disclaimerBullets: [
      'Based on general gov.uk guidance, not official UKVI policy',
      "Financial figures are one reviewer's personal heuristics, not guaranteed thresholds",
      'Files are scanned entirely in your browser — nothing is uploaded',
    ],
    disclaimerFullHtml:
      'This tool reflects general UK Standard Visitor visa guidance (gov.uk) as of August 2026 and is meant to help you prepare — it does not decide, submit, or guarantee your application, and it cannot detect fraudulent documents. The financial-readiness figures (₦200,000 closing-balance floor, 2× cost buffer, 4-week timing rule) are an experienced reviewer’s personal heuristics from years of helping applicants, not official UKVI thresholds — a well-documented case can succeed without hitting every number here, and hitting them is no guarantee either. Requirements, fees, and processing times can change and can vary by individual case, so always confirm current requirements at <a href="https://www.gov.uk/standard-visitor" target="_blank" rel="noopener">gov.uk/standard-visitor</a> and your Visa Application Centre (VFS Global / TLScontact Nigeria), and consider a regulated immigration adviser (OISC-registered) for complex cases.',
  },
  {
    code: 'CA',
    flag: '🇨🇦',
    name: 'Canada',
    visaName: 'Visitor visa (TRV)',
    ready: true,
    disclaimerHeadline: 'Not immigration advice. A personal prep tool — it doesn’t decide, submit, or guarantee your application.',
    disclaimerBullets: [
      "Built from IRCC's official checklist (IMM 5484) and canada.ca guidance",
      'Not based on a personal case-review track record — treat figures as a starting point',
      'Files are scanned entirely in your browser — nothing is uploaded',
    ],
    disclaimerFullHtml:
      'This tool is built from IRCC’s official Document Checklist (IMM 5484), the visitor-visa guidance published on canada.ca, and cross-referenced immigration guides, as of August 2026. Unlike the UK checklist in this tool, this Canada checklist isn’t built from a personal track record of reviewed cases — treat every figure here as a general starting point, not a guarantee. Always confirm current requirements at <a href="https://www.canada.ca/en/immigration-refugees-citizenship/services/visit-canada/visitor-visa.html" target="_blank" rel="noopener">canada.ca — visitor visa</a> and your Visa Application Centre (VFS Global — Lagos/Abuja), and consider a regulated Canadian immigration consultant (RCIC) for complex cases.',
  },
  {
    code: 'EU',
    flag: '🇪🇺',
    name: 'Schengen',
    visaName: 'Short-stay visa (Type C)',
    ready: true,
    disclaimerHeadline: 'Not immigration advice. A personal prep tool — it doesn’t decide, submit, or guarantee your application.',
    disclaimerBullets: [
      'Based on the EU Visa Code and published consulate guidance, not a personal case-review track record',
      'Exact requirements (blank passport pages, bank statement history, fees) vary a little by the specific consulate you apply to',
      'Files are scanned entirely in your browser — nothing is uploaded',
    ],
    disclaimerFullHtml:
      'This tool reflects the EU Visa Code (Regulation (EC) 810/2009) and published consulate/VFS Global guidance for Nigerian applicants, as of August 2026. A Schengen short-stay (Type C) visa only covers up to 90 days within any 180-day period, and the exact requirements vary a little depending on which Schengen consulate you apply to (commonly France, Germany, the Netherlands, or Italy for Nigerian applicants; you generally apply to the consulate of whichever country you’ll spend the most nights in). Always confirm current requirements directly with that consulate or its Visa Application Centre (VFS Global or TLScontact Nigeria), and consider a regulated immigration adviser for complex cases.',
  },
  {
    code: 'ZA',
    flag: '🇿🇦',
    name: 'South Africa',
    visaName: 'Visitor visa',
    ready: true,
    disclaimerHeadline: 'Not immigration advice. A personal prep tool — it doesn’t decide, submit, or guarantee your application.',
    disclaimerBullets: [
      "Built from South Africa's Immigration Regulations, DHA guidance, and Form BI-84",
      'Not based on a personal case-review track record — treat figures as a starting point',
      'Files are scanned entirely in your browser — nothing is uploaded',
    ],
    disclaimerFullHtml:
      'This tool is built from South Africa’s Immigration Regulations (Section 11.1), the Department of Home Affairs’ (DHA) published Visitor’s Visa requirements, Form BI-84, and VFS Global’s Nigeria-specific guidance, as of August 2026. A yellow fever vaccination certificate is required for Nigerian applicants, and requirements around children’s travel documents have changed more than once in recent years, so confirm the current position directly before you travel. Applicants have also reported longer-than-usual processing delays at South African missions in Nigeria recently — build in extra buffer before your travel date. Always confirm current requirements at VFS Global Nigeria or the Department of Home Affairs, and consider a regulated immigration practitioner for complex cases.',
  },
  {
    code: 'GH',
    flag: '🇬🇭',
    name: 'Ghana',
    visaName: 'Travel readiness (visa-free)',
    ready: true,
    disclaimerHeadline: 'Not immigration advice. A personal travel-prep tool — Ghana is visa-free for Nigerian passport holders under ECOWAS, so this is not a visa application.',
    disclaimerBullets: [
      'Based on the ECOWAS Protocol on Free Movement and general Ghana Immigration Service entry guidance',
      'Immigration officers can still ask for proof of funds or accommodation at the border — not guaranteed, but worth having ready',
      'Files are scanned entirely in your browser — nothing is uploaded',
    ],
    disclaimerFullHtml:
      'Nigeria and Ghana are both ECOWAS member states, so under the ECOWAS Protocol on Free Movement, Nigerian passport holders can enter Ghana without a visa — typically for stays of up to 90 days. A yellow fever vaccination certificate is required, since Nigeria is a yellow-fever-endemic country — carry it alongside your passport. Immigration officers retain discretion to ask for proof of funds, accommodation, or an onward ticket at the border even though none of this is a formal visa requirement. Always confirm the current position at the Ghana Immigration Service and with your airline before you travel.',
  },
  {
    code: 'KE',
    flag: '🇰🇪',
    name: 'Kenya',
    visaName: 'Travel readiness (visa/eTA-exempt)',
    ready: true,
    disclaimerHeadline: 'Not immigration advice. A personal travel-prep tool — Nigeria has been visa/eTA-exempt for Kenya since July 2025, so this is not a visa application.',
    disclaimerBullets: [
      "Based on Kenya's published visa-exemption policy and general immigration entry guidance",
      'Immigration officers can still ask for proof of funds or accommodation at the border — not guaranteed, but worth having ready',
      'Files are scanned entirely in your browser — nothing is uploaded',
    ],
    disclaimerFullHtml:
      'Kenya added Nigeria to its eTA/visa-exempt list on 14 July 2025, so Nigerian passport holders can currently enter Kenya without a visa or eTA — entry permission is commonly reported around 60 days. A yellow fever vaccination certificate is required, since Nigeria is a yellow-fever-endemic country. Immigration officers retain discretion to ask for proof of funds, accommodation, or an onward ticket at the border. Always confirm the current position with Kenyan immigration and your airline before you travel.',
  },
  {
    code: 'ET',
    flag: '🇪🇹',
    name: 'Ethiopia',
    visaName: 'Tourist e-Visa',
    ready: true,
    disclaimerHeadline: 'Not immigration advice. A personal prep tool — it doesn’t decide, submit, or guarantee your application.',
    disclaimerBullets: [
      "Built from evisa.gov.et's published e-Visa guidance — only apply through the official portal",
      'Some requirements (bank statement, accommodation, return ticket) are reported inconsistently across sources — treated here as recommended rather than mandatory',
      'Files are scanned entirely in your browser — nothing is uploaded',
    ],
    disclaimerFullHtml:
      'This tool reflects published guidance for Ethiopia’s tourist e-Visa, applied for exclusively through the official portal at evisa.gov.et, as of September 2026. As of 2026 only the 30-day tourist e-Visa is issued; the fee is commonly reported around $82, though figures vary a little by source, so confirm the current amount directly on evisa.gov.et before paying. Be wary of look-alike third-party sites that charge extra for the same service. Arrival is currently only supported via Addis Ababa Bole International Airport. Always confirm current requirements directly at evisa.gov.et.',
  },
  {
    code: 'MA',
    flag: '🇲🇦',
    name: 'Morocco',
    visaName: 'Travel readiness (visa-free)',
    ready: true,
    disclaimerHeadline: 'Not immigration advice. A personal travel-prep tool — Morocco is visa-free for Nigerian passport holders for stays up to 30 days.',
    disclaimerBullets: [
      'Based on Morocco’s published visa-exemption policy for Nigerian passport holders',
      'A separate, narrow e-Visa (evis.ma) exists only for Nigerians who already hold a valid Schengen/UK/US/Canada visa or residence permit — not covered by this checklist',
      'Files are scanned entirely in your browser — nothing is uploaded',
    ],
    disclaimerFullHtml:
      'Ordinary Nigerian passport holders can enter Morocco without a visa for stays of up to 30 days — no application is needed for this general case. Your passport should be valid for at least 6 months beyond your travel date with at least 1 blank page. Morocco also runs a narrow e-Visa system (evis.ma) available only to Nigerians who already hold a valid multiple-entry Schengen/UK/US/Canada visa or residence permit with enough remaining validity — this checklist does not cover that case; if it applies to you, apply directly at evis.ma. Always confirm the current position with Moroccan authorities and your airline before you travel.',
  },
  { code: 'AU', flag: '🇦🇺', name: 'Australia', visaName: 'Australia visitor visa', ready: false },
  { code: 'CN', flag: '🇨🇳', name: 'China', visaName: 'China visitor visa', ready: false },
  { code: 'US', flag: '🇺🇸', name: 'United States', visaName: 'US visitor visa (B1/B2)', ready: false },
];
