// Name extraction, ported from index.html (~lines 11650-11740, 12107-12369).

import type { NameCandidate, ParsedTxn, RecurringPaymentToPersonResult } from './types';
// isReversalNarration / isNonIncomeChargeNarration live in classify.ts, which itself imports several
// name-extraction helpers from this module. Both sides only call into the other from inside function
// bodies (never at module-init time), so this circular import is safe with ES module live bindings.
import { isReversalNarration, isNonIncomeChargeNarration } from './classify';

// Different bank apps truncate/abbreviate the "Limited" company suffix differently in their narration
// text — "LTD", "LTD.", "Limited", or a mid-word truncation like "Limite" (as reported: "BRIGHT HOMES
// CLEANING SOLUTIONS LIMITE" instead of "...LIMITED") when a fixed-width narration field just gets cut
// off. Rather than hardcoding every specific truncation seen so far, this matches ANY word that starts
// with "LIMIT" (LIMIT, LIMITE, LIMITED, and any other bank's own variant) — used everywhere "LTD"/
// "LIMITED" are already treated as a company-suffix stopword/keyword, so a truncated suffix is treated
// exactly the same as the full word would be.
export const LIMITED_SUFFIX_RE = /^LIMIT[A-Z]*$/;

// Best-effort: pull a likely sender name (person or company) out of the narration of the credits that
// make up the "stable income" figure above, and see which name recurs across the most distinct months —
// the same way a human reviewer notices "oh, it's always from the same employer/company" scanning by eye.
// Narration text is messy bank shorthand, so this is approximate and clearly labeled as such in the UI.
export const BANK_NARRATION_STOPWORDS = [
  'NIP', 'TRF', 'FRM', 'FROM', 'CR', 'DR', 'MOB', 'STLB', 'CIP', 'ONEBANK', 'BANKNIP', 'BANK',
  'TRANSFER', 'VALUE', 'DATE', 'SALARY', 'PAYMENT', 'GTB', 'GTBANK', 'OPAY', 'FBN', 'UBA', 'ZENITH', 'ACCESS', 'FIRST',
  'STANBIC', 'FIDELITY', 'WEMA', 'POLARIS', 'UNION', 'STERLING', 'KEYSTONE', 'PROVIDUS', 'MONIEPOINT', 'PALMPAY',
  'KUDA', 'VAT', 'CHARGE', 'STAMP', 'DUTY', 'FGN', 'NGN', 'TO', 'THE', 'FOR', 'AND', 'LTD', 'LIMITED', 'PLC', 'ACCOUNT',
  'ALLOWANCE', 'DRAWING', 'REMUNERATION', 'DIRECTOR', 'OPENING', 'BALANCE', 'WITHDRAWAL', 'DEPOSIT', 'POS', 'ATM',
  'USSD', 'MC', 'LOC', 'PRCH', 'REF', 'TXN', 'RVSL', 'REVERSAL', 'UPFRONT', 'INWARD', 'OUTWARD',
  // Generic transfer-notification / channel prefixes seen on real Nigerian bank narrations (e.g. "TNF-",
  // "CASH DEP:", "REV/MOB/UTO/") — without these, the SAME sender ends up split into multiple groups
  // purely because one narration line happened to carry a prefix and another didn't.
  'TNF', 'NFT', 'NIBSS', 'LASG', 'PAYRO', 'ACTIVE', 'REV', 'UTO', 'CASH', 'DEP', 'CASHDEP', 'CASHDEPOSIT',
  // Real-world channel/processor/aggregator codes off an actual statement (e.g. "NIP/ROLEZ/BRIGHT
  // HOMES.../February Salary") — without these, a code like "ROLEZ" gets swept into the extracted
  // sender name itself, splitting what should be one recognised sender into a differently-named,
  // unmerged group. See BANK_NARRATION_GLOSSARY (columns/classify docs) for what each of these means.
  'ETI', 'VFD', 'WBP', 'ROLEZ', 'ROLEX', 'STBC', 'ABN', 'FD', 'FDP', 'ISW', 'QTELLER', 'PBNL', 'ZIB', 'NXG', 'AFB',
  // Real-data finding, off a real First Bank statement: recurring monthly salary narrations there read
  // "NEFT FROM:SAL FEB 26 LNSC", "...SAL MAR 26 LNSC", "...SAL APRIL 26 LNSC" — the SAME payroll
  // processor ("LNSC") every month, but with the month name embedded right in the middle of the
  // narration. Without these, that one word makes each month's salary extract as a DIFFERENT candidate
  // name, so an obviously-recurring salary sender never accumulates enough of the SAME name to be
  // recognised as "recurring" at all.
  'JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'SEPT', 'OCT', 'NOV', 'DEC',
  'JANUARY', 'FEBRUARY', 'MARCH', 'APRIL', 'JUNE', 'JULY', 'AUGUST', 'SEPTEMBER', 'OCTOBER', 'NOVEMBER', 'DECEMBER',
  // Same statement, a second finding: loan-servicing system narrations ("PDC:LOAN DISBURAL...FMOBAMPC",
  // "PDC:MGMT_FEE...", "PDC:INTEREST_RATE...") are batch/product codes, not a person or company's name.
  'PDC', 'LOAN', 'DISBURSAL', 'DISBURAL', 'REPAYMENT', 'MGMT', 'MANAGEMENT', 'INSURE', 'INSURANCE', 'INTEREST',
  'RATE', 'FEE', 'FMOBAMPC',
  // Same statement, a third finding: "CPWInward:<ref>/<name>..." — a wallet/collections-channel
  // inward-transfer code, not a sender's name.
  'CPWINWARD', 'CPW',
  // Real example: "Ogochukwu Odum Small Hbd Token" — "HBD" and "TOKEN" are narration filler (an
  // informal birthday-gift narration, canonicalized to "Birthday" as a REASON), not part of the
  // sender's actual name.
  'HBD', 'TOKEN',
  // User-reported screenshot, off a real statement with structured field-label narrations (e.g.
  // "MPTJ/CG/PAYREF:.../SENDER:ADISA BILIKIS ABIOLA/REMARK:OK") — "SENDER" and "REMARK" are literal
  // field labels the bank prints ahead of the actual name/note, not part of anyone's name, and
  // "MPTJ"/"PAYREF"/"CG"/"WVV"/"ZMO"/"ONB" are channel/processor/transaction-type codes. "OK" is this
  // bank's placeholder for "no remark given".
  'MPTJ', 'PAYREF', 'SENDER', 'REMARK', 'CG', 'WVV', 'ZMO', 'ONB', 'OK',
  // Later round of the same test-user feedback, same statement family — one row still came through as
  // "Ifo Agboola Mary Oluwafunmilayo" ("IFO" is a new channel/processor code).
  'IFO',
  // Same statement family, another row: "TRF BOO XPEDITE GLOBAL - CONCEPT LTD IFO …" was extracting as
  // "Boo Xpedite Global Concept" — "BOO" is yet another channel/processor code.
  'BOO',
  // Same statement, confirmed by the applicant directly: the account's real name is "Agboola Mary
  // Oluwafunmilayo" — one row's narration tacked "mint" onto the end of it, an account-product/nickname
  // label some banks append, not part of the person's actual name.
  'MINT',
  // Real Wema/ALAT statement finding: inbound interbank credits there sometimes narrate as
  // "eTZ:<sender name>-<note>" — "ETZ" is eTranzact, an interbank real-time-transfer channel/processor,
  // not part of the sender's name.
  'ETZ',
];

