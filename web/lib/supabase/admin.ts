// SERVICE-ROLE Supabase client — bypasses Row Level Security entirely. Only ever import this
// inside Route Handlers (app/api/**) or the standalone cron script, NEVER in a Client Component
// or anything bundled for the browser (the service-role key must never reach the client bundle).
//
// Needed for two flows that can't run as a logged-in user, because there isn't one yet:
//  1. The "drop your email anywhere in the flow" capture endpoint — creates the auth.users row +
//     applicant_profiles row (and fires the "create your password" email) before the applicant
//     has ever signed in.
//  2. The reminder-email cron job — runs on a schedule with no signed-in user, queries every
//     incomplete applicant, and writes to email_log.
import { createClient as createSupabaseClient } from '@supabase/supabase-js';

export function createAdminClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}
