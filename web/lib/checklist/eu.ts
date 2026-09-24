// Ported from index.html's CHECKLIST_EU / CAT_ORDER_EU (as of the September 2026 index.html).
// Item text, tips, and conditional appliesIf logic are carried over verbatim/faithfully — same
// pattern as uk.ts (Phase 2). Phase 4a of task #244 ports the remaining 7 countries.
import { Answers, ChecklistItem } from './uk';

export const CAT_ORDER_EU = [
  'Identity & application',
  'Financial evidence',
  'Ties to Nigeria',
  'Accommodation & Schengen host',
  'Travel details',
  'Purpose-specific',
  'If a child is travelling',
  'Visa history',
  'Translations',
];

export const CHECKLIST_EU: ChecklistItem[] = [
  // Identity & application
  {
    id: 'passport', cat: 'Identity & application', weight: 'required',
    label: 'Valid passport (covers your whole trip)',
    tip: 'Must be valid for at least 3 months beyond your planned departure FROM the Schengen area (not your return-home date), issued within the last 10 years, with at least 2 blank pages - though some consulates ask for 3.',
  },
  {
    id: 'photo', cat: 'Identity & application', weight: 'required',
    label: 'Biometric passport-style photo (35×45mm, white background)',
    tip: "Taken within the last 6 months, plain white/light background, face covering roughly 70–80% of the frame - check your specific consulate/VFS centre's exact spec before your appointment.",
  },
  {
    id: 'applicationForm', cat: 'Identity & application', weight: 'required', appliesIf: (a) => a.readyToSubmit,
    label: 'Completed & signed Schengen short-stay (Type C) application form',
    tip: "Use the harmonised EU application form for the specific consulate you're applying to.",
  },
  {
    id: 'feePaid', cat: 'Identity & application', weight: 'required', appliesIf: (a) => a.readyToSubmit,
    label: 'Visa fee payment confirmation',
    tip: 'The EU-wide visa fee is €90 for adults and €45 for children aged 6–11 (free under 6) as of June 2024. Most Visa Application Centres in Nigeria also charge a separate service fee in naira on top - confirm the current amount with your specific consulate.',
  },
  {
    id: 'biometric', cat: 'Identity & application', weight: 'required', appliesIf: (a) => a.readyToSubmit,
    label: 'Biometric appointment booked/attended (VFS Global / TLScontact Nigeria)',
    tip: "Fingerprints and a digital photo, required for applicants aged 12+. If you've given Schengen biometrics within the last 59 months, in-person re-enrolment may be waived. France uses TLScontact rather than VFS Global.",
  },
  {
    id: 'oldPassports', cat: 'Identity & application', weight: 'recommended',
    label: 'Previous passport(s) showing earlier travel history',
    tip: "Evidence you've travelled abroad and returned home before strengthens your application - bio page(s) of any previous passport(s).",
  },
  {
    id: 'oldVisas', cat: 'Identity & application', weight: 'recommended',
    label: 'Previous visa(s) / entry stamps from earlier travel',
    tip: 'A track record of visiting other countries and returning home on time is one of the strongest signals a consulate looks for - attach photos of past visa pages and entry/exit stamps.',
  },

  // Financial evidence
  {
    id: 'bankStatements', cat: 'Financial evidence', weight: 'required',
    label: 'Personal bank statements — last 6 months (up to 3 files)',
    tip: "Sources disagree on the exact minimum - some consulates accept 3 months, but 6 months is the safer figure and is explicitly required on Italy's own published checklist. Show a healthy, explainable balance built up steadily, not a lump sum deposited right before applying.",
  },
  {
    id: 'bankLetter', cat: 'Financial evidence', weight: 'recommended',
    label: 'Bank reference / introduction letter',
    tip: 'A short letter from your bank confirming your account status.',
  },
  {
    id: 'payslips', cat: 'Financial evidence', weight: 'required', appliesIf: (a) => a.employed,
    label: 'Payslips — last 3–4 months',
    tip: 'Matches the salary stated in your employment letter and the regular credit on your bank statement - reviewers cross-check all three.',
  },
  {
    id: 'taxDocs', cat: 'Financial evidence', weight: 'recommended', appliesIf: (a) => !a.selfEmployed,
    label: 'Tax clearance certificate / TIN documents',
    tip: 'Extra proof of a stable financial and legal footing in Nigeria.',
  },
  {
    id: 'euTaxClearance', cat: 'Financial evidence', weight: 'required', appliesIf: (a) => a.selfEmployed,
    label: 'FIRS tax clearance certificate',
    tip: 'Specifically flagged on published Schengen consulate checklists (e.g. Italy) for self-employed/business-owner applicants, alongside your CAC documents below.',
  },
  {
    id: 'forexProof', cat: 'Financial evidence', weight: 'recommended',
    label: 'Proof of foreign currency savings/income (optional)',
    tip: 'If you added foreign currency savings in the calculator above, a supporting document makes that figure easier for a reviewer to trust than a typed-in number alone.',
  },
  {
    id: 'bizFinance', cat: 'Financial evidence', weight: 'required', appliesIf: (a) => a.selfEmployed,
    label: 'Business bank statements',
    tip: 'Upload 6 months of BUSINESS bank statements showing you drawing a personal salary from the business, not just money sitting in the business account.',
  },
  {
    id: 'cacDocs', cat: 'Financial evidence', weight: 'required', appliesIf: (a) => a.selfEmployed,
    label: 'CAC registration (business registration documents)',
    tip: 'Your CAC certificate and other business registration documents - shows the business exists and is active.',
  },
  {
    id: 'spouseSponsorFinance', cat: 'Financial evidence', weight: 'required',
    appliesIf: (a) => a.married && a.spouseSponsoring,
    label: "Spouse's financial documents + signed sponsor letter",
    tip: 'Since your spouse is sponsoring this trip: their bank statements for the last 6 months, plus a signed letter from them confirming they\'re funding your visit.',
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
    label: 'School/university admission or enrolment letter + no-objection letter',
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
    tip: "A spouse, children, or other dependants relying on you in Nigeria is a strong reason a consulate expects you to return. Nigeria's Schengen refusal rate has been among the highest globally in recent years, and doubts about intention to return are a common reason cited.",
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

  // Accommodation & Schengen host
  {
    id: 'invitationLetter', cat: 'Accommodation & Schengen host', weight: 'required', appliesIf: (a) => a.hasHost,
    label: 'Invitation letter / proof-of-accommodation attestation from your host',
    tip: "Should include the host's name, address, immigration status, your relationship, and exact dates of your stay. Some consulates (France, for example) require this on an official form.",
  },
  {
    id: 'hostStatus', cat: 'Accommodation & Schengen host', weight: 'required', appliesIf: (a) => a.hasHost,
    label: "Copy of host's passport / residence permit / visa",
    tip: 'Confirms your host is lawfully resident and able to host you.',
  },
  {
    id: 'hostAddress', cat: 'Accommodation & Schengen host', weight: 'required', appliesIf: (a) => a.hasHost,
    label: "Host's proof of address (recent utility bill)",
    tip: "Confirms where you'll actually be staying.",
  },
  {
    id: 'hostFinance', cat: 'Accommodation & Schengen host', weight: 'required',
    appliesIf: (a) => a.hasHost && a.hostFunding,
    label: "Host's bank statement or employment letter",
    tip: 'Needed if your host is covering some or all of your costs - some consulates also accept a formal bank guarantee from the host instead.',
  },
  {
    id: 'hotelBooking', cat: 'Accommodation & Schengen host', weight: 'required', appliesIf: (a) => !a.hasHost,
    label: 'Hotel / accommodation booking confirmation for every night of your trip',
    tip: "Schengen consulates generally expect accommodation covering EVERY night of your stay, not just the first few - a reservation hold is usually enough, it doesn't need to be prepaid.",
  },

  // Travel details
  {
    id: 'insurance', cat: 'Travel details', weight: 'required',
    label: 'Travel medical insurance — minimum €30,000 coverage, valid across all Schengen states',
    tip: 'Unlike UK or Canada visitor visas, this is a MANDATORY document for a Schengen visa, not optional. Must cover the full length of your trip, be valid in every Schengen country you might visit, and include repatriation cover.',
  },
  {
    id: 'flightItinerary', cat: 'Travel details', weight: 'required',
    label: 'Flight itinerary / reservation (round-trip)',
    tip: "A reservation/hold showing your planned dates is generally accepted - a fully paid ticket usually isn't required before the visa is approved.",
  },
  {
    id: 'returnEvidence', cat: 'Travel details', weight: 'required',
    label: 'Evidence of return or onward travel',
    tip: 'Shows the consulate you plan to leave the Schengen area at the end of your visit.',
  },
  {
    id: 'euItinerary', cat: 'Travel details', weight: 'required',
    label: 'Day-by-day travel itinerary for your trip',
    tip: 'Named cities/countries and roughly what you\'ll do each day - this matters even more for a Schengen application since your itinerary also determines which consulate you must apply to. A simple typed list is fine.',
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
    id: 'coverLetter', cat: 'Travel details', weight: 'recommended',
    label: 'Letter of Explanation / cover letter',
    tip: 'A short letter in your own words covering your purpose of visit, your itinerary, and your specific reasons for returning home (job, family, property). Doubts about genuine intention to return are consistently among the most-cited reasons for Schengen refusals for Nigerian applicants.',
  },

  // Purpose-specific
  {
    id: 'bizLetterPair', cat: 'Purpose-specific', weight: 'required', appliesIf: (a) => a.purpose === 'business',
    label: "Letters from your Nigerian employer and the company you're visiting in the Schengen area",
    tip: 'Should detail the business relationship and the purpose of your meetings. If you\'re also ticked as employed, your existing employment letter can simply be adapted to also cover this.',
  },
  {
    id: 'confInvite', cat: 'Purpose-specific', weight: 'required', appliesIf: (a) => a.purpose === 'conference',
    label: 'Letter of invitation from the conference/event organiser',
    tip: 'Plus your registration confirmation if you have one.',
  },
  {
    id: 'medLetter', cat: 'Purpose-specific', weight: 'required', appliesIf: (a) => a.purpose === 'medical',
    label: 'Letter from the treating medical practitioner/clinic',
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
    tip: 'Birth/marriage certificates or similar linking you to your family in the Schengen area.',
  },
  {
    id: 'weddingInvite', cat: 'Purpose-specific', weight: 'required', appliesIf: (a) => a.purpose === 'wedding',
    label: 'Wedding/registrar appointment confirmation or invitation',
    tip: 'Confirms the event you are attending and the date.',
  },
  {
    id: 'academicLetters', cat: 'Purpose-specific', weight: 'required', appliesIf: (a) => a.purpose === 'academic',
    label: 'Letters from your employer and the host institution',
    tip: "A Schengen short-stay visa only covers up to 90 days in any 180-day period - if your academic visit runs longer, you'll likely need a national (long-stay) visa from the specific country instead.",
  },
  {
    id: 'trainingProof', cat: 'Purpose-specific', weight: 'required', appliesIf: (a) => a.purpose === 'training',
    label: 'Proof of paid training / course enrolment',
    tip: 'Invoice/payment confirmation, course syllabus, and a letter from the training provider confirming your enrolment and dates - check whether the course runs within the 90-day short-stay limit.',
  },

  // Children
  {
    id: 'birthCert', cat: 'If a child is travelling', weight: 'required', appliesIf: (a) => a.hasChild,
    label: 'Full birth certificate showing both parents',
  },
  {
    id: 'consentLetter', cat: 'If a child is travelling', weight: 'required', appliesIf: (a) => a.hasChild,
    label: 'Consent letter/authorisation from the non-travelling parent(s)/guardian',
    tip: "Many consulates expect this notarised, plus a copy of that parent's passport data page.",
  },
  {
    id: 'parentsPassports', cat: 'If a child is travelling', weight: 'required', appliesIf: (a) => a.hasChild,
    label: "Copies of both parents' passport data pages",
  },

  // Visa history
  {
    id: 'refusalDocs', cat: 'Visa history', weight: 'required', appliesIf: (a) => a.hasRefusal,
    label: 'Previous visa refusal documentation',
    tip: "The refusal letter(s) for each prior refusal you listed above, ideally alongside a short cover-letter explanation of what's changed since.",
  },

  // Translations
  {
    id: 'translations', cat: 'Translations', weight: 'required', appliesIf: (a) => a.translation,
    label: "Certified translations of any documents not already in the consulate's language",
    tip: "Which language is accepted depends on the specific consulate you're applying to - commonly English, or the official language of that country (French for France, German for Germany, Italian for Italy, Dutch for the Netherlands). Must include the translator's confirmation of accuracy, date, full name, signature and contact details.",
  },
];
