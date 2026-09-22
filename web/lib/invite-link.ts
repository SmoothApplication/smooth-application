import type { SupabaseClient } from '@supabase/supabase-js';

// Supabase's admin.generateLink() one-time links get silently burned if anything fetches them
// before the actual invitee does — most commonly a messaging app's own link-preview bot (WhatsApp,
// iMessage, Slack, etc. all GET the URL server-side to build a rich preview card the instant the
// message is sent/received). By the time the person taps the link, Supabase has already consumed
// the token and `create-password` fails with "Auth session missing!".
//
// The fix is a click-gated redirect through our OWN short link: store the real one-time link in
// `invite_redirects` (service-role only, see supabase/migrations/0002_invite_redirects.sql) keyed
// by a short random id, and hand back a short `/invite-link?id=...` URL instead. Embedding the
// full destination directly in the query string (an earlier version of this) produced URLs long
// enough that WhatsApp mangled/truncated them in transit — a short id sidesteps that entirely.
// The invite-link page itself does nothing on load (safe for a preview bot to fetch) and only
// resolves + navigates to the real link from inside a button's onClick — a genuine user gesture a
// crawler can't trigger.
export async function createInviteLink(admin: SupabaseClient, actionLink: string): Promise<string | null> {
  const id = Array.from({ length: 12 }, () => Math.floor(Math.random() * 36).toString(36)).join('');
  const { error } = await admin.from('invite_redirects').insert({ id, target: actionLink });
  if (error) return null;
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || '';
  return `${siteUrl}/invite-link?id=${id}`;
}
