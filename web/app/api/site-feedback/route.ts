// See migration 0007_site_feedback.sql for the table/RLS and
// components/checklist/SiteFeedbackPanel.tsx for the client-side call site. POST is anonymous (no
// signed-in user when a visitor leaves feedback mid-checklist) and uses the service-role client to
// insert past RLS, same pattern as app/api/readiness-kit-request/route.ts. PATCH is the admin-only
// status update from app/admin/feedback/page.tsx, enforced by Postgres RLS via the cookie-session
// client, not application code.
import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';

const VALID_SENTIMENTS = new Set(['confusing', 'fine', 'great']);
const VALID_STATUSES = new Set(['new', 'reviewed']);

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const pagePath = typeof body?.pagePath === 'string' ? body.pagePath.slice(0, 200) : '';
  const countryCode = typeof body?.countryCode === 'string' ? body.countryCode.slice(0, 10) : null;
  const sentiment = typeof body?.sentiment === 'string' && VALID_SENTIMENTS.has(body.sentiment) ? body.sentiment : null;
  const message = typeof body?.message === 'string' ? body.message.slice(0, 2000).trim() : '';

  if (!pagePath || (!sentiment && !message)) {
    return NextResponse.json({ error: 'Pick a reaction or add a note before sending.' }, { status: 400 });
  }

  const supabase = createAdminClient();
  const { error } = await supabase
    .from('site_feedback')
    .insert({ page_path: pagePath, country_code: countryCode, sentiment, message: message || null });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}

export async function PATCH(request: Request) {
  const body = await request.json().catch(() => null);
  const id = typeof body?.id === 'string' ? body.id : '';
  const status = typeof body?.status === 'string' ? body.status : '';

  if (!id || !VALID_STATUSES.has(status)) {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  }

  const supabase = createClient();
  const { error } = await supabase.from('site_feedback').update({ status }).eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 403 });

  return NextResponse.json({ ok: true });
}
