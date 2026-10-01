-- Direct request: "No record-keeping for Readiness Kit requests. Right now 'Get my Document
-- Review' just opens WhatsApp — there's no log in the app of who clicked, so you'd have to track
-- orders manually in WhatsApp/email. A lightweight admin view of review requests could help if
-- volume picks up: create it." Paired with app/api/readiness-kit-request/route.ts (insert on CTA
-- click, via the service-role client — no signed-in user at that point) and
-- app/admin/readiness-kits/page.tsx (the admin list view, via the cookie-session client so RLS
-- below enforces admin-only access).
--
-- Deliberately anonymous: a homepage CTA click carries no identity (name/email aren't collected
-- until the applicant actually messages on WhatsApp), so this is a COUNT/LOG of "someone clicked
-- the Document Review CTA at this time", not a CRM record of who. kit/price_label are denormalized
-- (not a foreign key into a prices table, which doesn't exist) so a later price change in
-- app/page.tsx's READINESS_KITS never rewrites what an existing row says it was at the time.
create table if not exists public.readiness_kit_requests (
  id uuid primary key default gen_random_uuid(),
  kit text not null check (kit in ('document_review', 'full_case_review')),
  price_label text not null,
  requested_at timestamptz not null default now(),
  -- Simple triage state so this list doesn't just grow forever with no way to mark something as
  -- handled — set from the admin page (app/admin/readiness-kits/page.tsx's StatusSelect).
  status text not null default 'new' check (status in ('new', 'contacted', 'done')),
  note text
);

create index if not exists readiness_kit_requests_requested_at_idx on public.readiness_kit_requests (requested_at desc);
create index if not exists readiness_kit_requests_status_idx on public.readiness_kit_requests (status);

alter table public.readiness_kit_requests enable row level security;

-- Insert: service-role only (the CTA click happens before any sign-in, same as email_log /
-- report_outcomes — see those migrations' own comments on this exact pattern).
create policy "service role inserts readiness_kit_requests" on public.readiness_kit_requests
  for insert
  with check (auth.role() = 'service_role');

-- Read/update: any signed-in admin (super_admin, sub_admin, or staff) — same non-department-scoped
-- visibility rule already used for applicant_profiles (0001_init.sql) and email_log, since this is
-- an operational log, not something that needs department-level access control.
create policy "admins read readiness_kit_requests" on public.readiness_kit_requests
  for select using (public.is_admin(auth.uid()));

create policy "admins update readiness_kit_requests" on public.readiness_kit_requests
  for update using (public.is_admin(auth.uid())) with check (public.is_admin(auth.uid()));
