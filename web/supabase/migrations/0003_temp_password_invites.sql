-- Switches admin invites (sub-admin, staff) from "email a Supabase magic link" to "set a temporary
-- password directly and hand it to the super/sub-admin to share themselves". The magic-link path
-- kept breaking in practice: Resend's sandbox sender can only deliver to the account owner's own
-- inbox, and even hand-copied links got eaten by WhatsApp's link-preview bot fetching (and
-- consuming) the one-time token before the real recipient ever tapped it. A temp password shared
-- directly (text, call, whatever) has no link for anything to prefetch. must_change_password forces
-- the invitee to set their own real password on first login, so the shared temp password is only
-- ever valid for that one sign-in in practice.
alter table public.admin_users
  add column if not exists must_change_password boolean not null default false;

-- The invite_redirects table (short-link workaround for the old magic-link flow) is no longer
-- written to or read by the app now that invites use a temp password instead of a link.
drop table if exists public.invite_redirects;
