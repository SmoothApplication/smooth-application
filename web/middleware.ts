// Refreshes the Supabase session cookie on every request (required for @supabase/ssr) and gates
// /admin/** behind a signed-in admin_users row. Applicant-only routes (/account/**) are gated the
// same way inside their own layout, since "is this applicant's own row" needs a DB read anyway.
import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request: { headers: request.headers } });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return request.cookies.get(name)?.value;
        },
        set(name: string, value: string, options: CookieOptions) {
          response.cookies.set({ name, value, ...options });
        },
        remove(name: string, options: CookieOptions) {
          response.cookies.set({ name, value: '', ...options });
        },
      },
    }
  );

  const { data: { user } } = await supabase.auth.getUser();

  if (request.nextUrl.pathname.startsWith('/admin')) {
    if (!user) {
      return NextResponse.redirect(new URL('/login?next=' + request.nextUrl.pathname, request.url));
    }
    const { data: adminRow } = await supabase
      .from('admin_users')
      .select('role, must_change_password')
      .eq('id', user.id)
      .maybeSingle();
    if (!adminRow) {
      return NextResponse.redirect(new URL('/', request.url));
    }
    // Invited via a temp password (see supabase/migrations/0003_temp_password_invites.sql) — force
    // them through the change-password screen before anything else in /admin is reachable.
    if (adminRow.must_change_password && request.nextUrl.pathname !== '/admin/change-password') {
      return NextResponse.redirect(new URL('/admin/change-password', request.url));
    }
  }

  return response;
}

export const config = {
  matcher: ['/admin/:path*', '/account/:path*'],
};
