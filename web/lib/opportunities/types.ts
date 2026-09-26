// Funded opportunities & exchange programs directory — ported verbatim from index.html's
// OPPORTUNITIES / PATHWAY_META (see index.html ~line 12647). A curated, static, country-independent
// list of real scholarship/exchange/fellowship programs for an applicant who can't yet afford ANY
// visa and wants a funded alternative instead. Not affiliated with Smooth Application; every entry
// links to the program's own official site.
//
// lastVerified (OPPORTUNITIES_LAST_VERIFIED) is the month this list's facts (funding amounts,
// eligibility rules, official URLs) were last checked against each program's own site — shown to
// the applicant so stale info reads as stale, not as current fact. Update it whenever this array
// itself is revisited and re-checked.

export type Pathway =
  | 'semester-exchange'
  | 'full-degree-scholarship'
  | 'postgrad-only'
  | 'professional-fellowship'
  | 'paid-program';

export const PATHWAY_META: Record<Pathway, { label: string; color: string }> = {
  'semester-exchange': { label: 'Semester exchange - stay enrolled at home', color: '#1a8a5f' },
  'full-degree-scholarship': { label: 'Full-degree scholarship - new admission required', color: '#8a6d1a' },
  'postgrad-only': { label: 'Postgraduate only - needs a first degree already', color: '#3d5a99' },
  'professional-fellowship': { label: 'Professional fellowship - not for current students', color: '#7a3d99' },
  'paid-program': { label: 'Paid program - real fees apply', color: '#a83d3d' },
};

export interface Opportunity {
  id: string;
  name: string;
  pathway: Pathway;
  funding: string;
  summary: string;
  eligibilityNote: string;
  whenToApply: string;
  officialUrl: string;
  officialUrlText: string;
}

export const OPPORTUNITIES_LAST_VERIFIED = 'August 2026';

