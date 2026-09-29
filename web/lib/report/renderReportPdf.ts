// Server-only: renders a ReportPayload (see types.ts) to a PDF Buffer via pdfkit. This is the
// piece "Save full report as PDF" never actually had — the pre-redesign button was just
// window.print(), no PDF generation at all (see CHANGELOG). Only ever called from
// app/api/email-report/route.ts, never from client code (pdfkit needs Node, not a browser).
//
// Currency note: pdfkit's built-in standard fonts (Helvetica/Times/Courier) use WinAnsiEncoding,
// which does NOT include the Naira sign (₦, U+20A6) — it would render as a missing-glyph box. The
// in-app UI's fmtN() (lib/checklist/financial.ts) is fine using '₦' since browsers have real Unicode
// fonts; this PDF renderer uses its own 'NGN 1,234,567' formatter instead, deliberately not reusing
// fmtN, to avoid shipping applicants a PDF with broken currency symbols.
import PDFDocument from 'pdfkit';
import type { ReportPayload } from './types';

function fmtCurrency(n: number): string {
  const rounded = Math.round(n || 0);
  const neg = rounded < 0;
  const abs = Math.abs(rounded);
  const s = abs.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return (neg ? '-NGN ' : 'NGN ') + s;
}

function fmtDate(iso: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

export function renderReportPdf(payload: ReportPayload): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: 50 });
    const chunks: Buffer[] = [];
    doc.on('data', (chunk: Buffer) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    const generated = new Date(payload.generatedAtISO);
    const generatedLabel = Number.isNaN(generated.getTime())
      ? payload.generatedAtISO
      : generated.toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });

    // --- Header ---
    doc.fontSize(20).font('Helvetica-Bold').text('Smooth Application', { continued: false });
    doc.fontSize(14).font('Helvetica').text(`${payload.countryName} ${payload.visaName} — Progress report`);
    doc.fontSize(9).fillColor('#666666').text(`Generated ${generatedLabel}`);
    doc.fillColor('#000000');
    doc.moveDown(1);

    function sectionHeading(text: string) {
      doc.moveDown(0.5);
      doc.fontSize(13).font('Helvetica-Bold').text(text);
      doc.moveTo(doc.x, doc.y + 2).lineTo(doc.page.width - doc.page.margins.right, doc.y + 2).strokeColor('#cccccc').stroke();
      doc.moveDown(0.5);
      doc.fillColor('#000000').font('Helvetica').fontSize(10);
    }

    function line(label: string, value: string) {
      doc.font('Helvetica-Bold').fontSize(10).text(`${label}: `, { continued: true });
      doc.font('Helvetica').text(value);
    }

    // --- Documents ---
    sectionHeading('Document checklist');
    line('Status', payload.docs.statusLabel);
    line('Required documents ready', `${payload.docs.totalChecked} of ${payload.docs.totalRequired} (${payload.docs.percent}%)`);
    if (payload.docs.missing.length) {
      doc.moveDown(0.3);
      doc.font('Helvetica-Bold').text('Still missing:');
      doc.font('Helvetica');
      payload.docs.missing.forEach((m) => doc.text(`•  ${m.label}`, { indent: 10 }));
    } else {
      doc.moveDown(0.3);
      doc.text('Nothing outstanding — nicely done.');
    }

    // --- Responsibilities ---
    sectionHeading('Your responsibilities');
    if (payload.responsibilities.length) {
      payload.responsibilities.forEach((r) => line(r.label, r.value));
    } else {
      doc.text('No responsibilities answers recorded yet.');
    }

    // --- Financial readiness ---
    sectionHeading('Financial readiness');
    if (payload.financial) {
      const f = payload.financial;
      line('Estimated trip cost', fmtCurrency(f.totalCost));
      line('Recommended funds (2x buffer)', fmtCurrency(f.recommendedFunds));
      line('Total funds available', fmtCurrency(f.totalFunds));
      line('Shortfall', f.shortfall > 0 ? fmtCurrency(f.shortfall) : 'None — funds cover the recommended buffer');
      line('Funds ready', f.fundsReady ? 'Yes' : 'No');
      line('Readiness score', `${f.readinessPercent}%${f.readinessCapped ? ' (capped — see note below)' : ''}`);
      if (f.readinessCapped) {
        doc.moveDown(0.3);
        doc.fontSize(9).fillColor('#666666').text(
          'Capped at 50%: this is a self-typed closing balance, not yet backed by at least 2 months of entered cash-flow data.'
        );
        doc.fillColor('#000000').fontSize(10);
      }
      if (f.timingRealityCheck) {
        doc.moveDown(0.3);
        doc.font('Helvetica-Bold').text('Timing note:');
        doc.font('Helvetica').text(f.timingRealityCheck);
      }
    } else {
      doc.text('No financial figures entered yet — use the financial calculator to add them.');
    }

    // --- Bank statement summary ---
    sectionHeading('Bank statement summary');
    if (payload.statement) {
      payload.statement.statements.forEach((s) => {
        doc.font('Helvetica-Bold').text(s.label);
        doc.font('Helvetica').text(`  Closing balance: ${fmtCurrency(s.closingBalance)}`);
        doc.text(`  Date range: ${fmtDate(s.firstDateISO)} – ${fmtDate(s.lastDateISO)}`);
        doc.moveDown(0.2);
      });
      if (payload.statement.statements.length > 1) {
        doc.moveDown(0.2);
        doc.font('Helvetica-Bold').text('Combined total');
        doc.font('Helvetica').text(`  ${fmtCurrency(payload.statement.combinedClosingBalance)}`);
        doc.text(`  Date range: ${fmtDate(payload.statement.earliestDateISO)} – ${fmtDate(payload.statement.latestDateISO)}`);
      }
    } else {
      doc.text('No bank statement analyzed yet.');
    }

    doc.moveDown(1);
    doc.fontSize(8).fillColor('#999999').text(
      'This report reflects what you have entered in Smooth Application at the time it was generated. It is a personal preparation aid, not a guarantee of visa approval.',
      { align: 'left' }
    );

    doc.end();
  });
}
