// Browser-only OCR intake for the passport-scan pipeline: turns a File (photo image or a scanned
// PDF) into raw OCR text for the pure MRZ parsing engine (./index) to consume.
//
// This module is CLIENT-ONLY — it touches File/Image/canvas APIs, pdf.js's worker setup, and
// Tesseract.js's worker/wasm pipeline, none of which exist during a Next.js server render or
// static build. Only import it from a 'use client' component (see
// components/checklist/PassportScan.tsx). Nothing here ever uploads the image anywhere: OCR runs
// entirely in the browser tab via Tesseract.js's WebAssembly build, and the canvas/image data is
// only ever held in memory for the duration of a single recognize() call.
//
// Ported from index.html's preprocessCanvasForOcr (~lines 10377-10418) and the OCR-recognition
// call sites around it. The camera-capture brightness check (averageBrightness, ~6874-6889) lives
// in the UI component instead since it's part of the capture UX, not text extraction.

// WORKER SETUP — same reasoning as lib/statement/extractFile.ts's loadPdfjs: pdf.js's own
// documented `new URL(..., import.meta.url)` bundler pattern breaks `next build` because the
// worker file itself uses `import.meta` and Next's production Terser pass can't minify that as a
// plain script. Reuse the exact same fixed static-asset path
// (public/pdf.worker.min.mjs, copied by scripts/copy-pdf-worker.js on every `npm install`)
// instead of reinventing a second worker-loading strategy.
let pdfjsConfigured = false;
async function loadPdfjs() {
  const pdfjsLib = await import('pdfjs-dist/legacy/build/pdf.mjs');
  if (!pdfjsConfigured) {
    pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs';
    pdfjsConfigured = true;
  }
  return pdfjsLib;
}

/** Draws an image File onto a plain canvas at its natural size. */
function imageFileToCanvas(file: File): Promise<HTMLCanvasElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.naturalWidth || img.width;
      canvas.height = img.naturalHeight || img.height;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        URL.revokeObjectURL(url);
        reject(new Error('Could not get canvas context'));
        return;
      }
      ctx.drawImage(img, 0, 0);
      URL.revokeObjectURL(url);
      resolve(canvas);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Could not load image'));
    };
    img.src = url;
  });
}

/** Renders the first page of a PDF File to a canvas via pdf.js — no text-layer extraction here
 * (a photographed/scanned passport photo page has no text layer to extract), the canvas is OCR'd
 * directly like any other image, same as index.html's PDF-passport path. */
async function pdfFileToCanvas(file: File): Promise<HTMLCanvasElement> {
  const pdfjsLib = await loadPdfjs();
  const buf = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: buf }).promise;
  const page = await pdf.getPage(1);
  // A higher render scale gives OCR more real pixels to work with, similar in spirit to
  // preprocessImageForOcr's own upscale step below — 2x is a reasonable default for a
  // photo-page-as-PDF without producing an unreasonably large canvas.
  const viewport = page.getViewport({ scale: 2 });
  const canvas = document.createElement('canvas');
  canvas.width = viewport.width;
  canvas.height = viewport.height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Could not get canvas context');
  await page.render({ canvasContext: ctx, viewport, canvas }).promise;
  return canvas;
}

/** Dispatches by file type/extension: image files are drawn straight to a canvas; PDF files have
 * their first page rendered to a canvas via pdf.js. Throws for anything else. */
export async function getImageFromFile(file: File): Promise<HTMLCanvasElement> {
  if (file.type === 'application/pdf' || /\.pdf$/i.test(file.name || '')) {
    return pdfFileToCanvas(file);
  }
  if (file.type.startsWith('image/') || /\.(jpe?g|png|heic|heif|webp|bmp|gif)$/i.test(file.name || '')) {
    return imageFileToCanvas(file);
  }
  throw new Error('Unsupported file type: ' + file.name);
}

// User report ported from index.html: a passport photo taken on a low-end phone came back "MRZ
// checksum: not detected" and the name never auto-filled, even though the photo was perfectly
// legible to a person — the MRZ is small, dense text, and a phone with a modest camera/no real
// focus assist tends to produce it at lower effective resolution and lower contrast than a proper
// scan, which is exactly what trips up OCR. Applied right before every OCR pass (purely in-memory
// — never stored, never shown): (1) upscale small images so the text has more real pixels to be
// read from, since Tesseract's accuracy drops sharply once character height gets small; (2)
// grayscale + a contrast STRETCH ("auto levels"), deliberately NOT hard black/white thresholding —
// a phone photo is often unevenly lit (a shadow across half the page, a glare spot on the
// laminate), and a single global threshold can blow out an entire section to solid black or
// white, whereas a stretch preserves that unevenness while still making genuinely light/dark
// pixels more distinct.
export function preprocessImageForOcr(canvas: HTMLCanvasElement): HTMLCanvasElement {
  const MIN_WIDTH = 1600;
  let out = canvas;
  if (canvas.width && canvas.width < MIN_WIDTH) {
    const scale = MIN_WIDTH / canvas.width;
    const scaled = document.createElement('canvas');
    scaled.width = Math.round(canvas.width * scale);
    scaled.height = Math.round(canvas.height * scale);
    const sctx = scaled.getContext('2d');
    if (sctx) {
      sctx.imageSmoothingEnabled = true;
      if ('imageSmoothingQuality' in sctx) sctx.imageSmoothingQuality = 'high';
      sctx.drawImage(canvas, 0, 0, scaled.width, scaled.height);
      out = scaled;
    }
  }
  const ctx = out.getContext('2d');
  if (!ctx) return out;
  let imgData: ImageData;
  try {
    imgData = ctx.getImageData(0, 0, out.width, out.height);
  } catch {
    // Can't read pixels back (e.g. a tainted canvas) — extremely unlikely here since every image
    // comes from a local file/camera capture the person made themselves, but fail open rather
    // than throw.
    return out;
  }
  const data = imgData.data;
  let min = 255;
  let max = 0;
  for (let i = 0; i < data.length; i += 4) {
    const gray = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
    data[i] = data[i + 1] = data[i + 2] = gray;
    if (gray < min) min = gray;
    if (gray > max) max = gray;
  }
  const range = max - min;
  if (range > 10) {
    // Skip stretching a near-blank/uniform image - nothing to gain, and dividing by a near-zero
    // range would amplify noise instead of real contrast.
    for (let j = 0; j < data.length; j += 4) {
      const v = ((data[j] - min) * 255) / range;
      data[j] = data[j + 1] = data[j + 2] = v;
    }
  }
  ctx.putImageData(imgData, 0, 0);
  return out;
}

/** Runs Tesseract.js OCR against a (preferably already-preprocessed) canvas and returns the raw
 * recognized text. Lazily imports tesseract.js so it's never pulled into a server bundle. */
export async function recognizeText(canvas: HTMLCanvasElement): Promise<string> {
  const Tesseract = await import('tesseract.js');
  const result = await Tesseract.recognize(canvas, 'eng');
  return result.data.text || '';
}