// Trims narration junk off the RIGHT end of an already-built name run, but only when it's confident
// enough to do so safely: the run must open with two consecutive recognised name words (a plausible
// "firstname surname"), AND the word being trimmed must come after at least one short (1-2 letter)
// connector — the same reference-code-fragment pattern already described above ("Fg Ij"). That second
// condition is deliberate: a real narration where an unrecognised word follows the name DIRECTLY (no
// connector in between) is left completely untouched, so this never disturbs the existing
// "similar-but-different sender" duplicate-prompt handling elsewhere, which relies on exactly that kind
// of trailing text to tell two look-alike senders apart.
// User feedback: rather than only reacting to each new piece of narration junk one word at a time, also
// check candidate names against a bundled list of common Yoruba, Igbo, Hausa, English and German first
// names and surnames — so a run like "Chidinma Okeke Fg Ij Support" can be recognised as "a real name,
// then reference-code noise, then narration text" and trimmed back to just the name automatically,
// without needing "SUPPORT" specifically stopworded. Deliberately NOT exhaustive and NOT used to
// reject/flag a name as invalid — Nigeria has far more names than any bundled list can cover, and a real
// sender's name that just isn't on this list should never be treated as suspicious. This is only ever a
// positive signal ("this looks like a real name"), used to decide where a name run should STOP, never to
// decide a run isn't a name at all. Deliberately excludes common Nigerian "virtue names" that double as
// everyday words (Grace, Gift, Faith, Praise, Blessing, Comfort, Precious, Victory, Mercy, Joy, Peace,
// Charity, Success) — those are exactly the words that also show up as narration REASON text ("gift for
// birthday"), so recognising them here would risk trimming a genuine name just as easily as it trims
// real junk; safer to leave those cases to a manual "Fix name" correction than to guess wrong either way.
export const COMMON_PERSONAL_NAME_WORDS = [
  // Yoruba
  'ADEBAYO', 'ADEWALE', 'ADEYEMI', 'ADEKUNLE', 'OLUWASEUN', 'DAMILOLA', 'AYODELE', 'AYOMIDE', 'FOLAKE',
  'FUNMILAYO', 'BUKOLA', 'BIMBO', 'BISI', 'KEMI', 'KEHINDE', 'TAIWO', 'YETUNDE', 'YEWANDE', 'FEYISAYO', 'IYABO',
  'MOTUNRAYO', 'OLAMIDE', 'SEGUN', 'SOLA', 'TUNDE', 'WALE', 'YINKA', 'FEMI', 'GBENGA', 'KUNLE', 'NIYI', 'ROTIMI',
  'SEYI', 'BOLA', 'BOLAJI', 'DELE', 'OPEYEMI', 'TOYIN', 'TITILAYO', 'ABIMBOLA', 'ADEBISI', 'ADEOLA', 'ADERONKE',
  'ADETUTU', 'AFOLABI', 'AKIN', 'AKINTUNDE', 'BABATUNDE', 'BOSEDE', 'EBUN', 'ENIOLA', 'FOLASHADE', 'GANIYU',
  'IBUKUN', 'IDOWU', 'IGE', 'KAYODE', 'LEKAN', 'MODUPE', 'MORENIKE', 'NIKE', 'OLABISI', 'OLAIDE', 'OLAJUMOKE',
  'OLAKUNLE', 'OLANREWAJU', 'OLAWALE', 'OLAYINKA', 'OLUBUNMI', 'OLUWAFEMI', 'OLUWAKEMI', 'OLUWATOSIN',
  'OMOTOLA', 'OMOLARA', 'OYINDAMOLA', 'REMI', 'RONKE', 'SADE', 'SIMISOLA', 'SUBOMI', 'SUNKANMI', 'TAYO',
  'TEMIDAYO', 'TEMITAYO', 'TEMITOPE', 'TOMIWA', 'TOYOSI', 'WUNMI', 'YEMISI', 'ZAINAB', 'BALOGUN', 'OGUNDELE',
  'OYELARAN', 'FASHINA', 'FAGBEMI', 'ALABI', 'AKINYEMI', 'AKINTOLA', 'OGUNLEYE', 'OGUNBIYI', 'SANNI', 'OJO',
  // Igbo
  'CHIDINMA', 'CHIDIEBERE', 'CHIDI', 'CHIOMA', 'CHIAMAKA', 'CHINWE', 'CHINEDU', 'CHUKWUEMEKA', 'CHUKWUDI',
  'EBELE', 'EBUBECHUKWU', 'EMEKA', 'EZINNE', 'IFEOMA', 'IFEANYI', 'IJEOMA', 'IKECHUKWU', 'KELECHI',
  'KOSISOCHUKWU', 'NDIDI', 'NGOZI', 'NKECHI', 'NKIRUKA', 'NNAMDI', 'NNEKA', 'NONSO', 'OBIAGELI', 'OBINNA',
  'OGECHI', 'OKECHUKWU', 'ONYEKACHI', 'ONYINYE', 'OLUCHI', 'SOMTOCHUKWU', 'UGOCHI', 'UGONNA', 'UZOAMAKA',
  'UCHENNA', 'ADAEZE', 'ADAOBI', 'AMARA', 'AMARACHI', 'CHUKWUMA', 'CHIKA', 'CHIZOBA', 'CHINYERE',
  'CHUKWUEBUKA', 'EKENE', 'NKEMDIRIM', 'SOMTO', 'TOCHUKWU', 'TOBENNA', 'CHUKWUKA', 'OKEKE', 'OKAFOR', 'EZE',
  'NWOSU', 'NWACHUKWU', 'OBI', 'CHUKWU', 'OKORO', 'OKONKWO', 'NWANKWO', 'IGWE', 'ONYEKA',
  // Hausa
  'AMINU', 'AISHA', 'AMINA', 'BELLO', 'FATIMA', 'GARBA', 'HAUWA', 'HASSAN', 'HUSSAINI', 'IBRAHIM', 'ISAH',
  'KABIRU', 'LAWAL', 'MOHAMMED', 'MUHAMMAD', 'MUSA', 'NAFISA', 'RABIU', 'RUKAYYA', 'SADIQ', 'SANI', 'SADIYA',
  'SULEIMAN', 'TANKO', 'UMAR', 'USMAN', 'YAKUBU', 'YUSUF', 'ZARA', 'HABIBA', 'HALIMA', 'MARYAM', 'SAFIYA',
  'FATIMAH', 'IDRIS', 'NUHU', 'SHEHU', 'ABDULLAHI', 'ABUBAKAR', 'ADAMU', 'DANJUMA', 'SULE', 'ALIYU',
  // English / general
  'JOHN', 'JAMES', 'MICHAEL', 'WILLIAM', 'DAVID', 'RICHARD', 'JOSEPH', 'THOMAS', 'CHARLES', 'CHRISTOPHER',
  'DANIEL', 'MATTHEW', 'ANTHONY', 'MARK', 'PAUL', 'STEVEN', 'ANDREW', 'KENNETH', 'GEORGE', 'EDWARD', 'MARY',
  'PATRICIA', 'JENNIFER', 'LINDA', 'ELIZABETH', 'BARBARA', 'SUSAN', 'JESSICA', 'SARAH', 'KAREN', 'EMMANUEL',
  'SAMUEL', 'PETER', 'STEPHEN', 'PHILIP', 'SIMON', 'RUTH', 'ESTHER', 'RACHEL', 'REBECCA', 'DEBORAH', 'HANNAH',
  'NAOMI', 'SMITH', 'JOHNSON', 'WILLIAMS', 'BROWN', 'JONES', 'MILLER', 'DAVIS', 'WILSON', 'TAYLOR', 'ANDERSON',
  'MOORE', 'JACKSON', 'WHITE', 'HARRIS', 'MARTIN', 'THOMPSON', 'ROBINSON', 'CLARK', 'LEWIS', 'WALKER', 'HALL',
  'YOUNG', 'KING', 'WRIGHT', 'BASSEY', 'EKPO', 'ETIM', 'EFFIONG', 'UMOH', 'UDO', 'EKONG', 'INYANG', 'AKPAN',
  // German
  'HEINRICH', 'WILHELM', 'FRIEDRICH', 'KLAUS', 'HANS', 'OTTO', 'KARL', 'WERNER', 'GERHARD', 'WOLFGANG',
  'URSULA', 'INGRID', 'GERTRUDE', 'HELGA', 'BRIGITTE', 'MONIKA', 'RENATE', 'ERIKA', 'SCHMIDT', 'MULLER',
  'WEBER', 'SCHNEIDER', 'FISCHER', 'MEYER', 'WAGNER', 'BECKER', 'HOFFMANN',
];

