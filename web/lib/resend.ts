// Thin Resend wrapper — email types (see docs/EMAIL_COPY.md for full text):
//  1. "Create your password" — fired the moment an applicant drops their email anywhere in the
//     flow (see app/api/capture-email/route.ts).
//  2. "Finish your checklist" — fired by the reminder cron (scripts/send-reminders.js) for anyone
//     inactive N days with an incomplete checklist.
//  3. "Reset your password" — task #419 (direct request, after seyiafeni@yahoo.co.uk got locked
//     out of /admin with no way back in): fired from app/api/request-password-reset/route.ts for
//     both admins and applicants.
//  4. "Your progress report" — task #421 (save/report-by-email redesign, direct request): the PDF
//     attachment for the applicant's own "email me a copy" request, fired from
//     app/api/email-report/route.ts. Ends with the same create-password action_link as email type 1
//     so a first-time requester can also set a password to come back to their saved progress later.
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

export async function sendPasswordResetEmail(opts: { to: string; resetUrl: string }) {
  const { to, resetUrl } = opts;
  return resend.emails.send({
    from: FROM,
    to,
    subject: 'Reset your Smooth Application password',
    html: `
      <p>Hi,</p>
      <p>Someone (hopefully you) asked to reset the password for this Smooth Application account.</p>
      <p><a href="${resetUrl}" style="display:inline-block;background:#0b7a6e;color:#fff;padding:10px 20px;border-radius:6px;text-decoration:none;">Reset my password</a></p>
      <p style="color:#666;font-size:13px;">This link only works once and expires after a while. If you didn't request this, you can safely ignore this email — your password hasn't been changed.</p>
    `,
  });
}

export async function sendReportEmail(opts: {
  to: string;
  pdfBuffer: Buffer;
  countryName: string;
  /** The create-password action_link, present only the first time this applicant's email is seen
   * (same find-or-invite pattern as capture-email/route.ts) — null for an applicant who already has
   * a password, since they don't need one made for them again. */
  setPasswordUrl: string | null;
  /** Fix 1 (technical-co-founder review, launch-day priority: "we need to know what happens after
   * someone downloads this"): three one-click GET links, each already carrying the opaque outcome
   * token and the result it records — the applicant does nothing but click whichever is true. Never
   * built from the applicant's email; see app/api/report-outcome/route.ts + migration
   * 0005_report_outcomes.sql for why (never put personal data in a URL). Optional so this function
   * still works, unchanged, for any future caller that doesn't have a token to attach. */
  outcomeLinks?: { applied: string; approved: string; refused: string } | null;
}) {
  const { to, pdfBuffer, countryName, setPasswordUrl, outcomeLinks } = opts;
  return resend.emails.send({
    from: FROM,
    to,
    subject: `Your ${countryName} visa checklist progress report`,
    html: `
      <p>Hi,</p>
      <p>Attached is a copy of your ${countryName} visa checklist progress — your responsibilities answers, document checklist status, financial readiness figures, and bank statement summary, exactly as they stand right now.</p>
      ${
        setPasswordUrl
          ? `<p><b>Create a password</b> so you can come back and pick up exactly where you left off, on any device — most applications take more than a day or two:</p>
             <p><a href="${setPasswordUrl}" style="display:inline-block;background:#0b7a6e;color:#fff;padding:10px 20px;border-radius:6px;text-decoration:none;">Create my password</a></p>`
          : `<p>You can sign back in any time to keep going.</p>`
      }
      <p style="color:#666;font-size:13px;">This report reflects only what you've entered — it isn't sent anywhere else, and isn't seen by anyone at Smooth Application unless you choose to share it.</p>
      ${
        outcomeLinks
          ? `<hr style="border:none;border-top:1px solid #e5e5e5;margin:20px 0;" />
             <p style="font-size:13px;color:#333;">One quick thing — has your visa application moved since you got this? Whichever is true, one click and we'll know:</p>
             <p style="font-size:13px;">
               <a href="${outcomeLinks.applied}" style="color:#0b7a6e;">I've applied</a>
               &nbsp;·&nbsp;
               <a href="${outcomeLinks.approved}" style="color:#0b7a6e;">I was approved</a>
               &nbsp;·&nbsp;
               <a href="${outcomeLinks.refused}" style="color:#0b7a6e;">I was refused</a>
             </p>
             <p style="color:#999;font-size:12px;">Totally optional — just helps us keep improving this for the next applicant.</p>`
          : ''
      }
    `,
    attachments: [
      {
        filename: `smooth-application-${countryName.toLowerCase().replace(/\s+/g, '-')}-report.pdf`,
        content: pdfBuffer,
      },
    ],
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
