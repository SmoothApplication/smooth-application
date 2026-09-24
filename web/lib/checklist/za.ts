// Ported from index.html's CHECKLIST_ZA / CAT_ORDER_ZA (as of the September 2026 index.html).
// Item text, tips, and conditional appliesIf logic are carried over verbatim/faithfully — same
// pattern as uk.ts (Phase 2). Phase 4a of task #244 ports the remaining 7 countries.
import { Answers, ChecklistItem } from './uk';

export const CAT_ORDER_ZA = [
  'Identity & application',
  'Financial evidence',
  'Ties to Nigeria',
  'Accommodation & South African host',
  'Travel details',
  'Purpose-specific',
  'If a child is travelling',
  'Visa history',
  'Translations',
];

export const CHECKLIST_ZA: ChecklistItem[] = [
  // Identity & application
  {
    id: 'passport', cat: 'Identity & application', weight: 'required',
    label: 'Valid passport (covers your whole trip)',
    tip: 'Must be valid for at least 30 days beyond your intended departure from South Africa, with at least 2 blank pages for endorsements.',
  },
  {
    id: 'photo', cat: 'Identity & application', weight: 'required',
    label: '2 recent colour passport photos (35×45mm, white/light background)',
    tip: 'Check the exact current spec with VFS Global before your appointment - sizing requirements are strictly enforced.',
  },
  {
    id: 'applicationForm', cat: 'Identity & application', weight: 'required', appliesIf: (a) => a.readyToSubmit,
    label: 'Completed & signed Form BI-84 (Application for a Visa)',
    tip: "South Africa's standard visa application form, used for all visa types - Home Affairs asks that it be completed in block letters, black ink only, and fully filled in.",
  },
  {
    id: 'feePaid', cat: 'Identity & application', weight: 'required', appliesIf: (a) => a.readyToSubmit,
    label: 'Visa fee + VFS service fee payment confirmation',
    tip: 'Widely reported as around ₦10,400 visa fee plus a VFS Global service fee (roughly ₦29,400 in Lagos/Abuja, more in Port Harcourt) as of 2026 - confirm the exact current amounts directly with VFS Global Nigeria before paying.',
  },
  {
    id: 'biometric', cat: 'Identity & application', weight: 'required', appliesIf: (a) => a.readyToSubmit,
    label: 'Biometrics given at VFS Global (Lagos, Abuja or Port Harcourt) or the South African High Commission',
    tip: 'Book your appointment ahead of time - applicants have reported longer-than-usual processing delays at South African missions in Nigeria recently, so build in extra buffer before your travel date.',
  },
  {
    id: 'oldPassports', cat: 'Identity & application', weight: 'recommended',
    label: 'Previous passport(s) showing earlier travel history',
    tip: "Evidence you've travelled abroad and returned home before strengthens your application - bio page(s) of any previous passport(s).",
  },
  {
    id: 'oldVisas', cat: 'Identity & application', weight: 'recommended',
    label: 'Previous visa(s) / entry stamps from earlier travel',
    tip: 'A track record of visiting other countries and returning home on time is one of the strongest signals a reviewer looks for - attach photos of past visa pages and entry/exit stamps.',
  },

  // Financial evidence
  {
    id: 'bankStatements', cat: 'Financial evidence', weight: 'required',
    label: 'Bank-certified personal bank statements — last 3 months (up to 3 files)',
    tip: "DHA's own published requirement asks for 3 months of statements, ideally bank-certified (stamped by your bank) rather than a plain printout or downloaded PDF. Show a healthy, explainable balance built up steadily, not a lump sum deposited right before applying.",
  },
  {
    id: 'payslips', cat: 'Financial evidence', weight: 'required', appliesIf: (a) => a.employed,
    label: 'Payslips — last 3 months',
    tip: 'Matches the salary stated in your employment letter and the regular credit on your bank statement - reviewers cross-check all three.',
  },
  {
    id: 'taxDocs', cat: 'Financial evidence', weight: 'recommended',
    label: 'Tax clearance certificate — last 2 years (recommended)',
    tip: 'Extra proof of a stable financial and legal footing in Nigeria.',
  },
  {
    id: 'forexProof', cat: 'Financial evidence', weight: 'recommended',
    label: 'Proof of foreign currency savings/income (optional)',
    tip: 'If you added foreign currency savings in the calculator above, a supporting document makes that figure easier for a reviewer to trust than a typed-in number alone.',
  },
  {
    id: 'bizFinance', cat: 'Financial evidence', weight: 'required', appliesIf: (a) => a.selfEmployed,
    label: 'Business bank statements',
    tip: 'Upload 3 months of BUSINESS bank statements showing you drawing a personal salary from the business, not just money sitting in the business account.',
  },
  {
    id: 'cacDocs', cat: 'Financial evidence', weight: 'required', appliesIf: (a) => a.selfEmployed,
    label: 'CAC registration (business registration documents)',
    tip: 'Your CAC certificate and other business registration documents - shows the business exists and is active.',
  },
  {
    id: 'sponsorFinance', cat: 'Financial evidence', weight: 'required',
    appliesIf: (a) => a.hasHost && a.hostFunding,
    label: "Sponsor's financial documents (if someone else is funding this trip)",
    tip: 'Needed if a host or relative in South Africa is covering some or all of your costs - pair this with the affidavit of undertaking below.',
  },
  {
    id: 'spouseSponsorFinance', cat: 'Financial evidence', weight: 'required',
    appliesIf: (a) => a.married && a.spouseSponsoring,
    label: "Spouse's financial documents + signed sponsor letter",
    tip: 'Since your spouse is sponsoring this trip: their bank statements for the last 3 months, plus a signed letter from them confirming they\'re funding your visit.',
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
    tip: 'A spouse, children, or other dependants relying on you in Nigeria is a strong reason a reviewer expects you to return.',
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

  // Accommodation & South African host
  {
    id: 'invitationLetter', cat: 'Accommodation & South African host', weight: 'required', appliesIf: (a) => a.hasHost,
    label: 'Invitation letter from your South African host',
    tip: "Should include the host's full name, address, ID/status, your relationship, and exact dates of your stay.",
  },
  {
    id: 'hostStatus', cat: 'Accommodation & South African host', weight: 'required', appliesIf: (a) => a.hasHost,
    label: "Copy of host's ID / passport / residence permit",
    tip: 'Confirms your host is lawfully in South Africa and able to host you.',
  },
  {
    id: 'hostAddress', cat: 'Accommodation & South African host', weight: 'required', appliesIf: (a) => a.hasHost,
    label: "Host's proof of address (recent utility bill or lease)",
    tip: "Confirms where you'll actually be staying.",
  },
  {
    id: 'hostAffidavit', cat: 'Accommodation & South African host', weight: 'required',
    appliesIf: (a) => a.hasHost && a.hostFunding,
    label: "Host's affidavit of undertaking (sworn before a Commissioner of Oaths)",
    tip: 'A South Africa-specific requirement: your host formally declares, in an affidavit, that they will be responsible for your maintenance and expenses during your stay if this is approved.',
  },
  {
    id: 'hostFinance', cat: 'Accommodation & South African host', weight: 'required',
    appliesIf: (a) => a.hasHost && a.hostFunding,
    label: "Host's bank statement or employment letter",
    tip: 'Needed alongside the affidavit above whenever your host is covering some or all of your costs.',
  },
  {
    id: 'hotelBooking', cat: 'Accommodation & South African host', weight: 'required', appliesIf: (a) => !a.hasHost,
    label: 'Hotel / accommodation booking confirmation',
    tip: "A reservation hold is usually enough - doesn't need to be prepaid.",
  },

  // Travel details
  {
    id: 'yellowFeverCert', cat: 'Travel details', weight: 'required',
    label: 'Yellow fever vaccination certificate',
    tip: 'South Africa requires this from travellers arriving from or transiting a yellow-fever-endemic country - which includes Nigeria. Carry your International Certificate of Vaccination or Prophylaxis; without it you can be refused entry even with a valid visa.',
  },
  {
    id: 'flightItinerary', cat: 'Travel details', weight: 'required',
    label: 'Flight itinerary / reservation (round-trip)',
    tip: "A reservation hold showing your planned dates is usually enough - you generally don't need a fully paid ticket before the visa is approved.",
  },
  {
    id: 'returnEvidence', cat: 'Travel details', weight: 'required',
    label: 'Evidence of return or onward travel',
    tip: 'Shows the reviewer you plan to leave South Africa at the end of your visit.',
  },
  {
    id: 'zaItinerary', cat: 'Travel details', weight: 'required',
    label: 'Day-by-day itinerary of places you plan to visit in South Africa',
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
    tip: 'Not always mandatory for a South Africa visitor visa the way it is for a Schengen visa, but strongly recommended - confirm with your specific mission whether medical cover is required for your case.',
  },
  {
    id: 'coverLetter', cat: 'Travel details', weight: 'recommended',
    label: 'Letter of Explanation / cover letter',
    tip: 'A short letter in your own words covering your purpose of visit, your itinerary, and your specific reasons for returning home (job, family, property).',
  },

  // Purpose-specific
  {
    id: 'bizLetterPair', cat: 'Purpose-specific', weight: 'required', appliesIf: (a) => a.purpose === 'business',
    label: "Letters from your Nigerian employer and the South African company you're visiting",
    tip: 'Should detail the business relationship and the purpose of your meetings. If you\'re also ticked as employed, this doesn\'t have to be a second, separate letter.',
  },
  {
    id: 'confInvite', cat: 'Purpose-specific', weight: 'required', appliesIf: (a) => a.purpose === 'conference',
    label: 'Letter of invitation from the conference/event organiser',
    tip: 'Plus your registration confirmation if you have one.',
  },
  {
    id: 'medLetter', cat: 'Purpose-specific', weight: 'required', appliesIf: (a) => a.purpose === 'medical',
    label: 'Letter from the South African medical practitioner/clinic',
    tip: 'Diagnosis, proposed treatment, estimated cost and expected duration - South Africa is a common medical-tourism destination for Nigerian applicants, and reviewers expect this to be specific.',
  },
  {
    id: 'medFunds', cat: 'Purpose-specific', weight: 'required', appliesIf: (a) => a.purpose === 'medical',
    label: 'Proof of funds to cover the full cost of treatment',
    tip: 'On top of your general financial evidence above.',
  },
  {
    id: 'familyProof', cat: 'Purpose-specific', weight: 'required', appliesIf: (a) => a.purpose === 'family',
    label: "Proof of relationship to the family you're visiting",
    tip: 'Birth/marriage certificates or similar linking you to your South Africa-based family.',
  },
  {
    id: 'weddingInvite', cat: 'Purpose-specific', weight: 'required', appliesIf: (a) => a.purpose === 'wedding',
    label: 'Wedding appointment confirmation or invitation',
    tip: 'Confirms the event you are attending and the date.',
  },
  {
    id: 'academicLetters', cat: 'Purpose-specific', weight: 'required', appliesIf: (a) => a.purpose === 'academic',
    label: 'Letters from your employer and the South African host institution',
    tip: "Required for an academic visit/research stay - a visitor's visa only covers up to 90 days, so check whether a study visa is needed instead if it runs longer.",
  },
  {
    id: 'trainingProof', cat: 'Purpose-specific', weight: 'required', appliesIf: (a) => a.purpose === 'training',
    label: 'Proof of paid training / course enrolment',
    tip: 'Invoice/payment confirmation, course syllabus, and a letter from the South African training provider confirming your enrolment and dates.',
  },

  // Children
  {
    id: 'birthCert', cat: 'If a child is travelling', weight: 'recommended', appliesIf: (a) => a.hasChild,
    label: 'Full/unabridged birth certificate showing both parents',
    tip: "South Africa's rules on this have changed more than once in recent years - foreign children are generally no longer strictly required to carry one if accompanied by a parent and the passport lists parent details, but Home Affairs has historically still recommended carrying it. Given the back-and-forth, bring it if you can rather than relying on the exemption.",
  },
  {
    id: 'consentLetter', cat: 'If a child is travelling', weight: 'required', appliesIf: (a) => a.hasChild,
    label: 'Notarised consent affidavit from the non-travelling parent(s)/guardian',
    tip: "Needed if the child is travelling with only one parent, or with neither - sworn before a Commissioner of Oaths, plus a copy of that parent's passport data page.",
  },
  {
    id: 'parentsPassports', cat: 'If a child is travelling', weight: 'required', appliesIf: (a) => a.hasChild,
    label: "Certified copies of both parents' passport data pages",
  },

  // Visa history
  {
    id: 'refusalDocs', cat: 'Visa history', weight: 'required', appliesIf: (a) => a.hasRefusal,
    label: 'Previous visa refusal documentation (South Africa or elsewhere)',
    tip: "The refusal letter(s) for each prior refusal you listed above, ideally alongside a short cover-letter explanation of what's changed since.",
  },

  // Translations
  {
    id: 'translations', cat: 'Translations', weight: 'required', appliesIf: (a) => a.translation,
    label: 'Certified English translations of any other-language documents',
    tip: "Must include the translator's certification plus a copy of the original document - DHA requires certified translations for anything not already in English.",
  },
];
