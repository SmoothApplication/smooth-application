// Port of index.html's "WhatsApp/email myself a reminder" (buildResumeReminderMessage /
// updateResumeReminderLinks, ~line 6441-6478) — task #319+ selection "WhatsApp/phone resume
// reminders". Field-work finding: many applicants hit the passport-scan or bank-statement step
// away from home, without the document on them, on the same phone they're using right now, and
// simply forget to come back once they're home with it. Progress already survives a same-device
// return via localStorage, so the only real gap is the reminder itself.
//
// Deliberately short — just enough to get the applicant back to this page, not the full
// end-of-checklist status dump. WhatsApp is a real precomputed <a href>, not a JS location.href
// redirect on click (that pattern was already found broken for mailto: on phones with no mail app
// configured — see the original's own comment on the quiz notify-me flow).
export function buildResumeReminderMessage(visaName: string, whatToBring: string, resumeUrl: string): string {
  return [
    `Reminder to myself: finish my Smooth Application ${visaName} checklist.`,
    '',
    `What I need to have ready: ${whatToBring}`,
    '',
    `Continue where I left off: ${resumeUrl}`,
    '(My progress is saved automatically in this browser - open this link on the SAME phone to pick back up.)',
  ].join('\n');
}

export function buildWhatsAppReminderHref(message: string): string {
  return 'https://wa.me/?text=' + encodeURIComponent(message);
}

export function buildEmailReminderHref(message: string): string {
  return (
    'mailto:?subject=' +
    encodeURIComponent('Reminder: finish my Smooth Application checklist') +
    '&body=' +
    encodeURIComponent(message)
  );
}
