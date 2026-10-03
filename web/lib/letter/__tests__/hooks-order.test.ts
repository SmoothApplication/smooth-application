// A React component must call the same hooks on every render. Calling a hook after an early
// `if (...) return null;` crashes the page with React error #310 (this shipped once on Final review).
// jest here runs without a DOM, so this checks the source instead: no hook call may appear after a
// top-level early return inside the same component function.
import fs from 'fs';
import path from 'path';

const FILES = [
  'components/checklist/PersonalLetterPanel.tsx',
  'components/checklist/StatementDashboard.tsx',
  'components/checklist/statement-dashboard/ReportTab.tsx',
  'components/checklist/statement-dashboard/AnalysisTab.tsx',
  'components/checklist/statement-dashboard/SourceGroupCard.tsx',
];
const EARLY_RETURN = /^ {2}if \(.+\) return(?: null| <[^;]*>)?;\s*$/;
const HOOK_CALL = /^ {2}(?:const [^=]+ = |const \{[^}]*\} = )?use(?:State|Effect|Memo|Callback|Ref|Reducer|Context)\(/;

describe('hooks run before any early return', () => {
  FILES.forEach((rel) => {
    it(rel, () => {
      const lines = fs.readFileSync(path.join(__dirname, '../../../', rel), 'utf8').split('\n');
      let early = -1;
      const offenders: string[] = [];
      lines.forEach((l, i) => {
        if (/^(export default )?function [A-Z]/.test(l) || /^export function [A-Z]/.test(l)) early = -1; // new component
        if (EARLY_RETURN.test(l)) early = early === -1 ? i : early;
        else if (early !== -1 && HOOK_CALL.test(l)) offenders.push(`${rel}:${i + 1} ${l.trim()}`);
      });
      expect(offenders).toEqual([]);
    });
  });
});
