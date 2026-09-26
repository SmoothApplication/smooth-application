'use client';

import { useEffect, useState } from 'react';
import { buildResumeReminderMessage, buildWhatsAppReminderHref, buildEmailReminderHref } from '@/lib/checklist/resumeReminder';

// Port of index.html's "WhatsApp/email myself a reminder" (task #319+ selection "WhatsApp/phone
// resume reminders") — offered right at the two friction points field work flagged: the passport
// scan and the bank-statement upload, not just at the final review. See
// lib/checklist/resumeReminder.ts for the message/href builders and the full design rationale.
//
// The resume link needs `window.location`, so it's computed client-side after mount rather than
// during server render — this renders nothing until then, same "wait for the browser" pattern as
// every other localStorage-dependent piece of this app.
export type ResumeReminderLinksProps = {
  visaName: string;
  whatToBring: string;
  prompt: string;
};

export default function ResumeReminderLinks({ visaName, whatToBring, prompt }: ResumeReminderLinksProps) {
  const [resumeUrl, setResumeUrl] = useState('');

  useEffect(() => {
    setResumeUrl(window.location.origin + window.location.pathname);
  }, []);

  if (!resumeUrl) return null;

  const message = buildResumeReminderMessage(visaName, whatToBring, resumeUrl);

  return (
    <div className="rounded-lg bg-accent-wash/40 p-3 text-sm text-[#4c6270]">
      <p>{prompt}</p>
      <div className="mt-2 flex flex-wrap gap-2">
        <a
          href={buildWhatsAppReminderHref(message)}
          target="_blank"
          rel="noopener noreferrer"
          className="rounded-lg border border-accent/40 px-3 py-1.5 text-xs font-medium text-accent"
        >
          📱 WhatsApp myself a reminder
        </a>
        <a href={buildEmailReminderHref(message)} className="rounded-lg border border-accent/40 px-3 py-1.5 text-xs font-medium text-accent">
          ✉️ Email myself a reminder
        </a>
      </div>
    </div>
  );
}
