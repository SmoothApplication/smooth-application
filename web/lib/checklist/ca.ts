// Ported from index.html's CHECKLIST_CA / CAT_ORDER_CA (as of the September 2026 index.html).
// Item text, tips, and conditional appliesIf logic are carried over verbatim/faithfully — same
// pattern as uk.ts (Phase 2). Phase 4a of task #244 ports the remaining 7 countries.
import { Answers, ChecklistItem } from './uk';

export const CAT_ORDER_CA = [
  'Identity & application',
  'Financial evidence',
  'Ties to Nigeria',
  'Accommodation & Canadian host',
  'Travel details',
  'Purpose-specific',
  'If a child is travelling',
  'Visa history',
  'Translations',
];

export const CHECKLIST_CA: ChecklistItem[] = [
  // Identity & application
  {
    id: 'passport', cat: 'Identity & application', weight: 'required',
    label: 'Valid passport (covers your whole trip)',
    tip: "IRCC recommends your passport stay valid for as long as possible into the future - a visa is placed directly into the passport, so if it's close to expiring, renew before you apply.",
  },
  {
    id: 'photo', cat: 'Identity & application', weight: 'required',
    label: 'Digital photo meeting IRCC specifications',
    tip: 'Recent, plain light background, specific size/format - check the exact spec on canada.ca before you apply.',
  },
  {
    id: 'applicationForm', cat: 'Identity & application', weight: 'required', appliesIf: (a) => a.readyToSubmit,
    label: 'Completed Application for Visitor Visa (IMM 5257) & confirmation',
    tip: 'Submitted through your IRCC secure account online, or on paper with the IMM 5257 form if applying by mail.',
  },
  {
    id: 'familyInfoForm', cat: 'Identity & application', weight: 'required', appliesIf: (a) => a.readyToSubmit,
    label: 'Family Information form (IMM 5645)',
    tip: "Lists your spouse, children and parents - required alongside the main application, whether or not they're travelling with you.",
  },
  {
    id: 'feePaid', cat: 'Identity & application', weight: 'required', appliesIf: (a) => a.readyToSubmit,
    label: 'Application + biometrics fee payment confirmation',
    tip: 'Roughly CAD $100 processing plus CAD $85 biometrics per person as of August 2026 - confirm the current amounts on canada.ca, since fees change from time to time.',
  },
  {
    id: 'biometric', cat: 'Identity & application', weight: 'required', appliesIf: (a) => a.readyToSubmit,
    label: 'Biometrics given at a Visa Application Centre (VFS Global)',
    tip: 'Required for most applicants aged 14–79, usually within 30 days of applying - book at a VFS Global centre in Lagos or Abuja.',
  },
  {
    id: 'oldPassports', cat: 'Identity & application', weight: 'recommended',
    label: 'Previous passport(s) showing earlier travel history',
    tip: "Evidence you've travelled abroad and returned home before strengthens your application - bio page(s) of any previous passport(s).",
  },
  {
    id: 'oldVisas', cat: 'Identity & application', weight: 'recommended',
    label: 'Previous visa(s) / entry stamps from earlier travel (Canada, US, UK, Schengen, etc.)',
    tip: "A track record of visiting other countries and returning home on time is one of the strongest signals IRCC looks for - attach photos of past visa pages and entry/exit stamps.",
  },

  // Financial evidence
  {
    id: 'bankStatements', cat: 'Financial evidence', weight: 'required',
    label: 'Personal bank statements — last 3–6 months (up to 3 files)',
    tip: 'IRCC does not publish one official minimum balance - what counts as "enough" depends on your trip length, flight and accommodation costs, and who\'s paying for what. Show a healthy, explainable balance built up steadily, not a lump sum deposited right before applying.',
  },
  {
    id: 'termDeposit', cat: 'Financial evidence', weight: 'recommended',
    label: 'Fixed/term deposit certificate (optional)',
    tip: 'Extra evidence of savings held over a longer period, if you have one - strengthens the picture alongside your regular statements.',
  },
  {
    id: 'payslips', cat: 'Financial evidence', weight: 'required', appliesIf: (a) => a.employed,
    label: 'Pay stubs — last 3 months',
    tip: 'Matches the salary stated in your employment letter and the regular credit on your bank statement - reviewers cross-check all three.',
  },
  {
    id: 'taxDocs', cat: 'Financial evidence', weight: 'recommended',
    label: 'Income tax returns / tax clearance — last 2 years (recommended)',
    tip: 'Extra proof of a stable financial and legal footing in Nigeria.',
  },
  {
    id: 'forexProof', cat: 'Financial evidence', weight: 'recommended',
    label: 'Proof of foreign currency savings/income (optional)',
    tip: 'If you added foreign currency savings in the calculator above, a supporting document - foreign bank statement, exchange receipt, or remittance confirmation - makes that figure easier for a reviewer to trust than a typed-in number alone.',
  },
  {
    id: 'bizFinance', cat: 'Financial evidence', weight: 'required', appliesIf: (a) => a.selfEmployed,
    label: 'Business bank statements',
    tip: 'Upload 6 months of BUSINESS bank statements showing you drawing a personal salary from the business, not just money sitting in the business account. A business is a separate legal entity from its owner, so business funds alone don\'t demonstrate your own personal means.',
  },
  {
    id: 'cacDocs', cat: 'Financial evidence', weight: 'required', appliesIf: (a) => a.selfEmployed,
    label: 'CAC registration (business registration documents)',
    tip: 'Your CAC certificate and other business registration documents - shows the business exists and is active.',
  },
  {
    id: 'sponsorFinance', cat: 'Financial evidence', weight: 'required',
    appliesIf: (a) => a.hasHost && a.hostFunding,
    label: "Sponsor's financial documents + Sponsorship/Invitation Letter (IMM 5481)",
    tip: 'Needed if a host or relative in Canada is covering some or all of your costs - their bank statements/employment letter plus the IMM 5481 form.',
  },
  {
    id: 'spouseSponsorFinance', cat: 'Financial evidence', weight: 'required',
    appliesIf: (a) => a.married && a.spouseSponsoring,
    label: "Spouse's financial documents + signed sponsor letter",
    tip: 'Since your spouse is sponsoring this trip: their bank statements for the last 3–6 months, plus a signed letter from them stating their relationship to you and confirming they\'re funding your visit.',
  },

  // Ties to Nigeria
  {
    id: 'leaveLetter', cat: 'Ties to Nigeria', weight: 'required', appliesIf: (a) => a.employed,
    label: "Employer's leave-approval letter",
    tip: 'Should state the exact number of days approved, matching your travel dates and itinerary - a mismatch is a common cause for doubt.',
  },
  {
    id: 'employmentLetter', cat: 'Ties to Nigeria', weight: 'required', appliesIf: (a) => a.employed,
    label: 'Employment letter on company letterhead (role, salary, start date)',
    tip: 'Your name on this letter must match your name exactly as entered above, and as it appears on your bank statement. The salary stated should also match the regular monthly inflow shown on your bank statement.',
  },
  {
    id: 'staffId', cat: 'Ties to Nigeria', weight: 'required', appliesIf: (a) => a.employed,
    label: 'Staff ID card',
    tip: 'A photo/scan of your staff ID card, front (and back too if it carries details) - corroborating the employment letter.',
  },
  {
    id: 'officePhoto', cat: 'Ties to Nigeria', weight: 'required', appliesIf: (a) => a.employed,
    label: 'A photo of yourself at your workplace',
    tip: 'A recent, genuine photo of you at your office or place of work.',
  },
  {
    id: 'enrolmentLetter', cat: 'Ties to Nigeria', weight: 'required', appliesIf: (a) => a.student,
    label: 'School/university admission or enrolment letter',
    tip: 'Confirms your current studies and that the institution expects you back.',
  },
  {
    id: 'studentSponsorLetter', cat: 'Ties to Nigeria', weight: 'required',
    appliesIf: (a) => a.student && a.studentSponsor,
    label: "Sponsor's financial documents + a short letter from them confirming support",
    tip: 'As a student, funding usually comes from someone else - reviewers want to see who, how they\'re related to you, and proof they can actually afford it.',
  },
  {
    id: 'familyTies', cat: 'Ties to Nigeria', weight: 'recommended',
    label: 'Evidence of dependants in Nigeria (marriage/birth certificates)',
    tip: 'A spouse, children, or other dependants relying on you in Nigeria is a strong reason IRCC expects you to return.',
  },
  {
    id: 'landAsset', cat: 'Ties to Nigeria', subcat: 'Assets & investments', weight: 'recommended',
    label: 'Land or property ownership documents',
    tip: 'Certificate of Occupancy, deed, or title - a claim alone carries little weight without the paperwork.',
  },
  {
    id: 'goldAsset', cat: 'Ties to Nigeria', subcat: 'Assets & investments', weight: 'recommended',
    label: 'Valuables (e.g. gold) purchase receipts or valuation',
    tip: "Only useful with proof of ownership/value - a verbal claim isn't evidence.",
  },
  {
    id: 'pensionAsset', cat: 'Ties to Nigeria', subcat: 'Assets & investments', weight: 'recommended',
    label: 'Pension / RSA statement',
    tip: 'A recent statement from your PenCom-registered Pension Fund Administrator.',
  },
  {
    id: 'investmentAsset', cat: 'Ties to Nigeria', subcat: 'Assets & investments', weight: 'recommended',
    label: 'Investment statements (shares, mutual funds, treasury bills, etc.)',
    tip: 'Recent statements from your broker/fund manager - again, proof required, not just a claim.',
  },

  // Accommodation & Canadian host
  {
    id: 'invitationLetter', cat: 'Accommodation & Canadian host', weight: 'required', appliesIf: (a) => a.hasHost,
    label: 'Invitation letter from your Canadian host',
    tip: "Should include the host's full name, address, immigration status (citizen/PR/valid visa holder), your relationship, exact dates of your stay, and who is paying for what.",
  },
  {
    id: 'hostStatus', cat: 'Accommodation & Canadian host', weight: 'required', appliesIf: (a) => a.hasHost,
    label: "Copy of host's status document (PR card / citizenship certificate / valid visa)",
    tip: 'Confirms your host is lawfully in Canada and able to host you.',
  },
  {
    id: 'hostAddress', cat: 'Accommodation & Canadian host', weight: 'required', appliesIf: (a) => a.hasHost,
    label: "Host's proof of address (recent utility bill or lease)",
    tip: "Confirms where you'll actually be staying.",
  },
  {
    id: 'hostFinance', cat: 'Accommodation & Canadian host', weight: 'required',
    appliesIf: (a) => a.hasHost && a.hostFunding,
    label: "Host's bank statement or employment letter",
    tip: 'Needed if your host is covering some or all of your costs - pair this with the IMM 5481 sponsorship form above.',
  },
  {
    id: 'hotelBooking', cat: 'Accommodation & Canadian host', weight: 'required', appliesIf: (a) => !a.hasHost,
    label: 'Hotel / accommodation booking confirmation',
    tip: "A reservation hold is usually enough - doesn't need to be prepaid.",
  },

  // Travel details
  {
    id: 'flightItinerary', cat: 'Travel details', weight: 'required',
    label: 'Flight itinerary / reservation (round-trip)',
    tip: "A reservation hold showing your planned dates is usually enough - you generally don't need a fully paid ticket before the visa is approved.",
  },
  {
    id: 'returnEvidence', cat: 'Travel details', weight: 'required',
    label: 'Evidence of return or onward travel',
    tip: 'Shows the officer you plan to leave Canada at the end of your visit.',
  },
  {
    id: 'caItinerary', cat: 'Travel details', weight: 'required',
    label: 'Day-by-day itinerary of places you plan to visit in Canada',
    tip: "Named cities/provinces, roughly what you'll do each day - a simple typed list is fine, no formal document or template needed.",
  },
  {
    id: 'accomVerified', cat: 'Travel details', weight: 'required',
    label: 'Accommodation verified (address is real and booking is genuine)',
    tip: "No document to upload here - just double-check the booking reference is live and the address exists.",
  },
  {
    id: 'sightseeing', cat: 'Travel details', weight: 'recommended',
    label: "Sightseeing plans — name and ticket of places you'll visit",
    tip: 'Shows a genuine, specific plan rather than a vague one.',
  },
  {
    id: 'insurance', cat: 'Travel details', weight: 'recommended',
    label: 'Travel / medical insurance',
    tip: 'Not mandatory for a visitor visa, but strongly recommended - Canada has no free public healthcare for visitors.',
  },
  {
    id: 'coverLetter', cat: 'Travel details', weight: 'recommended',
    label: 'Letter of Explanation / cover letter',
    tip: 'A short letter in your own words covering your purpose of visit, your itinerary, and your specific reasons for returning home (job, family, property).',
  },

  // Purpose-specific
  {
    id: 'bizLetterPair', cat: 'Purpose-specific', weight: 'required', appliesIf: (a) => a.purpose === 'business',
    label: "Letters from your Nigerian employer and the Canadian company you're visiting",
    tip: 'Should detail the business relationship and the purpose of your meetings. If you\'re also ticked as employed, your existing employment letter can simply be adapted to also cover this.',
  },
  {
    id: 'confInvite', cat: 'Purpose-specific', weight: 'required', appliesIf: (a) => a.purpose === 'conference',
    label: 'Letter of invitation from the conference/event organiser',
    tip: 'Plus your registration confirmation if you have one.',
  },
  {
    id: 'medLetter', cat: 'Purpose-specific', weight: 'required', appliesIf: (a) => a.purpose === 'medical',
    label: 'Letter from the Canadian medical practitioner/clinic',
    tip: 'Diagnosis, proposed treatment, estimated cost and expected duration.',
  },
  {
    id: 'medFunds', cat: 'Purpose-specific', weight: 'required', appliesIf: (a) => a.purpose === 'medical',
    label: 'Proof of funds to cover the full cost of treatment',
    tip: 'On top of your general financial evidence above.',
  },
  {
    id: 'familyProof', cat: 'Purpose-specific', weight: 'required', appliesIf: (a) => a.purpose === 'family',
    label: "Proof of relationship to the family you're visiting",
    tip: 'Birth/marriage certificates or similar linking you to your Canada-based family.',
  },
  {
    id: 'weddingInvite', cat: 'Purpose-specific', weight: 'required', appliesIf: (a) => a.purpose === 'wedding',
    label: 'Wedding appointment confirmation or invitation',
    tip: 'Confirms the event you are attending and the date.',
  },
  {
    id: 'academicLetters', cat: 'Purpose-specific', weight: 'required', appliesIf: (a) => a.purpose === 'academic',
    label: 'Letters from your employer and the Canadian host institution',
    tip: 'Required for an academic visit/research stay - check whether a study permit is needed instead if it runs longer than 6 months.',
  },
  {
    id: 'trainingProof', cat: 'Purpose-specific', weight: 'required', appliesIf: (a) => a.purpose === 'training',
    label: 'Proof of paid training / course enrolment',
    tip: 'Invoice/payment confirmation, course syllabus, and a letter from the Canadian training provider - check whether a study permit is required if the course runs over 6 months.',
  },

  // Children
  {
    id: 'birthCert', cat: 'If a child is travelling', weight: 'required', appliesIf: (a) => a.hasChild,
    label: 'Full birth certificate showing both parents',
  },
  {
    id: 'consentLetter', cat: 'If a child is travelling', weight: 'required', appliesIf: (a) => a.hasChild,
    label: 'Notarized consent letter from the non-travelling parent(s)/guardian',
    tip: "IRCC recommends this be notarized, plus a copy of that parent's passport data page.",
  },
  {
    id: 'parentsPassports', cat: 'If a child is travelling', weight: 'required', appliesIf: (a) => a.hasChild,
    label: "Copies of both parents' passport data pages",
  },

  // Visa history
  {
    id: 'refusalDocs', cat: 'Visa history', weight: 'required', appliesIf: (a) => a.hasRefusal,
    label: 'Previous visa refusal documentation (Canada or elsewhere)',
    tip: "The refusal letter(s) for each prior refusal you listed above, ideally alongside a short cover-letter explanation of what's changed since - IRCC explicitly asks whether you've ever been refused a visa to any country.",
  },

  // Translations
  {
    id: 'translations', cat: 'Translations', weight: 'required', appliesIf: (a) => a.translation,
    label: 'Certified English or French translations of any other-language documents',
    tip: "Must include the translator's certification/affidavit plus a copy of the original document - IRCC requires certified translations for anything not already in English or French.",
  },
];
