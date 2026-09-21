import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';

// Applicant-facing landing page after sign-in/password-creation. Placeholder until the checklist
// itself is ported into this app (see task: "Port the 15k-line checklist into Next.js
// incrementally") — for now it just confirms saved progress round-trips correctly.
export default async function AccountPage() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login?next=/account');

  const { data: profile } = await supabase
    .from('applicant_profiles')
    .select('email, country, current_session_key, percent_complete')
    .eq('id', user.id)
    .maybeSingle();

  return (
    <main className="mx-auto flex min-h-screen max-w-lg flex-col justify-center gap-4 p-8">
      <h1 className="text-xl font-semibold">Welcome back</h1>
      {profile ? (
        <div className="rounded-lg border border-gray-200 bg-white p-4 text-sm">
          <p><b>Email:</b> {profile.email}</p>
          <p><b>Country:</b> {profile.country ?? 'Not selected yet'}</p>
          <p><b>Last step:</b> {profile.current_session_key ?? 'Not started'}</p>
          <p><b>Progress:</b> {profile.percent_complete}%</p>
        </div>
      ) : (
        <p className="text-sm text-gray-500">No saved progress found yet — start the checklist to begin saving.</p>
      )}
      <p className="text-xs text-gray-400">
        The full checklist experience is being ported here — for now, continue at the free checklist on the main site.
      </p>
    </main>
  );
}
