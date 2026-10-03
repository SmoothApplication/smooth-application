// Reads the bank's own name off the top of a statement so the applicant never has to type it.
// Only the header is searched (narrations name other banks: "TRF TO ZIB"), and the earliest mention wins.
const BANKS: Array<[string, RegExp]> = [
  ['Providus Bank', /\bprovidus\b/i],
  ['GTBank', /\bguaranty\s+trust\b|\bgtbank\b|\bgtco\b|\bGTB\b/i],
  ['Zenith Bank', /\bzenith\b/i],
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

/** `headerLines` = the first lines of the statement (about 40 is plenty). Returns null when no bank is named. */
export function detectBankName(headerLines: string[]): string | null {
  const text = headerLines.slice(0, 40).join(' \n ');
  let best: { name: string; at: number } | null = null;
  for (const [name, re] of BANKS) {
    const m = re.exec(text);
    if (m && (best === null || m.index < best.at)) best = { name, at: m.index };
  }
  return best ? best.name : null;
}
