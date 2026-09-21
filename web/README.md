# Smooth Application — Platform (Next.js + Supabase + Vercel + Resend)

This is a **new, separate app** from the free checklist at `index.html` in the repo root. It
handles applicant accounts (email + progress only — never passport/financial data), the Super
Admin and sub-admin dashboards, and Resend email automation. The free checklist keeps running
exactly as it does today; this app reads the same Supabase database it will write to once the
email-capture points inside `index.html` are wired up (see "Connecting the free checklist" below).

## What's built so far

- **Schema** (`supabase/migrations/0001_init.sql`): `applicant_profiles`, `departments`,
  `staff_roles`, `admin_users` (role: `super_admin` / `sub_admin` / `staff`), `email_log`, with
  Row Level Security so applicants only ever see their own row and admin visibility/management
  follows the rules in that file's comments.
- **Auth**: Supabase Auth, shared between applicants and admins — `/login`,
  `/create-password` (landing page for the invite-email link).
- **Super Admin / sub-admin dashboard** (`/admin`): total applicants, signups this week,
  completed vs. in-progress, per-country breakdown, a full applicant list (`/admin/applicants`),
  and role management (`/admin/team`) — a super admin can invite sub-admins into any department; a
  sub-admin can create staff role titles and invite staff into their own department only (enforced
  both in the UI and again server-side via RLS + the API routes' own role checks).
- **Resend integration**: `lib/resend.ts` has the two email types (create-password,
  incomplete-reminder). `app/api/capture-email/route.ts` is the endpoint the free checklist should
  call the moment someone types an email in anywhere — it provisions the account and sends the
  create-password email. `app/api/cron/send-reminders/route.ts` + `vercel.json`'s cron entry run
  daily and email anyone inactive 3+ days with an incomplete checklist (max once every 4 days).

## What's NOT built yet

- **The checklist itself.** This app has no visa-document checklist UI yet — `/account` is a
  placeholder showing saved progress. Porting the ~15k-line `index.html` into this app is the
  biggest remaining piece of work (see the project task tracker).
- Live wiring between the free checklist and `/api/capture-email` — right now that endpoint
  exists but nothing calls it yet.

## Setup

**Done already:** a live Supabase project — `smooth-application-platform` (eu-west-1, org
`SmoothApplication's Org`, project ref `yjskbifnswwlgywehrse`) — with `0001_init.sql` and a
follow-up hardening migration (`0002_harden_functions` — pinned `search_path` on all three
functions, revoked `is_admin`/`is_super_admin` execute from anonymous visitors) both applied
clean. `.env.local` is pre-filled with the project's real URL and anon key, plus a pre-generated
`CRON_SECRET`. Still to fill in there: `SUPABASE_SERVICE_ROLE_KEY`, `RESEND_API_KEY`,
`RESEND_FROM_EMAIL`.

Remaining steps:

1. **Grab the service role key** — Supabase dashboard → this project → Project Settings → API →
   reveal the `service_role` secret key (deliberately not exposed via MCP tooling; paste it into
   `SUPABASE_SERVICE_ROLE_KEY` in `.env.local`, never commit it).
2. **Create your own Super Admin row** — sign up once via `/login` (or Supabase dashboard →
   Authentication → Users → Add user, using seyiafeni@yahoo.co.uk), then in the SQL Editor:
   ```sql
   insert into public.admin_users (id, email, role) values ('<your-auth-user-id>', 'seyiafeni@yahoo.co.uk', 'super_admin');
   ```
3. **Create a Resend account**, verify a sending domain, grab an API key, fill in
   `RESEND_API_KEY` / `RESEND_FROM_EMAIL`.
4. `npm install`
5. `npm run dev` — visit `http://localhost:3000/login` and sign in as your Super Admin.
6. **Deploy to Vercel**: connect this repo (set the Vercel project's Root Directory to `web/` if
   it stays inside the main `smooth-application` repo), copy every value from `.env.local` into
   Project Settings → Environment Variables, and update `NEXT_PUBLIC_SITE_URL` to the real
   deployed URL. Vercel Cron picks up `vercel.json` automatically once deployed.

## Connecting the free checklist

Once this is deployed, `index.html` needs one small addition: wherever it currently just stores an
email locally (the "Anywhere an applicant drops email it is recorded" requirement), also
`fetch()` this app's `/api/capture-email` endpoint:

```js
fetch('https://your-platform.vercel.app/api/capture-email', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    email: theEmailTheyTyped,
    country: currentCountry,
    sessionKey: currentSessionKey,      // e.g. keys[currentSessionIndex]
    percentComplete: overallPercent,    // whatever the app already computes for "X% filled"
  }),
});
```

This is a cross-origin request (different domain from the checklist), so `/api/capture-email` may
need CORS headers added once the real domains are known — not yet done in this scaffold since the
final domain isn't set.
