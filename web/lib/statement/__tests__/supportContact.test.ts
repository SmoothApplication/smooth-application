import { buildStatementHelpMessage, buildStatementHelpWhatsAppHref, FOUNDER_WHATSAPP_NUMBER } from '../supportContact';

describe('supportContact (real-time "stuck applicant" WhatsApp alert)', () => {
  test('message names the specific failure without ever describing the statement contents', () => {
    const msg = buildStatementHelpMessage('no_text', 'UK visitor visa');
    expect(msg).toContain("couldn't read any text");
    expect(msg).toContain('UK visitor visa');
    expect(msg).not.toMatch(/narration|balance|transaction amount/i);
  });

  test('covers all three failure reasons with distinct text', () => {
    const noText = buildStatementHelpMessage('no_text');
    const noTxns = buildStatementHelpMessage('no_transactions');
    const exception = buildStatementHelpMessage('exception');
    expect(noText).not.toBe(noTxns);
    expect(noTxns).not.toBe(exception);
  });

  test('works without a visaName (optional)', () => {
    expect(() => buildStatementHelpMessage('no_transactions')).not.toThrow();
  });

  test('href points at the founder WhatsApp number with the message URL-encoded', () => {
    const href = buildStatementHelpWhatsAppHref('exception', 'Canada visitor visa');
    expect(href).toBe(`https://wa.me/${FOUNDER_WHATSAPP_NUMBER}?text=${encodeURIComponent(buildStatementHelpMessage('exception', 'Canada visitor visa'))}`);
  });
});