// User feedback: rather than only reacting to each new piece of narration junk one word at a time,
// also check candidate names against a bundled list of common Yoruba/Igbo/Hausa/English/German
// names/surnames — see trimTrailingNonNameWords below for how it's used.
// Best-effort glossary of the channel/processor/bank shorthand commonly seen in Nigerian bank
// statement narrations — deliberately only the codes we're actually confident about (a bank's own
// internal-only codes, like "STLB", are left undecoded rather than guessed at), surfaced via
// decodeNarration()/renderNarrationDecodeHtml() (UI rendering is out of scope for this pure-logic port).
export const BANK_NARRATION_GLOSSARY: Record<string, string> = {
  NIP: "NIBSS Instant Payment - Nigeria's real-time interbank transfer system, run by NIBSS (Nigeria Inter-Bank Settlement System).",
  TRF: 'Transfer.',
  FT: 'Funds transfer.',
  CIP: 'A credit (inflow) transaction on this account.',
  CR: 'Credit - money coming in.',
  DR: 'Debit - money going out.',
  FRM: 'From.',
  FROM: 'From.',
  ETI: 'Ecobank Transnational Incorporated - the Ecobank group identifier.',
  RVSL: 'Reversal - money returned after a failed/reversed transaction, not new income.',
  REVERSAL: 'Reversal - money returned after a failed/reversed transaction, not new income.',
  VFD: 'VFD Microfinance Bank.',
  WBP: 'Wema Bank.',
  ROLEZ: "Moniepoint MFB (a payment-channel code, not the sender's own bank name).",
  ROLEX: "Moniepoint MFB (a payment-channel code, not the sender's own bank name).",
  STBC: 'Stanbic IBTC.',
  ABN: 'Access Bank.',
  FD: 'Fidelity Bank.',
  FDP: 'Fidelity Bank.',
  ISW: "Interswitch - Nigeria's electronic payments switch/processor.",
  QTELLER: "Quickteller - Interswitch's consumer payments platform (transfers, bills, airtime).",
  MOB: 'Mobile banking channel.',
  POS: 'Point-of-sale (card) transaction.',
  ATM: 'ATM transaction.',
  USSD: 'USSD (phone short-code) banking channel.',
  GTB: 'Guaranty Trust Bank.',
  GTBANK: 'Guaranty Trust Bank.',
  FBN: 'First Bank of Nigeria.',
  UBA: 'United Bank for Africa.',
  OPAY: 'OPay (mobile money).',
  PALMPAY: 'PalmPay (mobile money).',
  KUDA: 'Kuda Bank.',
  MONIEPOINT: 'Moniepoint MFB.',
  PROVIDUS: 'Providus Bank.',
  STANBIC: 'Stanbic IBTC.',
  ONEBANK: 'A bank-branded digital transfer product name (varies by bank), not a separate institution.',
  MPTJ: "Mobile-payment transaction channel code (varies by bank), not the sender's name.",
  PAYREF: 'Payment reference - a field label, followed by that transaction\'s reference code.',
  SENDER: "A field label - the sender's name follows it in the narration.",
  REMARK: 'A field label - an optional note from the sender follows it (often just "OK" when none was given).',
  CG: 'Bank-internal channel/processor code.',
  ETZ: 'eTranzact - an interbank real-time-transfer channel/processor, similar to NIP.',
  WVV: 'Bank-internal channel/processor code.',
  ZMO: 'Bank-internal channel/processor code.',
  ONB: 'Online banking channel.',
};

