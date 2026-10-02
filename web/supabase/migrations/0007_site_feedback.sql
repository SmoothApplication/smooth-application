-- Direct request, following the UX audit (smoothapplication.com "too clumsy" feedback): instead of
-- a one-off 50-person PickFu poll, collect honest feedback from real visitors as they use the live
-- site. This is the storage half of that — see components/checklist/SiteFeedbackPanel.tsx (the
-- widget, mounted in SessionShell.tsx on every session) and app/api/site-feedback/route.ts.
--
-- Deliberately anonymous, same pattern as readiness_kit_requests (0006): a visitor leaving feedback
-- mid-checklist has given no name/email, so this is a log of "someone on this page said X", not a
-- CRM record. page_path is the exact route the feedback was left on (e.g. /checklist/uk/statement)
-- so admin can see which screen is generating the complaints, which is the whole point of this
-- feature over a generic poll.
create table if not exists public.site_feedback (
  id uuid primary key default gen_random_uuid(),
  page_path text not null,
  country_code text,
  -- A quick sentiment pick (confusing / fine / great) plus the free-text detail — neither required
  -- on its own, but the API route rejects a submission with neither (see that route's own comment).
  sentiment text check (sentiment in ('confusing', 'fine', 'great')),
  message text,
  submitted_at timestamptz not null default now(),
  -- Same triage convention as readiness_kit_requests, so this doesn't just grow forever with no way
  -- to mark something as reviewed.
  status text not null default 'new' check (status in ('new', 'reviewed'))
);

create index if not exists site_feedback_submitted_at_idx on public.site_feedback (submitted_at desc);
create index if not exists site_feedback_status_idx on public.site_feedback (status);
create index if not exists site_feedback_page_path_idx on public.site_feedback (page_path);

alter table public.site_feedback enable row level security;

create policy "service role inserts site_feedback" on public.site_feedback
  for insert
  with check (auth.role() = 'service_role');

create policy "admins read site_feedback" on public.site_feedback
  for select using (public.is_admin(auth.uid()));

create policy "admins update site_feedback" on public.site_feedback
  for update using (public.is_admin(auth.uid())) with check (public.is_admin(auth.uid()));
