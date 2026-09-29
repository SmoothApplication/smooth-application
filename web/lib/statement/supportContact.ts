// Direct request, launch day: "how do we get an update or an alert when an applicant is having
// difficulty reading his or her bank statement?" The statement parser runs entirely on-device (see
// extractFile.ts's own privacy comment) — nothing about a failed parse ever reaches a server, so a
// dashboard count (GoatCounter's statement_analysis:failed_* events, added alongside this) can only
// ever be checked after the fact, not alerted on in real time. This is the real-time half: reusing
// the exact same zero-backend wa.me pattern already used everywhere else in this app (resumeReminder.ts,
// TravelHistory.tsx's own "I don't have travel history yet" link) to put a "message us now" button
// directly next to the error, so a stuck applicant can alert a human with one tap — never automatic,
// never silent, and never carrying the statement itself or anything extracted from it.
export const FOUNDER_WHATSAPP_NUMBER = '2349081389969';

export type StatementFailureReason = 'no_text' | 'no_transactions' | 'exception';

const REASON_TEXT: Record<StatementFailureReason, string> = {
  no_text: "the app couldn't read any text at all from my bank statement file (including OCR)",
  no_transactions: "the app read my file but couldn't find any transactions in it",
  exception: 'the app hit an error while reading my bank statement',
};

// Deliberately says WHAT went wrong (so a human can start diagnosing immediately) but never
// attaches or describes the statement's own contents — the applicant chooses whether to share the
// actual file only after this message opens their WhatsApp.
export function buildStatementHelpMessage(reason: StatementFailureReason, visaName?: string | null): string {
  return [
    `Hi! I'm using Smooth Application${visaName ? ` for my ${visaName}` : ''} and I'm stuck: ${REASON_TEXT[reason]}.`,
    '',
    "I haven't attached the statement here — just flagging so someone can help me figure out the right way to upload it.",
  ].join('\n');
}

export function buildStatementHelpWhatsAppHref(reason: StatementFailureReason, visaName?: string | null): string {
  return `https://wa.me/${FOUNDER_WHATSAPP_NUMBER}?text=${encodeURIComponent(
    buildStatementHelpMessage(reason, visaName)
  )}`;
}
