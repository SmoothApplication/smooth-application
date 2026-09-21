// Manual/local trigger for the reminder pass — the real schedule runs via Vercel Cron (see
// vercel.json + app/api/cron/send-reminders/route.ts, which is the single source of truth for the
// actual logic). This script just calls that same deployed endpoint, useful for testing or for
// triggering a run from a terminal without waiting for the daily schedule.
//
// Usage: SITE_URL=https://your-deploy.vercel.app CRON_SECRET=... node scripts/send-reminders.js
const siteUrl = process.env.SITE_URL || process.env.NEXT_PUBLIC_SITE_URL;
const cronSecret = process.env.CRON_SECRET;

if (!siteUrl) {
  console.error('Set SITE_URL (or NEXT_PUBLIC_SITE_URL) to your deployed app, e.g. https://smooth-application.vercel.app');
  process.exit(1);
}

fetch(`${siteUrl}/api/cron/send-reminders`, {
  headers: cronSecret ? { Authorization: `Bearer ${cronSecret}` } : {},
})
  .then(async (res) => {
    const body = await res.json();
    if (!res.ok) {
      console.error('Reminder pass failed:', body);
      process.exit(1);
    }
    console.log('Reminder pass complete:', body);
  })
  .catch((err) => {
    console.error('Could not reach the reminder endpoint:', err.message);
    process.exit(1);
  });