export function trimTrailingNonNameWords(runWords: string[]): string[] {
  const realIdx: number[] = [];
  for (let i = 0; i < runWords.length; i++) {
    if (runWords[i].length >= 3) realIdx.push(i);
  }
  if (realIdx.length < 2) return runWords;
  const firstReal = runWords[realIdx[0]];
  const secondReal = runWords[realIdx[1]];
  if (COMMON_PERSONAL_NAME_WORDS.indexOf(firstReal) === -1 || COMMON_PERSONAL_NAME_WORDS.indexOf(secondReal) === -1) {
    return runWords; // doesn't open with a recognised "firstname surname" pair - leave alone (e.g. a company name)
  }
  let lastKeepIdx = realIdx[1];
  let sawConnectorSinceName = false;
  for (let j = realIdx[1] + 1; j < runWords.length; j++) {
    const w = runWords[j];
    if (w.length < 3) {
      lastKeepIdx = j;
      sawConnectorSinceName = true;
      continue;
    }
    if (COMMON_PERSONAL_NAME_WORDS.indexOf(w) !== -1) {
      lastKeepIdx = j; // another recognised name word (e.g. a middle name) - keep, doesn't affect the connector check
      continue;
    }
    if (sawConnectorSinceName) break; // unrecognised word AFTER reference-code noise - narration text, stop here
    lastKeepIdx = j; // unrecognised word with no connector seen yet - not confident enough to trim, keep as before
  }
  return runWords.slice(0, lastKeepIdx + 1);
}

export function decodeNarrationSegment(seg: string): { part: string; meaning: string } | null {
  const trimmed = (seg || '').trim();
  if (!trimmed) return null;
  const upper = trimmed.toUpperCase();
  if (BANK_NARRATION_GLOSSARY[upper]) return { part: trimmed, meaning: BANK_NARRATION_GLOSSARY[upper] };
  // Scan every word in the segment, not just the first — some best-effort text extractions leave a
  // date or other stray text stuck to the front of a segment (e.g. "2026 NIP" instead of a clean
  // "NIP" segment), and the code can be anywhere in that mix.
  const words = upper.split(/\s+/);
  const matchedMeanings: string[] = [];
  words.forEach((w) => {
    if (BANK_NARRATION_GLOSSARY[w] && matchedMeanings.indexOf(BANK_NARRATION_GLOSSARY[w]) === -1) {
      matchedMeanings.push(BANK_NARRATION_GLOSSARY[w]);
    }
  });
  if (matchedMeanings.length) {
    return {
      part: trimmed,
      meaning:
        matchedMeanings.join(' ') +
        (words.length > matchedMeanings.length ? ' The rest of this segment is additional detail added by the bank.' : ''),
    };
  }
  // A long unbroken run of letters/digits with no spaces reads as a transaction/reference number
  // rather than anything meaningful to decode.
  if (/^[A-Za-z0-9]{10,}$/.test(trimmed)) {
    return {
      part: trimmed,
      meaning:
        'Likely a transaction/reference number generated by the bank or payment processor - useful for tracing this payment if you ever need to query it, not something you typed.',
    };
  }
  return { part: trimmed, meaning: "Likely the sender's name, the beneficiary, or the reason given for this payment." };
}

// Bank narrations for a NIP/electronic transfer are commonly slash-delimited — split on "/" first if
// present, otherwise treat the whole narration as a single segment rather than guessing at some other
// delimiter.
export function decodeNarration(narration: string): { part: string; meaning: string }[] {
  if (!narration) return [];
  const segments = narration.indexOf('/') !== -1 ? narration.split('/') : [narration];
  return segments.map(decodeNarrationSegment).filter((x): x is { part: string; meaning: string } => !!x);
}

