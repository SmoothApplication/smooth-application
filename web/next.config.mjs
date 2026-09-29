/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Task #421 (save/report-by-email redesign): pdfkit 0.20 loads its 14 standard fonts via Node's
  // package-self-reference imports (`require('#standard-fonts/Helvetica')`, resolved through
  // pdfkit's own package.json "imports" map). That resolution only works when pdfkit is required
  // normally at runtime from node_modules — Next.js's webpack bundler for serverless functions
  // doesn't correctly rewrite/trace the `#`-prefixed specifier when it inlines pdfkit into the
  // function bundle, which produced an opaque 500 (empty body) from /api/email-report in
  // production while working fine locally under plain Node/jest (no bundler involved there).
  // Marking it external stops webpack from bundling it at all, so it's just a normal require()
  // against the real node_modules folder Vercel deploys alongside the function.
  //
  // That alone wasn't enough, confirmed by the real error once app/api/email-report/route.ts's
  // temporary debug catch surfaced it: "Cannot find module
  // '.../node_modules/pdfkit/js/standard-fonts/Helvetica.cjs'" at /var/task/... in production.
  // Vercel's own file tracer (@vercel/nft) decides which node_modules files to upload alongside
  // each serverless function by statically following require()/import calls — it doesn't
  // understand the `#`-prefixed self-reference specifier either, so it never discovered these
  // font files needed to come along even though pdfkit itself (now external) was left unbundled.
  // outputFileTracingIncludes forces them in explicitly. Also including js/data (ICC colour
  // profile data pdfkit resolves via a computed file URL, a different mechanism nft could equally
  // miss) so a future PDF feature that touches colour profiles doesn't hit the same class of bug.
  experimental: {
    serverComponentsExternalPackages: ['pdfkit'],
    outputFileTracingIncludes: {
      '/api/email-report/route': ['./node_modules/pdfkit/js/standard-fonts/**/*', './node_modules/pdfkit/js/data/**/*'],
    },
  },
};

export default nextConfig;
