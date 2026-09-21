// Core reminder logic — single source of truth, called by the Vercel Cron route
// (app/api/cron/send-reminders/route.ts). Only emails applicants who (a) haven't finished
// (marked_ready_at is null), (b) have been inactive for REMINDER_AFTER_DAYS+, and (c) haven't
// already been reminded within REMINDER_COOLDOWN_DAYS — safe to run daily without spamming anyone.
import { createAdminClient } from '@/lib/supabase/admin';
import { sendIncompleteReminderEmail } from '@/lib/resend';

const REMINDER_AFTER_DAYS = 3;
const REMINDER_COOLDOWN_DAYS = 4;

export async function runReminderPass() {
  const supabase = createAdminClient();
  const cutoff = new Date(Date.now() - REMINDER_AFTER_DAYS * 24 * 60 * 60 * 1000).toISOString();

  const { data: candidates, error } = await supabase
    .from('applicant_profiles')
    .select('id, email, country, percent_complete, last_active_at, last_reminder_sent_at, reminder_emails_sent')
    .is('marked_ready_at', null)
    .lt('last_active_at', cutoff);

  if (error) throw new Error('Failed to fetch reminder candidates: ' + error.message);

  const cooldownCutoff = Date.now() - REMINDER_COOLDOWN_DAYS * 24 * 60 * 60 * 1000;
  const toRemind = (candidates || []).filter(
    (c) => !c.last_reminder_sent_at || new Date(c.last_reminder_sent_at).getTime() < cooldownCutoff
  );

  const results = { attempted: toRemind.length, sent: 0, failed: 0 };

  for (const applicant of toRemind) {
    try {
      const resumeUrl = `${process.env.NEXT_PUBLIC_SITE_URL}/account`;
      const result = await sendIncompleteReminderEmail({
        to: applicant.email,
        percentComplete: applicant.percent_complete,
        resumeUrl,
        country: applicant.country,
      });

      await supabase.from('email_log').insert({
        applicant_id: applicant.id,
        email_type: 'reminder_incomplete',
        resend_message_id: result.data?.id ?? null,
      });
      await supabase
        .from('applicant_profiles')
        .update({
          reminder_emails_sent: (applicant.reminder_emails_sent || 0) + 1,
          last_reminder_sent_at: new Date().toISOString(),
        })
        .eq('id', applicant.id);

      results.sent += 1;
    } catch {
      results.failed += 1;
    }
  }

  return results;
}
