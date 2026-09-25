// Ported from tests/bank-field-label-name-noise.test.js.
// User-reported screenshot: the "Consistent senders" table showed garbled names like "Mptj Cg Sender
// Crisp N", "Payref Sender Adisa Bilikis Abiola Remark", and "Payref Zmo Sender Yaro Remark Ok" - a
// real bank's structured narration format prints literal field labels ("SENDER:", "REMARK:") and
// channel/processor codes ("MPTJ", "PAYREF", "CG", "WVV", "ZMO", "ONB") right alongside the actual
// name, and extractNameCandidates was gluing all of it onto the extracted name instead of stopping at
// the field labels. Calls extractNameCandidates directly with the same real narration strings the
// original test drove through the __testExtractNameCandidates DOM escape hatch.
import { extractNameCandidates } from '../names';

test('strips bank field labels and channel/processor codes out of extracted name candidates', () => {
  const cases = [
    { narration: 'MPTJ/CG/SENDER:CRISP MASTERS/REMARK:OK', expectClean: 'Crisp Masters' },
    { narration: 'PAYREF/SENDER:ADISA BILIKIS ABIOLA/REMARK:OK', expectClean: 'Adisa Bilikis Abiola' },
    { narration: 'MPTJ/WVV/SENDER:BILIKIS OYELARAN/REMARK:OK', expectClean: 'Bilikis Oyelaran' },
    { narration: 'PAYREF/SENDER:YARO HADIZA/REMARK:OK', expectClean: 'Yaro Hadiza' },
    { narration: 'PAYREF/ONB/SENDER:IBUKUNOLUWA ADEBAYO/REMARK:OK', expectClean: 'Ibukunoluwa Adebayo' },
  ];

  cases.forEach((c) => {
    const candidates = extractNameCandidates(c.narration);
    const joined = candidates.join(' | ');
    ['MPTJ', 'PAYREF', 'SENDER', 'REMARK', 'CG', 'WVV', 'ZMO', 'ONB', 'OK'].forEach((junk) => {
      const re = new RegExp('\\b' + junk + '\\b', 'i');
      expect(re.test(joined)).toBe(false);
    });
    const titleCased = candidates.map((s) => s.toLowerCase().replace(/\b[a-z]/g, (ch) => ch.toUpperCase()));
    expect(titleCased).toContain(c.expectClean);
  });
});
