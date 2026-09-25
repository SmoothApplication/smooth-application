// Copies pdfjs-dist's worker build into public/ so the browser can fetch it as a plain static
// asset at a fixed path (/pdf.worker.min.mjs), instead of letting webpack bundle+minify it.
//
// Why this exists: pdf.js's worker file is itself an ES module and uses `import.meta`. Letting
// Next.js's webpack config pull it in via `new URL('pdfjs-dist/.../pdf.worker.min.mjs',
// import.meta.url)` (pdf.js's own documented "bundler" pattern) makes webpack emit it as a
// client asset, but Next's production Terser pass then tries to minify that asset as a plain
// (non-module) script and fails with "'import.meta' cannot be used outside module code" —
// `next build` cannot be made to succeed with that approach. Serving the file byte-for-byte
// from public/ instead sidesteps webpack/Terser for this one file entirely: the browser loads it
// directly, unminified-by-us (pdf.js ships it already minified) and untouched by our bundler.
//
// Runs on `npm install` (see package.json's postinstall) so the copy in public/ always matches
// whatever pdfjs-dist version is installed — nobody has to remember to re-copy it after a
// `npm update pdfjs-dist`.
const fs = require('fs');
const path = require('path');

const src = path.join(__dirname, '..', 'node_modules', 'pdfjs-dist', 'legacy', 'build', 'pdf.worker.min.mjs');
const destDir = path.join(__dirname, '..', 'public');
const dest = path.join(destDir, 'pdf.worker.min.mjs');

if (!fs.existsSync(src)) {
  // pdfjs-dist not installed (e.g. a workspace/CI step that skipped optional deps) — nothing to
  // copy. Don't fail the install over it; getLinesFromPdf will simply 404 on the worker at
  // runtime if this ever happens somewhere it's needed.
  console.warn('[copy-pdf-worker] pdfjs-dist worker not found at', src, '- skipping copy.');
  process.exit(0);
}

fs.mkdirSync(destDir, { recursive: true });
fs.copyFileSync(src, dest);
console.log('[copy-pdf-worker] copied', src, '->', dest);
