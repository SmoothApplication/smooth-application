// Reads the few numbers and dates a visa pack needs from a payslip and a flight reservation. Pure text
// parsing (the file is read on the device by readDocumentText); nothing is sent anywhere.
export interface PayslipData { month: string; gross: number; net: number; }
export interface FlightData { outboundISO: string; returnISO: string; }

const MONTHS = ['JANUARY','FEBRUARY','MARCH','APRIL','MAY','JUNE','JULY','AUGUST','SEPTEMBER','OCTOBER','NOVEMBER','DECEMBER'];
const num = (s: string) => parseFloat(s.replace(/,/g, ''));
const AMT = '(\\d{1,3}(?:,\\d{3})+(?:\\.\\d{1,2})?|\\d+\\.\\d{2})';

export function parsePayslipText(text: string): PayslipData | null {
  const t = text.replace(/ /g, ' ');
  const net = new RegExp('NET\\s*PAY\\s*[:\\-]?\\s*(?:NGN|N|₦)?\\s*' + AMT, 'i').exec(t);
  if (!net) return null;
  let gross = 0;
  const tot = new RegExp('TOTALS?\\b[^\\n\\d]*' + AMT, 'i').exec(t);
  if (tot) gross = num(tot[1]);
  if (!gross) {
    const g = new RegExp('GROSS\\s*(?:PAY|SALARY|EARNINGS)?\\s*[:\\-]?\\s*' + AMT, 'i').exec(t);
    if (g) gross = num(g[1]);
  }
  const m = /PAY\s*SLIP\s+FOR\s+([A-Z]{3,9})\s*[- ]?\s*(\d{4})/i.exec(t);
  let month = '';
  if (m) {
    const idx = MONTHS.findIndex((x) => x.startsWith(m[1].toUpperCase().slice(0, 3)));
    month = idx >= 0 ? `${MONTHS[idx][0]}${MONTHS[idx].slice(1).toLowerCase()} ${m[2]}` : `${m[1]} ${m[2]}`;
  }
  return { month, gross, net: num(net[1]) };
}

export function parseFlightText(text: string): FlightData | null {
  const re = /\b(\d{1,2})\s*(JAN(?:UARY)?|FEB(?:RUARY)?|MAR(?:CH)?|APR(?:IL)?|MAY|JUN(?:E)?|JUL(?:Y)?|AUG(?:UST)?|SEP(?:TEMBER)?|OCT(?:OBER)?|NOV(?:EMBER)?|DEC(?:EMBER)?)\s+(20\d{2})\b/gi;
  const collect = (src: string) => {
    const out: number[] = [];
    let m: RegExpExecArray | null;
    re.lastIndex = 0;
    while ((m = re.exec(src))) {
      const mi = MONTHS.findIndex((x) => x.startsWith(m![2].toUpperCase().slice(0, 3)));
      out.push(Date.UTC(+m[3], mi, +m[1]));
    }
    return out;
  };
  // Journey headers carry a weekday ("FRIDAY, 30 OCTOBER 2026"); the issue date and ticket dates do not.
  // Prefer the weekday-labelled dates so the booking's issue date is never read as a travel date.
  const weekdayLines = text.split('\n').filter((l) => /\b(MON|TUE|WED|THU|FRI|SAT|SUN)[A-Z]*DAY\b/i.test(l));
  let dates = collect(weekdayLines.join('\n'));
  if (new Set(dates).size < 2) dates = collect(text);
  const uniq = Array.from(new Set(dates)).sort((a, b) => a - b);
  if (uniq.length < 2) return null;
  const iso = (ms: number) => new Date(ms).toISOString().slice(0, 10);
  return { outboundISO: iso(uniq[0]), returnISO: iso(uniq[uniq.length - 1]) };
}
