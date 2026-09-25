// Ported from tests/etz-channel-code-name-noise.test.js.
// Real Wema/ALAT statement finding: inbound interbank credits there sometimes narrate as
// "eTZ:<sender name>-<note>" (e.g. "eTZ:OLUWABUSOLAMI ELIZABETH OSHINOWO-NXG :MOBILET") - "ETZ" is
// eTranzact, an interbank real-time-transfer channel/processor, not part of the sender's own name.
// Before this fix, extractNameCandidates glued it onto the front of the run instead of stopping at
// it, same class of bug as the NIP/ONB/ROLEZ channel-code fixes. Calls extractNameCandidates
// directly, same as the original test's __testExtractNameCandidates DOM escape hatch wrapped.
import { extractNameCandidates } from '../names';

test('"ETZ"/"eTZ" channel-code prefix is stripped and never survives into an extracted name candidate', () => {
  const cases = [
    { narration: 'eTZ:OLUWABUSOLAMI ELIZABETH OSHINOWO-NXG :MOBILET', expectClean: 'Oluwabusolami Elizabeth Oshinowo' },
    { narration: 'ETZ:ADEDOTUN OLUWATOWOJU OGUNLADE-Transfer from AD', expectClean: 'Adedotun Oluwatowoju Ogunlade' },
  ];

  cases.forEach((c) => {
    const candidates = extractNameCandidates(c.narration);
    const joined = candidates.join(' | ');
    expect(/\bETZ\b/i.test(joined)).toBe(false);
    const titleCased = candidates.map((s) => s.toLowerCase().replace(/\b[a-z]/g, (ch) => ch.toUpperCase()));
    expect(titleCased).toContain(c.expectClean);
  });
});
