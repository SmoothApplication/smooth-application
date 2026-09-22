// Supabase's admin.generateLink() one-time links get silently burned if anything fetches them
// before the actual invitee does — most commonly a messaging app's own link-preview bot (WhatsApp,
// iMessage, Slack, etc. all GET the URL server-side to build a rich preview card the instant the
// message is sent/received). By the time the person taps the link, Supabase has already consumed
// the token and `create-password` fails with "Auth session missing!".
//
// The fix is a click-gated redirect: wrap the real one-time link behind a page on our own domain
// that does nothing on load (safe for preview bots to fetch) and only navigates to the real
// Supabase link inside an onClick handler (a genuine user gesture, never triggered by a crawler).
export function wrapInviteLink(actionLink: string): string {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || '';
  return `${siteUrl}/invite-link?to=${encodeURIComponent(actionLink)}`;
}
