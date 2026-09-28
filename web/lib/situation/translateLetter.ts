// Task #415 follow-up (direct request): "For letters in other languages, translate them and tell
// the applicant the reason." The applicant explicitly asked for this to happen "in the app" rather
// than sending them off to translate it themselves — see the CHANGELOG entry for the full
// trade-off discussion. Everything ELSE in this reading aid (OCR, PDF text extraction, word
// frequency, reason matching) runs 100% on-device; this file is the one deliberate exception,
// since no on-device translation model could be installed/verified from this project's current dev
// setup in time to ship. It calls MyMemory (https://mymemory.translated.net), a free, keyless
// translation API — no account, no API key, no billing to set up. In exchange, this DOES send the
// letter's extracted text to that third-party service, which nothing else in this feature does.
// SituationGate.tsx discloses this to the applicant before they click the button that triggers it.
//
// CLIENT-ONLY: only import this from a 'use client' component, same as extractLetterText.ts.

// MyMemory's anonymous (keyless) tier isn't documented with a hard per-request character cap, but
// informal testing (and community reports) puts it comfortably over 500 characters per request —
// chunking well under that keeps every request safely inside whatever the real limit is, and also
// keeps a slow connection's retries small.
const MAX_CHUNK_CHARS = 480;

const MYMEMORY_ENDPOINT = 'https://api.mymemory.translated.net/get';

export class TranslationError extends Error {}

/** Splits `text` into chunks no longer than `maxChars`, breaking on paragraph boundaries first and
 * falling back to sentence boundaries for any single paragraph that's still too long, so a
 * translation request is never cut off mid-sentence. Pure and exported for its own unit tests. */
export function chunkLetterText(text: string, maxChars = MAX_CHUNK_CHARS): string[] {
  const paragraphs = text
    .split(/\n{2,}|\n/)
    .map((p) => p.trim())
    .filter(Boolean);

  const chunks: string[] = [];
  let current = '';

  const flushCurrent = () => {
    if (current.trim()) chunks.push(current.trim());
    current = '';
  };

  for (const para of paragraphs) {
    const candidate = current ? `${current}\n${para}` : para;
    if (candidate.length <= maxChars) {
      current = candidate;
      continue;
    }
    flushCurrent();
    if (para.length <= maxChars) {
      current = para;
      continue;
    }
    // A single paragraph longer than maxChars on its own — split it by sentence instead.
    const sentences = para.split(/(?<=[.!?])\s+/);
    let sentenceChunk = '';
    for (const sentence of sentences) {
      const candidateSentence = sentenceChunk ? `${sentenceChunk} ${sentence}` : sentence;
      if (candidateSentence.length <= maxChars) {
        sentenceChunk = candidateSentence;
        continue;
      }
      if (sentenceChunk) chunks.push(sentenceChunk.trim());
      // Even a single sentence can exceed maxChars (rare, but possible with OCR noise/no
      // punctuation) — hard-truncate rather than send an oversized request that might fail.
      sentenceChunk = sentence.length <= maxChars ? sentence : sentence.slice(0, maxChars);
    }
    if (sentenceChunk) chunks.push(sentenceChunk.trim());
  }
  flushCurrent();
  return chunks;
}

interface MyMemoryResponse {
  responseStatus?: number | string;
  responseDetails?: string;
  responseData?: { translatedText?: string };
}

/** Translates `text` from `sourceLang` (an ISO 639-1 code like 'fr', as returned by
 * detectNonEnglishLanguage in letterAnalysis.ts) into English via MyMemory's free API. Chunks
 * long text first (see chunkLetterText) and translates each chunk in sequence, then rejoins with
 * paragraph breaks. Throws TranslationError on any failure — callers should catch this and show
 * the applicant a plain "couldn't translate, here's the original text" fallback rather than a raw
 * error. */
export async function translateToEnglish(text: string, sourceLang: string): Promise<string> {
  const chunks = chunkLetterText(text);
  if (chunks.length === 0) return '';

  const translatedChunks: string[] = [];
  for (const chunk of chunks) {
    const url = `${MYMEMORY_ENDPOINT}?q=${encodeURIComponent(chunk)}&langpair=${encodeURIComponent(
      sourceLang
    )}|en`;
    let res: Response;
    try {
      res = await fetch(url);
    } catch {
      throw new TranslationError('Could not reach the translation service — check your connection and try again.');
    }
    if (!res.ok) {
      throw new TranslationError(`Translation service responded with an error (${res.status}).`);
    }
    let data: MyMemoryResponse;
    try {
      data = await res.json();
    } catch {
      throw new TranslationError('Translation service returned an unexpected response.');
    }
    if (data.responseStatus && Number(data.responseStatus) !== 200) {
      throw new TranslationError(data.responseDetails || 'Translation service returned an error.');
    }
    const piece = data.responseData?.translatedText;
    if (typeof piece !== 'string' || !piece.trim()) {
      throw new TranslationError('Translation service returned an empty result.');
    }
    translatedChunks.push(piece.trim());
  }
  return translatedChunks.join('\n\n');
}
