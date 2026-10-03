// Consultant due-diligence notes ("dental clinic in Lagos - real"): typed on a sender's card, shown
// there, and carried into the downloaded sheet. Stored inside the existing per-sender `explanations`
// record under a prefixed key, so they persist and restore exactly like the reason answers do with no
// new storage plumbing. Entirely on-device; nothing is looked up or sent anywhere.
export const RESEARCH_NOTE_PREFIX = 'note::';

export function researchNoteKey(groupName: string): string {
  return RESEARCH_NOTE_PREFIX + groupName;
}

export function getResearchNote(explanations: Record<string, string>, groupName: string): string {
  return (explanations[researchNoteKey(groupName)] || '').trim();
}
