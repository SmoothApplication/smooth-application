'use client';

import { useEffect, useRef, useState } from 'react';
import {
  getImageFromFile,
  preprocessImageForOcr,
  recognizeText,
} from '@/lib/passport/extractText';
import { parseMrzFields, validateMrz, mrzCheckSummary, ParsedPassportFields } from '@/lib/passport';

// Phase 2 of the passport-MRZ port (see lib/passport/index.ts for Phase 1's pure parsing engine).
// Standalone test surface only: proves camera/file capture -> OCR (Tesseract.js) -> the pure
// parse/validate engine -> editable fields works end-to-end in a real browser, before this gets
// wired into the actual checklist flow in a later phase. Not linked from anywhere yet; reached
// directly at /checklist/passport-test.
//
// Privacy: matches the promise already made on /checklist/start ("🔒 Your documents never leave
// your device") — the photo is captured and OCR'd entirely in this tab via Tesseract.js running
// in the browser (WebAssembly), never uploaded anywhere. The photo/canvas itself is never kept
// past the OCR pass that reads it — only the resulting text fields are kept in memory here.

// Same threshold as index.html's camera-capture averageBrightness check (~line 6905): a captured
// still whose average luminance falls below this is rejected as "too dark to bother OCRing" and
// the applicant is asked to retake it, rather than burning a 20-30s OCR pass on an unreadable shot.
const BRIGHTNESS_THRESHOLD = 55;

interface FieldState {
  fullName: string;
  birthDate: string;
  passportNumber: string;
  nationality: string;
  sex: string;
  expiryDate: string;
}

const EMPTY_FIELDS: FieldState = {
  fullName: '',
  birthDate: '',
  passportNumber: '',
  nationality: '',
  sex: '',
  expiryDate: '',
};

