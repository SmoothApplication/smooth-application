// Remita payroll narrations cut the employer's name short ("NIGERIAN U"). Show it with a clear label instead of
// leaving a half-name that looks like a parsing error.
export function looksTruncatedEmployerName(name: string): boolean {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (!words.length) return false;
  return words[words.length - 1].length <= 2 && !/^allowances/i.test(name);
}

export function employerLabelNote(name: string): string | null {
  return looksTruncatedEmployerName(name) ? 'Employer (via Remita) - your bank cuts the full name short' : null;
}
