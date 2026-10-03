// Real Providus statement: Remita payroll narrations carry the payment's purpose glued into one
// unspaced token ("U:STAFFSALARYFORMARCH2026:CBN:...", "U:2NDQUARTERALLOWANCES2026TOSTAFF:CBN:...").
// The normal reason extractor only reads "/"-separated plain words, so these rows came out blank and the
// reviewer saw nothing to confirm. This splits that token back into words using a small payroll
// vocabulary. Fully on-device; if the token can't be split cleanly it returns null rather than guess.
const VOCAB = [
  'STAFF', 'SALARY', 'SALARIES', 'FOR', 'TO', 'OF', 'AND', 'THE', 'END', 'ONE', 'OFF', 'ANNUAL', 'QUARTER', 'QTR',
  'ALLOWANCE', 'ALLOWANCES', 'INTERVENTION', 'EMPLOYEE', 'FAMILY', 'BURIAL', 'ASSISTANCE', 'NEGOTIATION', 'BONUS',
  'PRODUCTIVITY', 'RECOGNITION', 'EXGRATIA', 'LEAVE', 'GRANT', 'ARREARS', 'PROMOTION', 'OVERTIME', 'TRANSPORT',
  'HOUSING', 'MEDICAL', 'PENSION', 'GRATUITY', 'REFUND', 'REIMBURSEMENT', 'PAYMENT', 'INCENTIVE', 'REWARD', 'WELFARE',
  'SEVERANCE', 'TRAINING', 'PER', 'DIEM', 'ACTING', 'DUTY', 'MONTH', 'STIPEND', 'COMMISSION', 'NUPRC', 'CBN',
  'JANUARY', 'FEBRUARY', 'MARCH', 'APRIL', 'MAY', 'JUNE', 'JULY', 'AUGUST', 'SEPTEMBER', 'OCTOBER', 'NOVEMBER', 'DECEMBER',
  'JAN', 'FEB', 'MAR', 'APR', 'JUN', 'JUL', 'AUG', 'SEP', 'SEPT', 'OCT', 'NOV', 'DEC',
];
const MONTHS = new Set(['JANUARY','FEBRUARY','MARCH','APRIL','MAY','JUNE','JULY','AUGUST','SEPTEMBER','OCTOBER','NOVEMBER','DECEMBER']);
const ORDINAL_RE = /^\d{1,2}(ST|ND|RD|TH)/;

function segment(s: string): string[] | null {
  const n = s.length;
  // best[i] = fewest tokens covering s[0..i), or null
  const best: (string[] | null)[] = new Array(n + 1).fill(null);
  best[0] = [];
  for (let i = 0; i < n; i++) {
    const cur = best[i];
    if (!cur) continue;
    const rest = s.slice(i);
    const cands: string[] = [];
    const num = /^\d+/.exec(rest);
    const ord = ORDINAL_RE.exec(rest);
    if (ord) cands.push(ord[0]);
    else if (num) cands.push(num[0]);
    VOCAB.forEach((w) => { if (rest.startsWith(w)) cands.push(w); });
    cands.forEach((c) => {
      const j = i + c.length;
      if (!best[j] || best[j]!.length > cur.length + 1) best[j] = cur.concat(c);
    });
  }
  if (best[n]) return best[n];
  // Bank truncation: allow a final fragment that is the start of a known word (e.g. "ST" of STAFF).
  for (let cut = n - 1; cut >= Math.max(1, n - 12); cut--) {
    const tail = s.slice(cut);
    if (best[cut] && tail.length >= 2 && VOCAB.some((w) => w.startsWith(tail) && w !== tail)) return best[cut];
  }
  return null;
}

/** Plain-words purpose of a Remita inflow, e.g. "Staff salary for March 2026"; null if not Remita
 * or not cleanly splittable. */
export function extractRemitaPurpose(narration: string | null | undefined): string | null {
  if (!narration || !/REMITA/i.test(narration)) return null;
  const m = /\bU\s*:\s*([A-Za-z0-9 ]+?)\s*(?:[:\/]|$)/i.exec(narration);
  if (!m) return null;
  const token = m[1].replace(/\s+/g, '').toUpperCase();
  if (token.length < 4) return null;
  const words = segment(token);
  if (!words || !words.length) return null;
  const text = words
    .map((w) => (w === 'NUPRC' || w === 'CBN' ? w : MONTHS.has(w) ? w.charAt(0) + w.slice(1).toLowerCase() : w.toLowerCase()))
    .join(' ');
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/** Short category for a Remita purpose, used to summarise a whole sender in the review sheet. */
export function remitaCategory(purpose: string): string {
  const p = purpose.toLowerCase();
  if (/salar/.test(p)) return 'Salary';
  if (/bonus/.test(p)) return 'Bonus';
  if (/burial|assistance/.test(p)) return 'Burial assistance';
  if (/allowance/.test(p)) return 'Allowances';
  return purpose;
}