function formatDateForInput(d: Date | null): string {
  if (!d || Number.isNaN(d.getTime())) return '';
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

function fieldsFromParsed(parsed: ParsedPassportFields | null): FieldState {
  if (!parsed) return { ...EMPTY_FIELDS };
  return {
    fullName: parsed.fullName || '',
    birthDate: formatDateForInput(parsed.birthDate),
    passportNumber: parsed.passportNumber || '',
    nationality: parsed.nationality || '',
    sex: parsed.sex || '',
    expiryDate: formatDateForInput(parsed.expiryDate),
  };
}

/** Average luminance of a small downsampled copy of a captured still — cheap enough to run once
 * per capture without pulling in a whole exposure-metering library for what's really a single
 * yes/no "is this too dark to bother OCRing" check. Ported from index.html's averageBrightness
 * (~line 6874). */
function averageBrightness(canvas: HTMLCanvasElement): number {
  const sampleW = 80;
  const sampleH = Math.max(1, Math.round(sampleW * (canvas.height / (canvas.width || 1))));
  const s = document.createElement('canvas');
  s.width = sampleW;
  s.height = sampleH;
  const sctx = s.getContext('2d');
  if (!sctx) return 128; // fail open — don't block a capture just because we couldn't measure it
  sctx.drawImage(canvas, 0, 0, s.width, s.height);
  let data: Uint8ClampedArray;
  try {
    data = sctx.getImageData(0, 0, s.width, s.height).data;
  } catch {
    return 128;
  }
  let total = 0;
  let count = 0;
  for (let i = 0; i < data.length; i += 4) {
    total += 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
    count++;
  }
  return count ? total / count : 128;
}

export default function PassportScan() {
  const [cameraSupported, setCameraSupported] = useState(true);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [retakeMsg, setRetakeMsg] = useState<string | null>(null);
  const [ocrLoading, setOcrLoading] = useState(false);
  const [ocrError, setOcrError] = useState<string | null>(null);
  const [summary, setSummary] = useState<string | null>(null);
  const [autoFilled, setAutoFilled] = useState(false);
  const [fields, setFields] = useState<FieldState>({ ...EMPTY_FIELDS });

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (typeof navigator === 'undefined' || !navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setCameraSupported(false);
    }
    return () => {
      stopCamera();
      // eslint-disable-next-line react-hooks/exhaustive-deps
    };
  }, []);

  function stopCamera() {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
  }

  async function openCamera() {
    setCameraError(null);
    setRetakeMsg(null);
    setCameraOpen(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: { ideal: 1920 }, height: { ideal: 1080 } },
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play().catch(() => {});
      }
    } catch {
      setCameraOpen(false);
      setCameraError(
        "Couldn't access your camera (permission declined, or none found) — use the file upload below to add a photo instead."
      );
    }
  }

  function closeCamera() {
    stopCamera();
    setCameraOpen(false);
  }

  async function handleCapture() {
    const video = videoRef.current;
    if (!video || !video.videoWidth) return;
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    if (averageBrightness(canvas) < BRIGHTNESS_THRESHOLD) {
      setRetakeMsg(
        "That looks quite dark — try moving somewhere brighter, or shine a light/torch on the passport, then capture again."
      );
      return;
    }
    setRetakeMsg(null);
    closeCamera();
    await runOcr(canvas);
  }

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    closeCamera();
    setOcrError(null);
    setOcrLoading(true);
    setSummary(null);
    setAutoFilled(false);
    try {
      const canvas = await getImageFromFile(file);
      await runOcr(canvas);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setOcrError(
        `Something went wrong while reading that file (${message}). Try a different photo, or fill in the fields below by hand.`
      );
      setFields({ ...EMPTY_FIELDS });
      setOcrLoading(false);
    }
  }

  async function runOcr(rawCanvas: HTMLCanvasElement) {
    setOcrError(null);
    setOcrLoading(true);
    setSummary(null);
    setAutoFilled(false);
    try {
      const canvas = preprocessImageForOcr(rawCanvas);
      const text = await recognizeText(canvas);
      const parsed = parseMrzFields(text);
      const mrz = validateMrz(text);
      const summaryText = mrzCheckSummary(mrz);
      setSummary(summaryText);

      if (parsed && (parsed.fullName || parsed.passportNumber)) {
        setFields(fieldsFromParsed(parsed));
        setAutoFilled(true);
      } else {
        setFields({ ...EMPTY_FIELDS });
        setAutoFilled(false);
        setOcrError("We couldn't read this automatically — please fill in the fields below.");
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setOcrError(
        `Something went wrong while reading that photo (${message}). Try again, or fill in the fields below by hand.`
      );
      setFields({ ...EMPTY_FIELDS });
    } finally {
      setOcrLoading(false);
    }
  }

  function updateField(key: keyof FieldState, value: string) {
    setFields((f) => ({ ...f, [key]: value }));
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-4xl flex-col gap-5 p-8">
      <div>
        <h1 className="text-xl font-semibold text-[#12232e]">Passport scan (test page)</h1>
        <p className="mt-1 text-sm text-[#4c6270]">
          Photograph or upload your passport's photo page and we'll try to read the details automatically.
        </p>
      </div>

      <span className="w-fit rounded-full bg-accent-wash px-3 py-1 text-xs font-medium text-accent">
        🔒 Processed entirely in your browser — this photo is never uploaded anywhere, and it's
        discarded as soon as it's read. Only the fields below are kept.
      </span>

      <div className="rounded-2xl border border-black/10 bg-white p-6 shadow-sm">
        {cameraSupported && !cameraOpen && (
          <button
            type="button"
            onClick={openCamera}
            className="mb-3 rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white transition"
          >
            Use camera
          </button>
        )}

        {cameraError && (
          <div className="mb-3 rounded-lg bg-warn-wash p-3 text-sm text-warn-text" role="alert">
            {cameraError}
          </div>
        )}

        {cameraOpen && (
          <div className="mb-4 flex flex-col gap-3">
            <p className="text-sm text-[#4c6270]">
              Hold your passport's photo page flat and steady, with the strip of text at the bottom
              (the MRZ) inside the frame, then capture.
            </p>
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className="w-full max-w-xl rounded-lg border border-black/10 bg-black"
            />
            {retakeMsg && (
              <div className="rounded-lg bg-warn-wash p-3 text-sm text-warn-text" role="alert">
                ⚠ {retakeMsg}
              </div>
            )}
            <div className="flex gap-2">
              <button
                type="button"
                onClick={handleCapture}
                className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white transition"
              >
                Capture
              </button>
              <button
                type="button"
                onClick={closeCamera}
                className="rounded-lg border border-black/10 px-4 py-2 text-sm font-medium text-[#12232e] transition"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        <label className="mb-2 block text-sm font-medium text-[#12232e]" htmlFor="passport-file">
          {cameraSupported ? 'Or upload a photo/PDF of the photo page' : 'Upload a photo/PDF of the photo page'}
        </label>
        <input
          ref={fileInputRef}
          id="passport-file"
          type="file"
          accept="image/*,.pdf"
          onChange={handleFileChange}
          className="block w-full text-sm text-[#12232e] file:mr-3 file:rounded-lg file:border-0 file:bg-accent-wash file:px-3 file:py-2 file:text-sm file:font-medium file:text-accent hover:file:bg-accent/10"
        />
      </div>

      {ocrLoading && (
        <div className="flex items-center gap-3 rounded-lg bg-accent-wash p-3 text-sm text-accent" role="status">
          <span
            className="h-4 w-4 animate-spin rounded-full border-2 border-accent border-t-transparent"
            aria-hidden="true"
          />
          Reading the photo — this can take a few seconds…
        </div>
      )}

      {ocrError && (
        <div className="rounded-lg bg-warn-wash p-3 text-sm text-warn-text" role="alert">
          {ocrError}
        </div>
      )}

      {(autoFilled || ocrError || summary) && (
        <div className="rounded-2xl border border-black/10 bg-white p-6 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-[#12232e]">Passport details</h2>
            {summary && <span className="text-xs text-[#566a76]">MRZ check: {summary}</span>}
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-medium text-[#566a76]" htmlFor="pf-fullname">
                Full name
              </label>
              <input
                id="pf-fullname"
                type="text"
                value={fields.fullName}
                onChange={(e) => updateField('fullName', e.target.value)}
                className="w-full rounded-lg border border-black/10 px-3 py-2 text-sm text-[#12232e]"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-[#566a76]" htmlFor="pf-dob">
                Date of birth
              </label>
              <input
                id="pf-dob"
                type="date"
                value={fields.birthDate}
                onChange={(e) => updateField('birthDate', e.target.value)}
                className="w-full rounded-lg border border-black/10 px-3 py-2 text-sm text-[#12232e]"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-[#566a76]" htmlFor="pf-number">
                Passport number
              </label>
              <input
                id="pf-number"
                type="text"
                value={fields.passportNumber}
                onChange={(e) => updateField('passportNumber', e.target.value)}
                className="w-full rounded-lg border border-black/10 px-3 py-2 text-sm text-[#12232e]"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-[#566a76]" htmlFor="pf-nationality">
                Nationality
              </label>
              <input
                id="pf-nationality"
                type="text"
                value={fields.nationality}
                onChange={(e) => updateField('nationality', e.target.value)}
                className="w-full rounded-lg border border-black/10 px-3 py-2 text-sm text-[#12232e]"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-[#566a76]" htmlFor="pf-sex">
                Sex
              </label>
              <input
                id="pf-sex"
                type="text"
                value={fields.sex}
                onChange={(e) => updateField('sex', e.target.value)}
                className="w-full rounded-lg border border-black/10 px-3 py-2 text-sm text-[#12232e]"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-[#566a76]" htmlFor="pf-expiry">
                Expiry date
              </label>
              <input
                id="pf-expiry"
                type="date"
                value={fields.expiryDate}
                onChange={(e) => updateField('expiryDate', e.target.value)}
                className="w-full rounded-lg border border-black/10 px-3 py-2 text-sm text-[#12232e]"
              />
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
