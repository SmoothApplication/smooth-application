// Public API of the MRZ (passport machine-readable zone) parsing/correction engine (pure logic
// only — no camera/OCR wiring, no React components, no persistence/localStorage). Ported from
// index.html.

export * from './types';
export * from './mrz';
export * from './dates';
export * from './persist';
export * from './validity';
