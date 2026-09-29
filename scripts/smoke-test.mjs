#!/usr/bin/env node
// Fix 5 (technical-co-founder review, "harden it over time" follow-up): a lightweight post-deploy
// check for the two API routes that do real work with real side effects on every call
// (/api/capture-email, /api/email-report) — the same two routes flagged in that review as having
// no visibility into whether they're actually working after a deploy. A build can succeed on
// Vercel while an env var is missing or a route throws on import; this catches that within seconds
// of a deploy instead of waiting for a user to report it (or, worse, not report it).
//
// Deliberately two tiers, not one:
//   - Default ("safe") mode sends deliberately INVALID payloads and asserts each route responds
//     with the expected 400 — enough to prove the route compiled, is reachable, and its validation
//     logic runs, WITHOUT creating a real Supabase user, sending a real email, or rendering a PDF.
//     Safe to run after every single deploy, on a schedule, with no side effects and no cost.
//   - `--full` mode additionally exercises the real happy path with one dedicated test email
//     (SMOKE_TEST_EMAIL env var), which DOES create/touch a real Supabase auth user, DOES send a
//     real email via Resend, and for /api/email-report DOES render a PDF. Meant to be run
//     occasionally by a human, not on every deploy — it costs an actual email send each time.
//
// Usage:
//   node scripts/smoke-test.mjs https://smoothapplication.com
//   node scripts/smoke-test.mjs https://smoothapplication.com --full   (needs SMOKE_TEST_EMAIL env var)
//
// Exit code is 0 only if every check passed — wire this into a deploy hook, a scheduled task, or
// just run it by hand right after clicking "push" when something feels risky.

const baseUrl = process.argv[2];
const fullMode = process.argv.includes('--full');

if (!baseUrl) {
  console.error('Usage: node scripts/smoke-test.mjs <base-url> [--full]');
  process.exit(2);
}

let failures = 0;

function report(name, ok, detail) {
  const icon = ok ? '✅' : '❌';
  console.log(`${icon} ${name}${detail ? ' — ' + detail : ''}`);
  if (!ok) failures++;
}

async function postJson(path, body) {
  const res = await fetch(`${baseUrl}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  let json = null;
  try {
    json = await res.json();
  } catch {
    /* non-JSON response — leave json null, status still checked */
  }
  return { status: res.status, json };
}

async function runSafeChecks() {
  // /api/capture-email should reject an invalid email with 400, never a 500 (which would mean the
  // route itself is broken — a missing import, a bad env var read at module scope, etc.) and never
  // a 200 (which would mean the "valid email required" validation regressed).
  {
    const { status, json } = await postJson('/api/capture-email', { email: 'not-an-email', country: 'UK' });
    report(
      'POST /api/capture-email rejects an invalid email (400)',
      status === 400 && !!json?.error,
      `got status ${status}${json?.error ? `, error: "${json.error}"` : ''}`
    );
  }

  // /api/email-report should reject an unknown country code with 400, before it ever gets to the
  // rate-limit check, PDF render, or Resend send — same "route is alive and validating" signal,
  // with zero side effects (no report_request_log row, no email, no PDF).
  {
    const { status, json } = await postJson('/api/email-report', {
      email: 'not-an-email',
      countryCode: 'ZZ',
    });
    report(
      'POST /api/email-report rejects an invalid email (400)',
      status === 400 && !!json?.error,
      `got status ${status}${json?.error ? `, error: "${json.error}"` : ''}`
    );
  }
  {
    const { status, json } = await postJson('/api/email-report', {
      email: 'smoke-test-safe-mode@example.com',
      countryCode: 'ZZ',
    });
    report(
      'POST /api/email-report rejects an unknown country (400)',
      status === 400 && !!json?.error,
      `got status ${status}${json?.error ? `, error: "${json.error}"` : ''}`
    );
  }
}

async function runFullChecks() {
  const email = process.env.SMOKE_TEST_EMAIL;
  if (!email) {
    report('--full mode', false, 'SMOKE_TEST_EMAIL env var not set — skipping real-send checks');
    return;
  }
  console.log(`\n--full mode: this will send a real email to ${email}. Proceeding...`);

  {
    const { status, json } = await postJson('/api/capture-email', {
      email,
      country: 'UK',
      sessionKey: 'smoke-test',
      percentComplete: 1,
    });
    report('POST /api/capture-email happy path (200)', status === 200 && json?.ok === true, `got status ${status}`);
  }

  {
    const { status, json } = await postJson('/api/email-report', {
      email,
      countryCode: 'UK',
      answers: {},
      checked: {},
      financialInputs: null,
      statements: [],
    });
    // A 429 here just means the rate limit is doing its job from a previous run within the hour —
    // treated as a pass, not a failure, since it proves the route (and the rate limiter) are alive.
    const ok = status === 200 || status === 429;
    report(
      'POST /api/email-report happy path (200, or 429 = rate limit working)',
      ok && (status !== 200 || json?.ok === true),
      `got status ${status}${json?.error ? `, error: "${json.error}"` : ''}`
    );
  }
}

console.log(`Smoke-testing ${baseUrl} (${fullMode ? 'full' : 'safe'} mode)\n`);
await runSafeChecks();
if (fullMode) await runFullChecks();

console.log(`\n${failures === 0 ? '✅ All checks passed' : `❌ ${failures} check(s) failed`}`);
process.exit(failures === 0 ? 0 : 1);
