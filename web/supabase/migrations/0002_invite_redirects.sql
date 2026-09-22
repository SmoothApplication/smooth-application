-- Short-lived lookup table backing the /invite-link click-gate page (see web/lib/invite-link.ts).
-- A wrapped invite URL embeds only this row's short id, not the full Supabase one-time-use link —
-- keeping the shared URL short enough that messaging apps (WhatsApp in particular) don't mangle or
-- truncate it in transit. The real link is only resolved server-side, from a real user's click.
create table if not exists public.invite_redirects (
  id text primary key,
  target text not null,
  created_at timestamptz not null default now()
);

-- No RLS policies: this table is only ever read/written via the service-role client (admin.ts),
-- which bypasses RLS. Enabling RLS with zero policies means the anon/authenticated roles get zero
-- access by default — exactly what we want, since the id is the only thing gating access to target.
alter table public.invite_redirects enable row level security;

-- Best-effort cleanup of old rows past Supabase's own link expiry — not load-bearing for security
-- (the underlying Supabase link expires on its own), just keeps the table from growing forever.
create index if not exists invite_redirects_created_at_idx on public.invite_redirects (created_at);
