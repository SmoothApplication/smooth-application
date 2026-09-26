// Browser-only file intake for the bank-statement pipeline: turns a File (PDF or spreadsheet)
// into the `Line[]` shape the pure parsing/classification engine (./index) already consumes.
//
// This module is CLIENT-ONLY — it touches File.arrayBuffer(), pdf.js's worker/canvas-free text
// extraction, and SheetJS, none of which exist during a Next.js server render or static build.
// Only import it from a 'use client' component (see components/checklist/StatementUpload.tsx).
//
// Ported from index.html's getLinesFromPdf/linesFromWorkbook/getLinesFromFile (~lines 10882-10990).
//
// Follow-up selection "Scanned/photographed statement support": the OCR/image fallback this module
// originally deliberately dropped (see the old PORTING NOTES this comment replaces) is wired in
// below, reusing the exact same Tesseract.js pipeline already built for passport scans
// (getImageFromFile/preprocessImageForOcr/recognizeText, lib/passport/extractText.ts) rather than a
// third copy of that wiring — the refusal-letter reading aid (lib/situation/extractLetterText.ts)
// already does the same reuse. linesFromPlainText (./columns) was ported as part of Phase 1 but sat
// unused until now — OCR output has no per-word x-positions, so it's wrapped as lines with empty
// `parts`, same tradeoff as index.html's own OCR fallback (the parser's order/keyword/balance-delta
// heuristic in parse.ts already handles that shape; see parse.ts's own comments).
//
// linesFromTextContent and isSpreadsheetFile are pure enough that Phase 1 already ported them into
// ./columns — reused here rather than duplicated.

import type { Line } from './types';
import { linesFromTextContent, linesFromPlainText, isSpreadsheetFile } from './columns';
import { getImageFromFile, preprocessImageForOcr, recognizeText } from '@/lib/passport/extractText';

// A 6-month statement from a busy account can run 25-30+ pages; text-layer extraction is cheap
// enough per page that a generous cap is safe. Matches index.html's MAX_TEXT_PAGES.
const MAX_TEXT_PAGES = 150;

// OCR (only used as a scanned-PDF fallback, or for a direct photo) is far more expensive per page
// than reading a text layer, so it gets a lower cap of its own — matches index.html's own
// MAX_OCR_PAGES. A statement needing more than 20 OCR'd pages is rare, and asking for a text-layer
// PDF/Excel export instead is a reasonable ask at that point.
const MAX_OCR_PAGES = 20;
// Matches index.html's own threshold for "this PDF has a real text layer, don't bother with OCR" —
// a scanned/image PDF's text layer (when pdf.js finds one at all) is typically near-empty or just
// OCR-junk metadata, nowhere close to a real statement's page of transaction text.
const OCR_FALLBACK_CHAR_THRESHOLD = 200;

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
 * lines (linesFromTextContent, ported in Phase 1). No OCR fallback here — this stays a pure text-
 * layer read, same as before, since lib/situation/extractLetterText.ts also calls this directly and
 * deliberately does NOT want an OCR fallback for a refusal letter (mirrors index.html's own
 * behavior there). getLinesFromPdfWithOcrFallback below is the bank-statement-specific wrapper that
 * adds one. */
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

/** Renders one PDF page to a canvas at the given scale — same approach as index.html's own
 * pdfPageToCanvas and lib/passport/extractText.ts's pdfFileToCanvas, just parameterized by page
 * number so every page of a multi-page scanned statement can be rendered, not only the first. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function pdfPageToCanvas(page: any, scale: number): Promise<HTMLCanvasElement> {
  const viewport = page.getViewport({ scale });
  const canvas = document.createElement('canvas');
  canvas.width = viewport.width;
  canvas.height = viewport.height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Could not get canvas context');
  await page.render({ canvasContext: ctx, viewport, canvas }).promise;
  return canvas;
}

/** Bank-statement-specific wrapper around getLinesFromPdf: if the text layer came back essentially
 * empty (OCR_FALLBACK_CHAR_THRESHOLD), this is almost certainly a scanned/image PDF rather than a
 * genuine digital export, so fall back to OCR'ing each page as a photo (capped at MAX_OCR_PAGES,
 * same tradeoff index.html's own OCR fallback made — loses column x-positions, so the parser's
 * order/keyword/balance-delta heuristic takes over for these lines). Pages are OCR'd one at a time
 * (not in parallel) since each Tesseract.recognize() call is itself expensive; a 20-page scanned
 * statement can genuinely take a couple of minutes, same as it did in index.html. */
export async function getLinesFromPdfWithOcrFallback(file: File): Promise<Line[]> {
  const textLines = await getLinesFromPdf(file);
  const totalChars = textLines.reduce((n, l) => n + l.text.length, 0);
  if (totalChars > OCR_FALLBACK_CHAR_THRESHOLD) return textLines;

  const pdfjsLib = await loadPdfjs();
  const buf = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: buf }).promise;
  const maxPages = Math.min(pdf.numPages, MAX_OCR_PAGES);
  const pageTexts: string[] = [];
  for (let p = 1; p <= maxPages; p++) {
    const page = await pdf.getPage(p);
    const canvas = await pdfPageToCanvas(page, 2);
    const text = await recognizeText(preprocessImageForOcr(canvas));
    pageTexts.push(text);
  }
  return linesFromPlainText(pageTexts.join('\n'));
}

/** Extract `Line[]` from a single photographed/scanned statement image — same Tesseract.js pipeline
 * (with the same low-end-phone-photo preprocessing) already built for passport scans, reused here
 * rather than duplicated. Loses column x-positions like any OCR path, same tradeoff as above. */
export async function getLinesFromImageFile(file: File): Promise<Line[]> {
  const canvas = await getImageFromFile(file);
  const text = await recognizeText(preprocessImageForOcr(canvas));
  return linesFromPlainText(text);
}

/** Dispatches by file type/extension (pdf vs xlsx/xls, via isSpreadsheetFile from ./columns, vs a
 * photographed/scanned image) and returns the resulting `Line[]`. A PDF with too little extractable
 * text falls back to OCR automatically (getLinesFromPdfWithOcrFallback); an image file is always
 * OCR'd directly. Throws for anything else. */
export async function getLinesFromFile(file: File): Promise<Line[]> {
  if (file.type === 'application/pdf' || /\.pdf$/i.test(file.name || '')) {
    return getLinesFromPdfWithOcrFallback(file);
  }
  if (isSpreadsheetFile(file)) {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const XLSX = require('xlsx') as typeof import('xlsx');
    const buf = await file.arrayBuffer();
    const wb = XLSX.read(new Uint8Array(buf), { type: 'array' });
    return linesFromWorkbook(wb);
  }
  if (file.type.startsWith('image/') || /\.(jpe?g|png|heic|heif|webp|bmp|gif)$/i.test(file.name || '')) {
    return getLinesFromImageFile(file);
  }
  throw new Error('Unsupported file type: ' + file.name);
}
