// Hit by Vercel Cron on the schedule in vercel.json (daily at 09:00 UTC). Vercel signs cron
// requests with a bearer token matching CRON_SECRET automatically when that env var is set — see
// https://vercel.com/docs/cron-jobs/manage-cron-jobs#securing-cron-jobs. Also callable manually
// (e.g. `curl -H "Authorization: Bearer $CRON_SECRET" https://yourapp/api/cron/send-reminders`)
// for testing or if you end up using a non-Vercel scheduler instead.
import { NextResponse } from 'next/server';
import { runReminderPass } from '@/lib/reminders';

export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization');
  if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const results = await runReminderPass();
    return NextResponse.json({ ok: true, ...results });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Reminder pass failed' }, { status: 500 });
  }
}
