// Browser-side Supabase client — used in Client Components (applicant login, create-password
// form, admin dashboard interactivity). Uses the PUBLIC anon key only — safe to ship to the
// browser; Row Level Security (see supabase/migrations/0001_init.sql) is what actually keeps an
// applicant from reading another applicant's row, not this key.
import { createBrowserClient } from '@supabase/ssr';

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
