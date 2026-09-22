// Resolves a short id from an /invite-link?id=... URL (see lib/invite-link.ts) to the real,
// one-time-use Supabase link. Public/unauthenticated on purpose — the id itself is the secret,
// same trust model as the Supabase token it stands in for. Deletes the row once read so a leaked
// or reused id doesn't keep resolving after the first real click.
import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';

export async function GET(request: Request, { params }: { params: { id: string } }) {
  const id = params.id;
  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });

  const admin = createAdminClient();
  const { data, error } = await admin.from('invite_redirects').select('target').eq('id', id).maybeSingle();
  if (error || !data) return NextResponse.json({ error: 'Link not found or already used' }, { status: 404 });

  await admin.from('invite_redirects').delete().eq('id', id);

  return NextResponse.json({ target: data.target });
}
