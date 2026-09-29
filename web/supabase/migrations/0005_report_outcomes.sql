-- Fix 1 (technical-co-founder review, launch-day priority: "we need to know how many people
-- downloaded [their report], and what happened after"): the report-email flow (/api/email-report)
-- has had zero visibility into what happens after someone gets their PDF — did they actually apply?
-- Get approved? Get refused? This is the follow-up-loop half of that; the "how many downloaded"
-- half is already answered once this migration is live, by counting public.email_log rows with
-- email_type = 'progress_report' (previously broken — see 0004's own comment, applied to production
-- alongside this migration after being found never actually deployed).
--
-- Deliberately keyed by an opaque, unguessable TOKEN, never the applicant's email — putting a real
-- email address in a one-click email-footer link would violate this project's own "never place
-- personal/sensitive data in URL parameters" rule, and would let anyone who forwards the email (or
-- whose inbox is compromised) implicate someone else's application outcome. The token is the only
-- thing that ever appears in the outcome-selection links; this table is the only place it's looked
-- up, and it resolves to an applicant only server-side, via applicant_id, never via the token itself
-- carrying any personal data.
create table if not exists public.report_outcomes (
  id uuid primary key default gen_random_uuid(),
  token uuid not null unique default gen_random_uuid(),
  applicant_id uuid references public.applicant_profiles(id) on delete set null,
  country_code text,
  sent_at timestamptz not null default now(),
  outcome text check (outcome in ('applied', 'approved', 'refused')),
  outcome_recorded_at timestamptz
);

create index if not exists report_outcomes_token_idx on public.report_outcomes (token);
create index if not exists report_outcomes_applicant_idx on public.report_outcomes (applicant_id);
create index if not exists report_outcomes_sent_at_idx on public.report_outcomes (sent_at);

alter table public.report_outcomes enable row level security;

-- Same pattern as every other service-role-only table in this schema (report_request_log,
-- email_log): only the API routes touch this, via createAdminClient() — one when a report is sent
-- (inserts a row), one public GET route when an outcome link is clicked (updates by token). No
-- client-side/anon access at all, so a stolen or guessed token can only ever set ITS OWN outcome
-- field, never read or touch any other applicant's data through this table.
create policy "service role manages report_outcomes" on public.report_outcomes
  for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');
