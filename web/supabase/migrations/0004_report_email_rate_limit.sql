-- Fix 2 (technical-co-founder review, follow-up): /api/email-report has been silently failing to
-- write its own audit row on every single send. The route inserts email_type: 'progress_report'
-- into public.email_log, but the email_type enum created in 0001_init.sql only ever defined
-- ('password_setup', 'reminder_incomplete', 'welcome') — 'progress_report' was never added. Postgres
-- rejects the insert, and the route doesn't check that insert's error (it had already sent the
-- Resend email and returned {ok:true} by that point), so this has been failing invisibly since the
-- report-email feature shipped. This adds the missing enum value so the audit trail actually works.
--
-- ALTER TYPE ... ADD VALUE cannot run inside the same transaction as other statements that might use
-- the new value, so it gets its own migration file rather than being folded into 0001.
alter type public.email_type add value if not exists 'progress_report';

-- Separate, lightweight abuse/spam-relay guard for /api/email-report: today anything can POST any
-- email address plus a big financial/passport-derived payload and the route will render a PDF and
-- mail it to that address with no verification the requester owns it and no rate limit. This table
-- gives the route something to count against per email and per rough client IP before it does any
-- expensive work (PDF render, Resend send). It is intentionally separate from email_log (which
-- records what was actually sent) — this records every *attempt*, successful or not, so a burst of
-- requests against an email that keeps failing validation still gets throttled.
create table if not exists public.report_request_log (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  ip text,
  created_at timestamptz not null default now()
);

create index if not exists report_request_log_email_idx on public.report_request_log (email, created_at);
create index if not exists report_request_log_ip_idx on public.report_request_log (ip, created_at);

alter table public.report_request_log enable row level security;

-- Only the service-role key (used server-side via createAdminClient) ever touches this table.
create policy "service role manages report_request_log" on public.report_request_log
  for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');
