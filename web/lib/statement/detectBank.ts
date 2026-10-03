// Reads the bank's own name off a statement so the applicant never has to type it (see detectBankName below).
const BANKS: Array<[string, RegExp]> = [
  ['Providus Bank', /providus/i],
  ['GTBank', /\bguaranty\s+trust\b|\bgtbank\b|\bgtco\b|\bGTB\b/i],
  ['Zenith Bank', /zenith/i],
  ['Access Bank', /\baccess\s+bank\b|\baccessbank\b/i],
  ['First Bank', /\bfirst\s*bank\b|\bfirstbank\b|\bfbn\b/i],
  ['UBA', /\bunited\s+bank\s+for\s+africa\b|\buba\b/i],
  ['Fidelity Bank', /\bfidelity\s+bank\b/i],
  ['Sterling Bank', /\bsterling\s+bank\b/i],
  ['Stanbic IBTC', /\bstanbic\b/i],
  ['Union Bank', /\bunion\s+bank\b/i],
  ['Wema Bank', /\bwema\b/i],
  ['Polaris Bank', /\bpolaris\b/i],
  ['Keystone Bank', /\bkeystone\b/i],
  ['FCMB', /\bfcmb\b|\bfirst\s+city\s+monument\b/i],
  ['Ecobank', /\becobank\b/i],
  ['Heritage Bank', /\bheritage\s+bank\b/i],
  ['Unity Bank', /\bunity\s+bank\b/i],
  ['Jaiz Bank', /\bjaiz\b/i],
  ['Kuda', /\bkuda\b/i],
  ['OPay', /\bopay\b/i],
  ['Moniepoint', /\bmoniepoint\b/i],
  ['PalmPay', /\bpalmpay\b/i],
  ['Globus Bank', /\bglobus\b/i],
  ['Titan Trust Bank', /\btitan\s+trust\b/i],
  ['Standard Chartered', /\bstandard\s+chartered\b/i],
  ['Citibank', /\bciti\s*bank\b/i],
  ['TAJBank', /\btaj\s*bank\b/i],
  ['Lotus Bank', /\blotus\s+bank\b/i],
  ['Parallex Bank', /\bparallex\b/i],
  ['Premium Trust Bank', /\bpremium\s+trust\b/i],
  ['SunTrust Bank', /\bsuntrust\b/i],
  ['Optimus Bank', /\boptimus\b/i],
];

function firstBank(text: string, selfIdentifiedOnly: boolean): string | null {
  let best: { name: string; at: number } | null = null;
  for (const [name, re] of BANKS) {
    // "ProvidusBank Plc", "Zenith Bank Plc", "Guaranty Trust Bank Limited": the bank naming itself as the issuer.
    const probe = selfIdentifiedOnly ? new RegExp(`(?:${re.source})(?:\\s*bank)?\\s+(?:plc|limited|ltd)\\b`, 'i') : re;
    const m = probe.exec(text);
    if (m && (best === null || m.index < best.at)) best = { name, at: m.index };
  }
  return best ? best.name : null;
}

/**
 * `lines` = every line of the statement. Only the first few lines (the account header, before any transaction)
 * are searched for a bare bank name. Many banks (Providus, for one) only name themselves in a footer
 * disclaimer ("ProvidusBank Plc ..."), so the last lines are tried next, but only for a bank naming itself as
 * issuer (… Plc / … Limited). Transaction narrations name other banks ("TO GLOBUS BANK") and are never used.
 */
export function detectBankName(lines: string[]): string | null {
  // The account header ends where the column titles or the first dated row begin.
  const end = lines.findIndex(
    (l, i) => i > 0 && (/debit.*credit|credit.*debit|pay\s*in.*pay\s*out/i.test(l) || /^\s*\d{1,2}[-/ ][A-Za-z0-9]{2,4}[-/ ]\d{2,4}\b/.test(l))
  );
  const header = lines.slice(0, Math.min(end === -1 ? 8 : end, 40)).join(' \n ');
  return (
    firstBank(header, false) ||
    firstBank(header, true) ||
    firstBank(lines.slice(-40).join(' \n '), true)
  );
}
