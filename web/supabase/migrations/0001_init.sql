-- Smooth Application platform — initial schema
-- Deliberately lean: per the founder's own call (privacy promise vs. "save and resume"), this
-- stores an applicant's EMAIL and PROGRESS STAGE only — never the checklist answers themselves
-- (name, passport number, financial figures, addresses). Those stay exactly where they are today:
-- parsed and held only in the applicant's own browser. If that decision changes later, add a
-- separate, explicitly-opt-in table for full answers rather than widening this one.

-- ============================================================================================
-- Applicants
-- ============================================================================================
-- Auth itself is handled by Supabase Auth (auth.users) — this table is the public-schema profile
-- row for that same user, created the moment someone types an email in anywhere in the flow (see
-- the "create a password to view your documents" prompt) and a matching auth.users row is
-- provisioned (password may be set later than the row itself, at first "create a password" click).
create table if not exists public.applicant_profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  country text,                          -- e.g. 'UK', 'CA', 'ZA' — matches COUNTRIES keys in the app
  current_session_key text,              -- e.g. 'finance2', 'passport' — last session they were on
  percent_complete int not null default 0 check (percent_complete between 0 and 100),
  checklist_started_at timestamptz,
  last_active_at timestamptz not null default now(),
  marked_ready_at timestamptz,           -- set once they reach "you're ready" — null = still working
  reminder_emails_sent int not null default 0,
  last_reminder_sent_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists applicant_profiles_last_active_idx on public.applicant_profiles (last_active_at);
create index if not exists applicant_profiles_created_at_idx on public.applicant_profiles (created_at);
create index if not exists applicant_profiles_country_idx on public.applicant_profiles (country);

-- ============================================================================================
-- Departments & admin roles
-- ============================================================================================
create table if not exists public.departments (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,             -- e.g. 'COO', 'CMO', 'CTO'
  created_at timestamptz not null default now()
);

-- A sub-admin-created title for their own department's staff (e.g. "Support Agent", "Content Editor").
-- Deliberately freeform per department, not a fixed enum — the request was "create roles for staff
-- in their department", which implies departments define their own roles.
create table if not exists public.staff_roles (
  id uuid primary key default gen_random_uuid(),
  department_id uuid not null references public.departments(id) on delete cascade,
  title text not null,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  unique (department_id, title)
);

create type public.admin_role as enum ('super_admin', 'sub_admin', 'staff');

create table if not exists public.admin_users (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  role public.admin_role not null,
  department_id uuid references public.departments(id),   -- null for super_admin
  staff_role_id uuid references public.staff_roles(id),    -- only set for role='staff'
  invited_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);

create index if not exists admin_users_department_idx on public.admin_users (department_id);

-- ============================================================================================
-- Email log — dedupes reminder sends and gives the admin dashboards a real audit trail
-- ============================================================================================
create type public.email_type as enum ('password_setup', 'reminder_incomplete', 'welcome');

create table if not exists public.email_log (
  id uuid primary key default gen_random_uuid(),
  applicant_id uuid not null references public.applicant_profiles(id) on delete cascade,
  email_type public.email_type not null,
  resend_message_id text,
  sent_at timestamptz not null default now()
);

create index if not exists email_log_applicant_idx on public.email_log (applicant_id);
create index if not exists email_log_type_sent_idx on public.email_log (email_type, sent_at);

-- ============================================================================================
-- Row Level Security
-- ============================================================================================
alter table public.applicant_profiles enable row level security;
alter table public.admin_users enable row level security;
alter table public.departments enable row level security;
alter table public.staff_roles enable row level security;
alter table public.email_log enable row level security;

-- Applicants can only ever see/update their own row.
create policy "applicants read own profile" on public.applicant_profiles
  for select using (auth.uid() = id);
create policy "applicants update own profile" on public.applicant_profiles
  for update using (auth.uid() = id);

-- Helper: is the current user ANY kind of admin (super_admin, sub_admin, or staff)?
create or replace function public.is_admin(uid uuid)
returns boolean
language sql stable security definer
as $$
  select exists (select 1 from public.admin_users where id = uid);
$$;

create or replace function public.is_super_admin(uid uuid)
returns boolean
language sql stable security definer
as $$
  select exists (select 1 from public.admin_users where id = uid and role = 'super_admin');
$$;

-- Any admin (super/sub/staff) can read every applicant profile — per the founder's spec, analytics
-- visibility is not department-scoped, only STAFF-MANAGEMENT is (see admin_users policies below).
create policy "admins read all applicant profiles" on public.applicant_profiles
  for select using (public.is_admin(auth.uid()));

-- Admin visibility into admin_users: everyone can see the roster (needed to render org chart /
-- "who's a sub-admin" in the Super Admin view), but only a super_admin can INSERT/UPDATE/DELETE
-- sub_admin rows, and a sub_admin can only manage staff rows within their OWN department.
create policy "admins read admin roster" on public.admin_users
  for select using (public.is_admin(auth.uid()));

create policy "super_admin manages sub_admins" on public.admin_users
  for all using (
    public.is_super_admin(auth.uid())
  ) with check (
    public.is_super_admin(auth.uid())
  );

create policy "sub_admin manages own department staff" on public.admin_users
  for insert with check (
    role = 'staff'
    and department_id = (select department_id from public.admin_users where id = auth.uid())
    and (select role from public.admin_users where id = auth.uid()) = 'sub_admin'
  );

create policy "admins read departments" on public.departments
  for select using (public.is_admin(auth.uid()));
create policy "super_admin manages departments" on public.departments
  for all using (public.is_super_admin(auth.uid())) with check (public.is_super_admin(auth.uid()));

create policy "admins read staff_roles" on public.staff_roles
  for select using (public.is_admin(auth.uid()));
create policy "sub_admin manages own department staff_roles" on public.staff_roles
  for all using (
    department_id = (select department_id from public.admin_users where id = auth.uid())
    and (select role from public.admin_users where id = auth.uid()) in ('sub_admin', 'super_admin')
  ) with check (
    department_id = (select department_id from public.admin_users where id = auth.uid())
    and (select role from public.admin_users where id = auth.uid()) in ('sub_admin', 'super_admin')
  );

create policy "admins read email_log" on public.email_log
  for select using (public.is_admin(auth.uid()));

-- service_role (used by the Resend-sending server code / cron job) bypasses RLS automatically —
-- no separate policy needed for the email-sending path, but keep the insert policy explicit for
-- defense-in-depth against a leaked anon key.
create policy "service role inserts email_log" on public.email_log
  for insert with check (auth.role() = 'service_role');

-- ============================================================================================
-- updated_at trigger
-- ============================================================================================
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists applicant_profiles_set_updated_at on public.applicant_profiles;
create trigger applicant_profiles_set_updated_at
  before update on public.applicant_profiles
  for each row execute function public.set_updated_at();