// Best-effort company-vs-personal classifier: a reviewer generally reads recurring income from a
// registered business as more stable/credible than payments from a personal account, so this is used to
// tailor the advice shown alongside the detected income source. Checked against the RAW narration text
// (not the filtered name run), since suffixes like "LTD"/"PLC" are deliberately stripped out of the name
// itself but are exactly the signal we need here.
export const COMPANY_KEYWORDS = [
  'LTD', 'LIMITED', 'PLC', 'LLC', 'ENTERPRISE', 'ENTERPRISES', 'VENTURES', 'VENTURE', 'GLOBAL',
  'SOLUTIONS', 'SOLUTION', 'SERVICES', 'SERVICE', 'NIG', 'NIGERIA', 'INTERNATIONAL', 'INTL', 'GROUP', 'COMPANY', 'CO',
  'COY', 'INDUSTRIES', 'INDUSTRY', 'HOLDINGS', 'HOLDING', 'CONSULT', 'CONSULTING', 'CONSULTANTS', 'TECHNOLOGIES',
  'TECHNOLOGY', 'TECH', 'RESOURCES', 'LOGISTICS', 'INVESTMENT', 'INVESTMENTS', 'CAPITAL', 'PROPERTIES', 'PROPERTY',
  'CONSTRUCTION', 'ENGINEERING', 'STORES', 'STORE', 'CONCEPT', 'CONCEPTS', 'INTEGRATED', 'ASSOCIATES', 'PARTNERS',
  'AGRO', 'FARMS', 'FARM', 'MULTI', 'EXCLUSIVE', 'NETWORK', 'NETWORKS', 'OUTLET', 'OUTLETS', 'MART', 'SUPERMARKET',
  'PHARMACY', 'PHARMACEUTICALS', 'CLINIC', 'HOSPITAL', 'SCHOOL', 'SCHOOLS', 'ACADEMY', 'MINISTRIES', 'MINISTRY',
  'CHURCH', 'FOUNDATION', 'INITIATIVE', 'ORGANIZATION', 'ORGANISATION', 'AGENCY', 'BUREAU', 'COMMISSION', 'EXCHANGE',
  'MICROFINANCE', 'SACCO', 'COOPERATIVE', 'CHAMBERS', 'CHAMBER', 'CLEANING', 'CLEANERS', 'CATERING', 'TRANSPORT',
  'TRANSPORTATION', 'HAULAGE', 'SECURITY', 'SUPPLIES', 'SUPPLY', 'TRADING', 'TRADERS', 'MERCHANDISE', 'FASHION',
  'DESIGNS', 'DESIGN', 'STUDIO', 'STUDIOS', 'MEDIA', 'PRODUCTIONS', 'PRODUCTION', 'ENT',
];

export function classifySourceType(narration: string): 'company' | 'personal' {
  const upper = (narration || '').toUpperCase();
  const isCompany =
    COMPANY_KEYWORDS.some((k) => new RegExp('\\b' + k + '\\b').test(upper)) || /\bLIMIT[A-Z]*\b/.test(upper); // catches a truncated "Limited" (e.g. "LIMITE") too
  return isCompany ? 'company' : 'personal';
}

// Checks whether a typed employer/business name plausibly shows up anywhere in a bank statement's raw
// extracted text — used for the Work status cross-check. Deliberately word-based rather than an exact
// full-string match: real narrations are commonly truncated or abbreviated by the bank's own system
// ("SALARY-XYZ TECHNOLOGIES" instead of the full registered name), so requiring the whole name intact
// would produce false "not found" warnings on statements where the name genuinely is there. Common
// company-suffix words are ignored so a match has to land on something actually distinctive to the
// name, not just a generic word like "LIMITED" that would trivially appear all over any statement.
// "BANK", "STORE(S)" etc are deliberately included even though they're part of many real company
// names — they're common enough in generic narration text that keeping them would cause false
// positive matches, exactly like "Zenith Bank Plc" wrongly matching a Fidelity Bank narration purely
// on the shared word "BANK".
export const WORK_NAME_STOPWORDS = [
  'LTD', 'LIMITED', 'PLC', 'NIGERIA', 'NIG', 'ENTERPRISES', 'ENTERPRISE', 'COMPANY',
  'CO', 'INC', 'INTERNATIONAL', 'GROUP', 'GLOBAL', 'VENTURES', 'VENTURE', 'AND', 'OF', 'THE', 'SERVICES', 'SERVICE',
  'BANK', 'STORE', 'STORES', 'HOLDINGS', 'INDUSTRIES',
];

