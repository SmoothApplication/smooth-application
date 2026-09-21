// Thin Resend wrapper — two email types only for now (see docs/EMAIL_COPY.md for full text):
//  1. "Create your password" — fired the moment an applicant drops their email anywhere in the
//     flow (see app/api/capture-email/route.ts).
//  2. "Finish your checklist" — fired by the reminder cron (scripts/send-reminders.js) for anyone
//     inactive N days with an incomplete checklist.
import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY!);

const FROM = process.env.RESEND_FROM_EMAIL || 'Smooth Application <hello@smoothapplication.com>';

export async function sendCreatePasswordEmail(opts: {
  to: string;
  setPasswordUrl: string;
  country?: string | null;
  sessionLabel?: string | null;
}) {
  const { to, setPasswordUrl, country, sessionLabel } = opts;
  return resend.emails.send({
    from: FROM,
    to,
    subject: 'Save your Smooth Application progress — create a password',
    html: `
      <p>Hi,</p>
      <p>You're partway through your${country ? ' ' + country : ''} visa document checklist${
        sessionLabel ? ' (currently on: ' + sessionLabel + ')' : ''
      } on Smooth Application.</p>
      <p><b>Create a password</b> so you can view your saved progress and pick up exactly where you left off, on any device:</p>
      <p><a href="${setPasswordUrl}" style="display:inline-block;background:#0b7a6e;color:#fff;padding:10px 20px;border-radius:6px;text-decoration:none;">Create my password</a></p>
      <p style="color:#666;font-size:13px;">We only save your email and which step you've reached — never your passport number, bank details, or other answers. Those stay only in your own browser, same as always.</p>
    `,
  });
}

export async function sendIncompleteReminderEmail(opts: {
  to: string;
  percentComplete: number;
  resumeUrl: string;
  country?: string | null;
}) {
  const { to, percentComplete, resumeUrl, country } = opts;
  return resend.emails.send({
    from: FROM,
    to,
    subject: `You're ${percentComplete}% done with your${country ? ' ' + country : ''} visa checklist`,
    html: `
      <p>Hi,</p>
      <p>Just a nudge — you're <b>${percentComplete}% through</b> your${country ? ' ' + country : ''} visa document checklist on Smooth Application, and haven't been back in a while.</p>
      <p><a href="${resumeUrl}" style="display:inline-block;background:#0b7a6e;color:#fff;padding:10px 20px;border-radius:6px;text-decoration:none;">Pick up where I left off</a></p>
      <p style="color:#666;font-size:13px;">If you've already finished elsewhere or this no longer applies to you, you can ignore this — we'll stop emailing once your checklist is complete.</p>
    `,
  });
}
