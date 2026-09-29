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
  experimental: {
    serverComponentsExternalPackages: ['pdfkit'],
  },
};

export default nextConfig;