export const OPPORTUNITIES: Opportunity[] = [
  {
    id: 'global-ugrad',
    name: 'Global UGRAD (Global Undergraduate Exchange Program)',
    pathway: 'semester-exchange',
    funding: 'Fully funded: flights, tuition, a monthly stipend, and health insurance.',
    summary:
      'One semester of non-degree study at a US college or university, plus community service and professional development - you stay enrolled at your Nigerian university and return afterwards to finish your degree.',
    eligibilityNote:
      'Must be a current undergraduate with at least one full year of study left after the exchange, so you genuinely return to finish at home. Open to Nigerian applicants. Never any application fee.',
    whenToApply:
      'Applications typically open around September–October for study the following academic year - confirm the current cycle with the U.S. Embassy Nigeria education office.',
    officialUrl: 'https://exchanges.state.gov/non-us/program/global-undergraduate-exchange-program-global-ugrad',
    officialUrlText: 'exchanges.state.gov (U.S. Department of State)',
  },
  {
    id: 'mastercard-scholars',
    name: 'Mastercard Foundation Scholars Program',
    pathway: 'full-degree-scholarship',
    funding: 'Fully funded at the partner university: tuition, accommodation, flights, and a living stipend.',
    summary:
      'Full undergraduate or Master’s scholarships delivered through partner universities in Africa, Europe, and North America (e.g. University of Cape Town, University of Pretoria, University of Edinburgh, McGill).',
    eligibilityNote:
      'Not something you apply for while staying at UNILAG - you apply directly to a partner university’s own admissions process, and only if admitted are you considered for the scholarship itself. No PhD-level awards.',
    whenToApply: 'Deadlines vary by partner university - each runs its own admissions cycle.',
    officialUrl: 'https://mastercardfdn.org/en/what-we-do/our-programs/mastercard-foundation-scholars-program/',
    officialUrlText: 'mastercardfdn.org',
  },
  {
    id: 'trent-global-citizen',
    name: 'Trent International Global Citizen Scholarship (Canada)',
    pathway: 'full-degree-scholarship',
    funding:
      'Up to CAD $40,000/year toward tuition and mandatory fees (up to $160,000 over 4 years) - not full living costs.',
    summary: 'A renewable entrance scholarship for new international undergraduates admitted to Trent University in Canada.',
    eligibilityNote:
      'For NEW admits only - this means starting a fresh 4-year degree at Trent, not continuing at UNILAG. Needs a final high-school average of 80%+ plus demonstrated leadership/community service.',
    whenToApply:
      'Apply for admission first; the scholarship application opens once you hold an offer - check the current deadline on Trent’s own site.',
    officialUrl: 'https://www.trentu.ca/futurestudents/scholarships-tuition/international-scholarships-awards',
    officialUrlText: 'trentu.ca',
  },
  {
    id: 'daad-in-country',
    name: 'DAAD In-Country/In-Region Scholarship Programme',
    pathway: 'postgrad-only',
    funding: 'Fully funded Master’s study (tuition, stipend, often travel) at a participating African university.',
    summary:
      'German-government-funded Master’s scholarships delivered through partner universities in Sub-Saharan Africa, including some Nigerian institutions.',
    eligibilityNote:
      'Postgraduate only - you need a completed first degree already. Aimed particularly at future university teachers/researchers. Apply through the specific participating university’s own call, not DAAD directly.',
    whenToApply: 'Calls are published by each participating university and listed in DAAD’s own scholarship database.',
    officialUrl:
      'https://www.daad.de/en/information-services-for-higher-education-institutions/further-information-on-daad-programmes/in-countryin-region-programme-in-developing-countries/',
    officialUrlText: 'daad.de',
  },
  {
    id: 'chevening',
    name: 'Chevening Scholarship (UK)',
    pathway: 'postgrad-only',
    funding: 'Fully funded one-year UK Master’s: tuition, monthly stipend, flights, and additional allowances.',
    summary:
      'A UK government scholarship for future leaders to complete a one-year Master’s degree at any UK university, in any subject.',
    eligibilityNote:
      'Needs a completed undergraduate degree PLUS at least 2 years (2,800 hours) of work experience gained after graduating. Not reachable while still an undergraduate - one to plan toward after finishing your degree and building work experience.',
    whenToApply: 'Applications typically open in August and close in early November, for study starting the following September.',
    officialUrl: 'https://www.chevening.org/scholarships/who-can-apply/',
    officialUrlText: 'chevening.org',
  },
  {
    id: 'fulbright-nigeria',
    name: 'Fulbright Foreign Student Program - Nigeria',
    pathway: 'postgrad-only',
    funding: 'Fully funded PhD research placement in the US (this Nigeria-specific track), funded by the U.S. Department of State.',
    summary:
      'A U.S. government exchange program - but in Nigeria specifically, this track supports early-career Nigerian university faculty carrying out part of their doctoral research in the US.',
    eligibilityNote:
      'Important: the U.S. Embassy Nigeria’s own guidance states Master’s and first-degree applicants are NOT eligible for this Nigeria track - it’s for applicants already at least 2 years into a PhD at a Nigerian university or research institute. Don’t confuse it with the general Fulbright Master’s programs some other countries run.',
    whenToApply: 'Announced annually via the U.S. Embassy Nigeria education page.',
    officialUrl: 'https://ng.usembassy.gov/the-fulbright-foreign-student-program/',
    officialUrlText: 'ng.usembassy.gov',
  },
  {
    id: 'commonwealth-shared',
    name: 'Commonwealth Shared Scholarship (UK)',
    pathway: 'postgrad-only',
    funding: 'Fully funded one-year Master’s in the UK: tuition, stipend, flights, and other allowances.',
    summary:
      'UK-government-funded Master’s scholarships for students from low- and middle-income Commonwealth countries, including Nigeria, on selected courses jointly supported by UK universities.',
    eligibilityNote:
      'Postgraduate only - needs a first degree of at least upper-second-class (2:1) standard already. Must show you couldn’t otherwise afford UK study, and must not have lived/worked a year or more in a high-income country.',
    whenToApply:
      'Applications typically open around October–November for the following academic year - eligible courses change each cycle.',
    officialUrl: 'https://cscuk.fcdo.gov.uk/commonwealth-shared-scholarships-eligible-courses/',
    officialUrlText: 'cscuk.fcdo.gov.uk',
  },
  {
    id: 'erasmus-mundus',
    name: 'Erasmus Mundus Joint Master Degrees',
    pathway: 'postgrad-only',
    funding:
      'Fully funded for scholarship recipients: tuition, travel, installation, and a monthly living allowance, across 2+ European countries.',
    summary:
      'Prestigious joint Master’s programmes taught across at least two universities in Europe (sometimes beyond), with full scholarships available for the strongest applicants.',
    eligibilityNote:
      'Needs a completed bachelor’s degree, or to be in your final year, before the programme starts. Each joint Master’s has its own consortium, requirements, and application portal - apply directly to the specific programme.',
    whenToApply:
      'Most programmes open applications October–January for study starting the following autumn - exact timing varies by programme.',
    officialUrl: 'https://erasmus-plus.ec.europa.eu/opportunities/individuals/students/erasmus-mundus-joint-masters',
    officialUrlText: 'erasmus-plus.ec.europa.eu',
  },
  {
    id: 'mandela-washington',
    name: 'Mandela Washington Fellowship (YALI)',
    pathway: 'professional-fellowship',
    funding: 'Fully funded: a 6-week US academic/leadership institute - flights, housing, and a stipend.',
    summary:
      'A US government leadership program for young African leaders - a 6-week institute at a US university in one of three tracks: business & entrepreneurship, civic engagement, or public management.',
    eligibilityNote:
      'Not a current-student program in the ordinary sense - you must be 25–35 (exceptional 21–24 year-olds are rarely considered) with an established record of leadership and impact already, not a course of study. Best suited to someone who has already graduated and built a track record.',
    whenToApply: 'Applications typically open around September–October each year.',
    officialUrl: 'https://yali.state.gov/mwf/',
    officialUrlText: 'yali.state.gov',
  },
  {
    id: 'aiesec-global-volunteer',
    name: 'AIESEC Global Volunteer',
    pathway: 'paid-program',
    funding:
      'NOT fully funded - expect an AIESEC program fee (reportedly around €349) plus a separate project-matching fee (reportedly $150–$350); flights, visas, and insurance are on top of that.',
    summary:
      'A 6–8 week volunteer placement abroad on a social-impact project, arranged through your nearest AIESEC local committee - genuinely open to students, but marketed more as "free" than it actually is.',
    eligibilityNote:
      'Ages 18–30, open to current students - but budget for it like any paid trip once AIESEC’s own fees, flights, visa costs, and insurance are added up. Treat any figure you’re first quoted as a floor, not the total.',
    whenToApply: 'Rolling - browse live opportunities once you’ve joined a local committee.',
    officialUrl: 'https://aiesec.org/global-volunteer',
    officialUrlText: 'aiesec.org',
  },
];
