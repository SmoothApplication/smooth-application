// Browser-only file intake for the situation gate's refusal-letter reading aid — turns a File
// (PDF or photo) into plain extracted text, reusing the exact same on-device pipelines already
// built for bank statements and passport scans rather than a third separate one.
//
// This module is CLIENT-ONLY — see the CLIENT-ONLY notices on the two modules it reuses. Only
// import it from a 'use client' component (see components/checklist/SituationGate.tsx).
//
// Ported from index.html's scanRefusalLetterText (~line 16432): a PDF is read via its text layer
// only (getLinesFromPdf, no OCR fallback — mirrors index.html's own behavior here, unlike the
// passport path which DOES fall back to OCR for a scanned/image PDF, because a refusal letter is
// virtually always a text-layer PDF or a plain photo, never a scanned image saved as PDF); an
// image is OCR'd via the same Tesseract.js pipeline the passport scan uses. Reusing
// getLinesFromPdf/getImageFromFile/preprocessImageForOcr/recognizeText rather than duplicating
// pdf.js/Tesseract wiring a third time in this codebase.

import { getLinesFromPdf } from '@/lib/statement/extractFile';
import { getImageFromFile, preprocessImageForOcr, recognizeText } from '@/lib/passport/extractText';

export async function extractLetterText(file: File): Promise<string> {
  if (file.type === 'application/pdf' || /\.pdf$/i.test(file.name || '')) {
    const lines = await getLinesFromPdf(file);
    return lines.map((l) => l.text).join('\n');
  }
  if (file.type.startsWith('image/') || /\.(jpe?g|png|heic|heif|webp|bmp|gif)$/i.test(file.name || '')) {
    const canvas = await getImageFromFile(file);
    const processed = preprocessImageForOcr(canvas);
    return recognizeText(processed);
  }
  throw new Error('Please upload a PDF or an image (JPG/PNG).');
}
