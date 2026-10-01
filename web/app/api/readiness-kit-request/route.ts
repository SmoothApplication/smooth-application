// Direct request: log every "Get my Document Review / Full Case Review" CTA click so there's a
// record in the app, not just a message that may or may not land in WhatsApp. See migration
// 0006_readiness_kit_requests.sql for the table/RLS and components/ReadinessKits.tsx for the
// client-side call site (fired alongside the WhatsApp link, not instead of it — this never blocks
// or delays opening WhatsApp).
//
// POST is intentionally anonymous (no signed-in user at the point of a homepage click — see the
// migration's own comment on why this is a log, not a CRM record) and uses the service-role client
// to insert past RLS. PATCH is the admin-only status update from app/admin/readiness-kits/page.tsx:
// it uses the cookie-session client instead, so Postgres RLS (not application code) is what
// actually enforces "only a signed-in admin can do this" — see the "admins update
// readiness_kit_requests" policy in the same migration.
import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';

const VALID_KITS = new Set(['document_review', 'full_case_review']);
const VALID_STATUSES = new Set(['new', 'contacted', 'done']);

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const kit = typeof body?.kit === 'string' ? body.kit : '';
  const priceLabel = typeof body?.priceLabel === 'string' ? body.priceLabel.slice(0, 40) : '';

  if (!VALID_KITS.has(kit) || !priceLabel) {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  }

  const supabase = createAdminClient();
  const { error } = await supabase.from('readiness_kit_requests').insert({ kit, price_label: priceLabel });
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
  const { error } = await supabase.from('readiness_kit_requests').update({ status }).eq('id', id);
  // RLS rejects this with an error for anyone who isn't a signed-in admin — surfaced as 403 rather
  // than 500 since "not allowed" is the expected reason, not a server fault.
  if (error) return NextResponse.json({ error: error.message }, { status: 403 });

  return NextResponse.json({ ok: true });
}
