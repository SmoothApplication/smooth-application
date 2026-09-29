import { renderReportPdf } from '../renderReportPdf';
import { ReportPayload } from '../types';

const BASE_PAYLOAD: ReportPayload = {
  generatedAtISO: new Date('2026-09-29T10:00:00Z').toISOString(),
  countryCode: 'uk',
  countryName: 'United Kingdom',
  visaName: 'Standard Visitor visa',
  docs: { percent: 50, statusLabel: 'Making progress', totalRequired: 4, totalChecked: 2, missing: [{ id: 'x', label: 'Bank statement' }] },
  responsibilities: [{ label: 'Employed', value: 'Yes' }],
  financial: null,
  statement: null,
};

describe('renderReportPdf', () => {
  it('produces a well-formed PDF buffer for a minimal payload', async () => {
    const buf = await renderReportPdf(BASE_PAYLOAD);
    expect(Buffer.isBuffer(buf)).toBe(true);
    expect(buf.length).toBeGreaterThan(500);
    expect(buf.slice(0, 5).toString()).toBe('%PDF-');
    expect(buf.slice(-6).toString().trim().endsWith('%%EOF')).toBe(true);
  });

  it('renders successfully with financial + statement sections populated', async () => {
    const payload: ReportPayload = {
      ...BASE_PAYLOAD,
      financial: {
        totalCost: 1000000,
        recommendedFunds: 2000000,
        totalFunds: 2500000,
        shortfall: -500000,
        fundsReady: true,
        readinessPercent: 100,
        readinessCapped: false,
        timingRealityCheck: '',
      },
      statement: {
        statements: [
          { label: 'Salary account', closingBalance: 1500000, firstDateISO: '2026-01-01T00:00:00.000Z', lastDateISO: '2026-03-01T00:00:00.000Z', txnCount: 10 },
          { label: 'Side business', closingBalance: 500000, firstDateISO: '2026-02-01T00:00:00.000Z', lastDateISO: '2026-02-20T00:00:00.000Z', txnCount: 4 },
        ],
        combinedClosingBalance: 2000000,
        earliestDateISO: '2026-01-01T00:00:00.000Z',
        latestDateISO: '2026-03-01T00:00:00.000Z',
      },
    };
    const buf = await renderReportPdf(payload);
    expect(buf.slice(0, 5).toString()).toBe('%PDF-');
    expect(buf.length).toBeGreaterThan(500);
  });
});
