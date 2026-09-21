import Link from 'next/link';

// Placeholder landing page — the real applicant-facing checklist is being ported in from the
// existing index.html incrementally (see CHANGELOG / task tracker). This root route just gives
// admins somewhere sane to land and sign in from until that port lands.
export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 p-8 text-center">
      <h1 className="text-2xl font-bold">Smooth Application</h1>
      <p className="max-w-md text-gray-600">
        The applicant checklist is being ported into this app. In the meantime, admins can sign in below.
      </p>
      <Link href="/login" className="rounded-md bg-brand px-5 py-2.5 font-medium text-white hover:bg-brand-dark">
        Admin sign in
      </Link>
    </main>
  );
}
