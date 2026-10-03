// Browser-only: turns an uploaded PDF or photo into plain text, using the same on-device reader (with OCR
// fallback for scanned files) as the bank statements. Nothing is uploaded.
export async function readDocumentText(file: File): Promise<string> {
  const { getLinesFromFile } = await import('@/lib/statement/extractFile');
  const lines = await getLinesFromFile(file);
  return lines.map((l) => l.text).join('\n');
}