// Shared word-list extraction used by both the whole-document presence check below and the
// per-transaction inflow-matching check (findInflowsMatchingName in classify.ts) — one place these
// distinctive words are derived from a typed employer/business name, so both checks stay consistent
// with each other.
export function nameMatchWords(name: string): string[] {
  let words = (name || '')
    .toUpperCase()
    .replace(/[^A-Z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length >= 3 && WORK_NAME_STOPWORDS.indexOf(w) === -1 && !LIMITED_SUFFIX_RE.test(w));
  // A short name (e.g. "GTB" or a two-word personal name with nothing left after stopwords) falls back
  // to a looser 2-character-minimum pass rather than being unmatchable by construction.
  if (!words.length) {
    words = (name || '')
      .toUpperCase()
      .replace(/[^A-Z0-9\s]/g, ' ')
      .split(/\s+/)
      .filter((w) => w.length >= 2 && !LIMITED_SUFFIX_RE.test(w));
  }
  // Dedupe — the same word can legitimately show up twice, but a repeated word must still only count
  // as ONE piece of matching evidence, not two — otherwise a single shared word appearing twice in
  // this list could, on its own, satisfy the "2+ distinctive words" safety threshold it's meant to
  // guard against (see findInflowsMatchingName in classify.ts).
  const seenWord: Record<string, boolean> = {};
  return words.filter((w) => {
    if (seenWord[w]) return false;
    seenWord[w] = true;
    return true;
  });
}

export function nameAppearsInStatementText(name: string, text: string): boolean {
  if (!name || !text) return false;
  const upperText = text.toUpperCase();
  const words = nameMatchWords(name);
  return words.some((w) => upperText.indexOf(w) !== -1);
}

// Best-effort extraction of the account HOLDER's own name from a bank statement's header — most
// Nigerian statements print one near the top under a label like "Account Name" or "Customer Name".
// Used to catch the applicant uploading someone else's statement before that surfaces much later as
// a refusal. Deliberately conservative: returns null (no check performed) rather than guessing, so a
// statement whose format this doesn't recognise never produces a false "wrong name" alarm.
export const ACCOUNT_NAME_LABEL_RE = [
  /account\s*name\s*[:\-]\s*([A-Za-z][A-Za-z.,'\-\s]{3,60})/i,
  /customer\s*name\s*[:\-]\s*([A-Za-z][A-Za-z.,'\-\s]{3,60})/i,
  /name\s*of\s*(?:account\s*)?holder\s*[:\-]\s*([A-Za-z][A-Za-z.,'\-\s]{3,60})/i,
  /a\/?c\s*name\s*[:\-]\s*([A-Za-z][A-Za-z.,'\-\s]{3,60})/i,
];

export function extractAccountHolderName(text: string): string | null {
  if (!text) return null;
  for (let i = 0; i < ACCOUNT_NAME_LABEL_RE.length; i++) {
    const m = text.match(ACCOUNT_NAME_LABEL_RE[i]);
    if (m && m[1]) {
      // Cut off at the first run of 2+ digits, or the start of the NEXT header-shaped label —
      // statements are extracted line-by-line and then joined with spaces, so "Account Name: X"
      // immediately followed by "Account Number: Y" on the next line reads as one run of text
      // here; without this, "Y"'s label words would get swept into the captured name too.
      const raw = m[1]
        .split(/\d{2,}|\bno\.?\b|\bnumber\b|\baccount\b|\bacct\b|\bbranch\b|\bsort\s*code\b|\biban\b|\bbvn\b|\baddress\b|\bstatement\b|\bperiod\b|\bcurrency\b|\bdate\b|\btype\b|\bbalance\b|\bcustomer\b|\bholder\b/i)[0]
        .replace(/\s+/g, ' ')
        .trim();
      if (raw.length >= 4 && /[A-Za-z]{2,}\s+[A-Za-z]{2,}/.test(raw)) return raw;
    }
  }
  return null;
}

// Explicit request: "it must be strictly names that should be extracted, names alone." Every real
// personal name in Latin script — Nigerian (Yoruba/Igbo/Hausa), British, American, or otherwise —
// carries at least one vowel sound; a bank's own internal channel/processor/reference codes are
// very often a short run of consonants only (e.g. "MPTJ", "WVV", "PMT", "XFR"), and unlike names,
// new ones keep turning up that no fixed BANK_NARRATION_STOPWORDS entry can pre-empt. This is a
// general backstop for exactly that: a word never seen before, that still doesn't look name-shaped.
// "Y" counts as a vowel here since it commonly carries the vowel sound in real names (Yaro, Yemi,
// Kyle, Lynn). Deliberately only applied to 3+ letter words that would otherwise START/extend a
// run — the existing 1-2 letter connector handling (below) is untouched, so short real fragments
// like initials or "N"/"&" inside an established name keep working exactly as before.
export function looksNameShaped(w: string): boolean {
  return /[AEIOUY]/.test(w);
}

// Real-world finding, off a "SENDER:"-labelled narration style ("SENDER: BILIKIS", "SENDER: CRISP",
// "SENDER: YARO"): the field after "SENDER"/"FROM"/"FRM" is sometimes just ONE word, not the
// first+last-name pair the general 2+-word run requirement below assumes. A single word with no
// marker in front of it is still dropped (too likely a stray fragment), but a single word directly
// following an explicit sender-context marker is a strong enough signal to keep.
export const SENDER_MARKERS = ['SENDER', 'FROM', 'FRM'];
// Symmetric counterpart: the word(s) immediately after "TO"/"IFO" ("in favour of") name the
// RECIPIENT of a transfer, not the sender — on an inflow (credit) narration that's the applicant's
// own account, almost by definition.
export const RECIPIENT_MARKERS = ['TO', 'IFO'];

// Returns [{name, precededBy}] — precededBy is the stopword token (if any) that was flushed
// immediately before this run started, or null if the run opens the narration / follows a
// non-stopword flush. extractNameCandidates() below is the plain-string view every existing caller
// already expects; extractNameCandidatesDetailed() is for callers that need to know which side of a
// FROM/TO-style narration a name came from.
export function extractNameCandidatesDetailed(narration: string): NameCandidate[] {
  const raw = (narration || '').toUpperCase().replace(/[^A-Z\s]/g, ' ').split(/\s+/);
  const runs: NameCandidate[] = [];
  let current: string[] = [];
  let lastStopword: string | null = null;
  let runMarker: string | null = null;
  function flush() {
    if (current.length >= 2) {
      runs.push({ name: trimTrailingNonNameWords(current).join(' '), precededBy: runMarker });
    } else if (current.length === 1 && SENDER_MARKERS.indexOf(runMarker as string) !== -1) {
      runs.push({ name: current[0], precededBy: runMarker });
    }
    current = [];
  }
  raw.forEach((w) => {
    if (!w) return;
    if (BANK_NARRATION_STOPWORDS.indexOf(w) !== -1 || LIMITED_SUFFIX_RE.test(w)) {
      flush();
      lastStopword = w;
    } else if (w.length >= 3 && looksNameShaped(w)) {
      if (current.length === 0) runMarker = lastStopword;
      current.push(w);
    } else if (w.length >= 3) {
      // 3+ letters but not a single recognised vowel sound among them — almost certainly a
      // reference/channel code rather than a real name (see looksNameShaped above). Treated the
      // same as hitting a stopword: whatever run was building gets flushed, so this can't glue
      // itself onto an otherwise-real name either.
      flush();
      lastStopword = null;
    } else if (current.length > 0) {
      // A short word (1-2 letters, e.g. a connector like "N" or "&" inside a longer registered name)
      // that isn't a known stopword — keep it as a connector INSIDE an already-started name run, but
      // don't let it start a run on its own (avoids picking up stray single letters/initials from
      // narration noise).
      current.push(w);
    }
  });
  flush();
  return runs;
}

export function extractNameCandidates(narration: string): string[] {
  return extractNameCandidatesDetailed(narration).map((r) => r.name);
}

export function toTitleCase(s: string): string {
  return s.toLowerCase().replace(/\b[a-z]/g, (c) => c.toUpperCase());
}

// Symmetric loose word-overlap match, same approach already used for the passport-vs-typed-name check
// elsewhere — tolerant of a name being printed in a different order, with a middle name added/dropped,
// etc., since that alone isn't evidence of a wrong statement.
export function namesLooselyMatch(nameA: string, textB: string): 'ok' | 'partial' | 'fail' | null {
  if (!nameA || !textB) return null;
  const wordsA = nameA
    .toLowerCase()
    .replace(/[^a-z\s]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length >= 2);
  if (!wordsA.length) return null;
  const lowerB = textB.toLowerCase();
  const found = wordsA.filter((w) => lowerB.indexOf(w) !== -1);
  if (found.length === wordsA.length) return 'ok';
  if (found.length > 0) return 'partial';
  return 'fail';
}

// User feedback: "If you find any Surname similar to applicant from the bank statement group as
// Family then ask for the reason." Nigerian full names on this form are typically typed as First
// Middle Last, so the LAST word of the applicant's own typed name is taken as their likely surname —
// e.g. "Adaeze Grace Nnamdi" -> "Nnamdi", which is exactly the kind of shared surname that recurs in
// real family-sender narrations (e.g. a payment from "Chika Obi Nnamdi"). Deliberately conservative:
// requires the applicant to have typed at least two words (so a lone single name never becomes a
// match-anything surname), and skips very short words that would produce false positives.
export function surnameOf(fullName: string): string {
  const words = (fullName || '').trim().split(/\s+/).filter((w) => w.length >= 3);
  return words.length >= 2 ? words[words.length - 1] : '';
}

export function sharesSurname(candidateName: string, applicantSurname: string): boolean {
  if (!applicantSurname) return false;
  const words = (candidateName || '').toUpperCase().split(/\s+/);
  return words.indexOf(applicantSurname.toUpperCase()) !== -1;
}

// User report (with their own manually-reconciled spreadsheet cross-check confirming the real
// answer): a recurring ₦100,000 "Salary" bucket was attributed to the APPLICANT'S OWN name, not any
// real sender. Bank narrations name both sides of a transfer ("...TRF TO <applicant> FROM
// <sender>..."), and extractNameCandidates has no notion of which side is which — it just returns
// every name-shaped word run in the line. Since the applicant is the recipient on every single
// inflow, their own name is the one candidate guaranteed to recur across almost every narration, so
// it kept winning the "most months seen" vote for whichever recurring amount, crowding out the real
// (and genuinely inconsistent-looking) sender. Excluded here before any name gets to compete for
// "dominant sender."
export function isLikelyApplicantsOwnName(candidate: string, applicantName: string | null | undefined): boolean {
  if (!applicantName) return false;
  const nameWords = applicantName.trim().split(/\s+/).filter((w) => w.length >= 2);
  // A one-word typed name isn't a safe enough signal to exclude candidates by — every family
  // member sharing that one word would get wrongly excluded too. Real applicant names entered here
  // are expected to be at least first + last, matching the same >=2-word assumption surnameOf uses.
  if (nameWords.length < 2) return false;
  // Requires the candidate to contain EVERY word of the applicant's own full typed name — a family
  // member who merely shares a surname (e.g. "Chika Obi Nnamdi", sharing the applicant's "Nnamdi")
  // only shares ONE of those words, so this stays narrowly scoped to "the applicant's own name
  // leaked into the sender list," not "anyone who happens to share a surname."
  return namesLooselyMatch(applicantName, candidate) === 'ok';
}

// Shared by every caller below that wants "who actually sent this money in" — combines the two
// exclusion checks: a recipient-marked (TO/IFO) run is structurally the wrong side of the narration
// regardless of whose name it happens to be, and isLikelyApplicantsOwnName catches the applicant's
// own name even where no TO/IFO marker is present at all (many narrations only ever name one side).
export function senderSideCandidates(narration: string, applicantName: string | null | undefined): string[] {
  return extractNameCandidatesDetailed(narration)
    .filter((r) => RECIPIENT_MARKERS.indexOf(r.precededBy as string) === -1 && !isLikelyApplicantsOwnName(r.name, applicantName))
    .map((r) => r.name);
}

// Same sender-side filtering as senderSideCandidates above, WITHOUT the isLikelyApplicantsOwnName
// exclusion — used only by the Self check (looksLikeSelfInflow). Real-data bug: a self-transfer
// narrated with the applicant's EXACT full typed name ("SENDER: AGBOOLA MARY OLUWAFUNMILAYO", where
// that's precisely what's typed as her passport name) got its only candidate stripped out entirely
// by senderSideCandidates' own applicant-name exclusion — correct for every OTHER caller, but it meant
// the Self check downstream had NOTHING left to test, so the transaction looked exactly like a
// genuinely blank/coded narration and fell through to "no candidate name — trust it as salary" instead
// of being recognised as obviously the applicant's own money. The Self check needs the UNFILTERED
// candidate precisely so it can positively match it against the applicant's own name/holder-name
// variants itself.
export function senderSideCandidatesForSelfCheck(narration: string): string[] {
  return extractNameCandidatesDetailed(narration)
    .filter((r) => RECIPIENT_MARKERS.indexOf(r.precededBy as string) === -1)
    .map((r) => r.name);
}

export function identifyIncomeSourceName(
  txns: ParsedTxn[],
  targetAmount: number,
  applicantName: string | null | undefined
): { name: string; monthsSeen: number } | null {
  const buckets: Record<string, Record<string, boolean>> = {};
  txns.forEach((t) => {
    if (!t.credit || isReversalNarration(t) || isNonIncomeChargeNarration(t.narration)) return;
    if (Math.round(t.credit / 5000) * 5000 !== targetAmount) return;
    const monthKey = t.date.getFullYear() + '-' + t.date.getMonth();
    senderSideCandidates(t.narration, applicantName).forEach((name) => {
      if (!buckets[name]) buckets[name] = {};
      buckets[name][monthKey] = true;
    });
  });
  let best: string | null = null;
  let bestCount = 0;
  Object.keys(buckets).forEach((name) => {
    const count = Object.keys(buckets[name]).length;
    if (count > bestCount) {
      bestCount = count;
      best = name;
    }
  });
  if (!best || bestCount < 2) return null;
  return { name: toTitleCase(best), monthsSeen: bestCount };
}

// Independent of any single recurring AMOUNT (the check above): scans every credit's narration and finds
// whichever person/company name recurs across the most individual PAYMENTS. This is the check that catches
// a client/employer who pays the same person repeatedly but with varying amounts each time (e.g. a
// contractor invoiced 42 times at different figures) — identifyIncomeSourceName above would miss that
// because it only ever looks inside one specific amount-bucket.
export function identifyTopIncomeSource(
  txns: ParsedTxn[],
  applicantName: string | null | undefined
): { name: string; count: number; monthsSeen: number; totalAmount: number; type: 'company' | 'personal' } | null {
  const buckets: Record<string, { count: number; totalAmount: number; months: Record<string, boolean>; companyHits: number }> = {};
  txns.forEach((t) => {
    if (!t.credit || isReversalNarration(t) || isNonIncomeChargeNarration(t.narration)) return;
    // Same fix as identifyIncomeSourceName above — the applicant's own name is on the "TO" side of
    // nearly every narration, so left unfiltered it wins "most frequent source" against itself almost
    // every time.
    const candidates = senderSideCandidates(t.narration, applicantName);
    if (!candidates.length) return;
    // Use the longest candidate from this narration (most specific / least likely to be a stray
    // fragment) so one transaction only contributes once, rather than once per overlapping substring.
    const name = candidates.reduce((a, b) => (b.length > a.length ? b : a));
    if (!buckets[name]) buckets[name] = { count: 0, totalAmount: 0, months: {}, companyHits: 0 };
    buckets[name].count++;
    buckets[name].totalAmount += t.credit;
    buckets[name].months[t.date.getFullYear() + '-' + t.date.getMonth()] = true;
    // Checked against the raw narration (not the "name" candidate above) since company suffixes like
    // "LTD"/"SOLUTIONS" are exactly the words extractNameCandidates strips out or keeps as part of the run.
    if (classifySourceType(t.narration) === 'company') buckets[name].companyHits++;
  });
  let bestName: string | null = null;
  let best: { count: number; totalAmount: number; months: Record<string, boolean>; companyHits: number } | null = null;
  Object.keys(buckets).forEach((name) => {
    const b = buckets[name];
    if (!best || b.count > best.count) {
      best = b;
      bestName = name;
    }
  });
  const b = best as unknown as { count: number; totalAmount: number; months: Record<string, boolean>; companyHits: number };
  if (!bestName || b.count < 2) return null;
  // If even one narration under this name carried a company keyword, treat the whole recurring source as
  // a company — a suffix like "LTD" doesn't always survive every single narration line (truncation,
  // inconsistent formatting), but seeing it even once is a strong signal.
  return {
    name: toTitleCase(bestName),
    count: b.count,
    monthsSeen: Object.keys(b.months).length,
    totalAmount: b.totalAmount,
    type: b.companyHits > 0 ? 'company' : 'personal',
  };
}

// For a BUSINESS statement: look for credits whose narration line names the applicant or reads like a
// personal drawing (salary/director/remuneration), and count how many distinct months that shows up in —
// evidence the applicant personally draws money from the business, not just that the business has funds.
export function findRecurringPaymentToPerson(
  txns: ParsedTxn[],
  answers: { name?: string }
): RecurringPaymentToPersonResult {
  const nameParts = (answers.name || '').toLowerCase().split(/\s+/).filter((p) => p.length > 1);
  const keywords = ['salary', 'director', 'drawing', 'remuneration', 'allowance'].concat(nameParts);
  const monthsWithMatch: Record<string, boolean> = {};
  const matchedAmounts: number[] = [];
  const matchedTxns: { date: Date; amount: number }[] = [];
  txns.forEach((t) => {
    // A salary/drawing paid FROM the business TO its director is money LEAVING the business account —
    // a debit on this statement, not a credit.
    if (!t.debit) return;
    const lower = (t.narration || '').toLowerCase();
    const matched = keywords.some((k) => k && lower.indexOf(k) !== -1);
    if (matched) {
      monthsWithMatch[t.date.getFullYear() + '-' + t.date.getMonth()] = true;
      matchedAmounts.push(t.debit);
      matchedTxns.push({ date: t.date, amount: t.debit });
    }
  });
  const monthsSeen = Object.keys(monthsWithMatch).length;
  const avgAmount = matchedAmounts.length
    ? matchedAmounts.reduce((a, b) => a + b, 0) / matchedAmounts.length
    : 0;
  return { monthsSeen, avgAmount, transactions: matchedTxns };
}
