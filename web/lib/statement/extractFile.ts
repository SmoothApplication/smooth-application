// Browser-only file intake for the bank-statement pipeline: turns a File (PDF or spreadsheet)
// into the `Line[]` shape the pure parsing/classification engine (./index) already consumes.
//
// This module is CLIENT-ONLY — it touches File.arrayBuffer(), pdf.js's worker/canvas-free text
// extraction, and SheetJS, none of which exist during a Next.js server render or static build.
// Only import it from a 'use client' component (see components/checklist/StatementUpload.tsx).
//
// Ported from index.html's getLinesFromPdf/linesFromWorkbook/getLinesFromFile (~lines 10882-10990,
// see PORTING NOTES in that file for the OCR/image fallback this phase deliberately drops).
// linesFromTextContent and isSpreadsheetFile are pure enough that Phase 1 already ported them into
// ./columns — reused here rather than duplicated.

import type { Line } from './types';
import { linesFromTextContent, isSpreadsheetFile } from './columns';

// A 6-month statement from a busy account can run 25-30+ pages; text-layer extraction is cheap
// enough per page that a generous cap is safe. Matches index.html's MAX_TEXT_PAGES. OCR fallback
// (index.html's MAX_OCR_PAGES / Tesseract path) is intentionally NOT ported in this phase — a
// scanned/image PDF with too little extractable text just yields whatever the text layer has,
// even if that's sparse or empty; the caller surfaces "found 0 transactions" in that case.
const MAX_TEXT_PAGES = 150;

/** Turn a parsed SheetJS workbook into the same {text, parts} line shape pdf.js lines use, so every
 * downstream function (detectColumns, parseStatementLinesWithFallback, …) works unchanged regardless
 * of source format. Column index * 100 stands in for x-position — nearest-column matching only needs
 * a consistent relative ordering, not real coordinates. */
export function linesFromWorkbook(wb: {
  SheetNames: string[];
  Sheets: Record<string, unknown>;
}): Line[] {
  // Lazy require so this file can still be imported without xlsx having run its own module-scope
  // side effects during SSR/build (xlsx itself is pure JS, but keeping the pattern consistent with
  // getLinesFromPdf's dynamic pdfjs-dist import below avoids two different loading strategies).
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const XLSX = require('xlsx') as typeof import('xlsx');
  const lines: Line[] = [];
  wb.SheetNames.forEach((sheetName) => {
    const sheet = wb.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json(sheet as never, {
      header: 1,
      raw: false,
      defval: '',
    }) as unknown[][];
    rows.forEach((row) => {
      const parts: { x: number; str: string }[] = [];
      row.forEach((cell, idx) => {
        const str = cell === null || cell === undefined ? '' : String(cell).trim();
        if (str) parts.push({ x: idx * 100, str });
      });
      if (!parts.length) return;
      lines.push({ text: parts.map((p) => p.str).join(' '), parts });
    });
  });
  return lines;
}

// WORKER SETUP — this is the part most likely to bite the next engineer, read before changing it.
//
// pdf.js's own documented "bundler" pattern is:
//   pdfjsLib.GlobalWorkerOptions.workerSrc =
//     new URL('pdfjs-dist/legacy/build/pdf.worker.min.mjs', import.meta.url).toString();
// which relies on webpack 5's asset-module convention to emit the worker as a static asset and
// rewrite the URL. That DOES resolve correctly here, but it broke `next build`: the worker file
// is itself an ES module (it uses `import.meta` internally), and Next's production build runs the
// resulting asset through Terser as a plain script, which fails with "'import.meta' cannot be used
// outside module code" — the build cannot be made to pass with this approach.
//
// What works: serve the worker as a plain static file from public/, referenced by a fixed
// absolute path, so webpack/Terser never touch it at all. scripts/copy-pdf-worker.js copies
// node_modules/pdfjs-dist/legacy/build/pdf.worker.min.mjs -> public/pdf.worker.min.mjs on every
// `npm install` (see package.json's postinstall), so this path and the installed pdfjs-dist
// version can't drift apart silently.
let pdfjsConfigured = false;
async function loadPdfjs() {
  const pdfjsLib = await import('pdfjs-dist/legacy/build/pdf.mjs');
  if (!pdfjsConfigured) {
    pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs';
    pdfjsConfigured = true;
  }
  return pdfjsLib;
}

/** Extract `Line[]` from a PDF File via pdf.js's text layer, bucketed by y-position into physical
 * lines (linesFromTextContent, ported in Phase 1). No OCR fallback in this phase — a scanned/image
 * PDF with no text layer simply yields very few or no lines. */
export async function getLinesFromPdf(file: File): Promise<Line[]> {
  const pdfjsLib = await loadPdfjs();
  const buf = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: buf }).promise;
  const maxPages = Math.min(pdf.numPages, MAX_TEXT_PAGES);
  const pagePromises: Promise<Line[]>[] = [];
  for (let p = 1; p <= maxPages; p++) {
    pagePromises.push(
      pdf.getPage(p).then(async (page) => {
        const tc = await page.getTextContent();
        const lines = linesFromTextContent(tc as never);
        lines.forEach((l) => {
          l.__page = p;
        });
        return lines;
      })
    );
  }
  const pagesLines = await Promise.all(pagePromises);
  return ([] as Line[]).concat(...pagesLines);
}

/** Dispatches by file type/extension (pdf vs xlsx/xls, via isSpreadsheetFile from ./columns) and
 * returns the resulting `Line[]`. Throws for anything else (images/OCR are out of scope this
 * phase). */
export async function getLinesFromFile(file: File): Promise<Line[]> {
  if (file.type === 'application/pdf' || /\.pdf$/i.test(file.name || '')) {
    return getLinesFromPdf(file);
  }
  if (isSpreadsheetFile(file)) {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const XLSX = require('xlsx') as typeof import('xlsx');
    const buf = await file.arrayBuffer();
    const wb = XLSX.read(new Uint8Array(buf), { type: 'array' });
    return linesFromWorkbook(wb);
  }
  throw new Error('Unsupported file type: ' + file.name);
}
