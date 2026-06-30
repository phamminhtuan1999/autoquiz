import type { NextConfig } from "next";
import path from "node:path";
import { loadEnvConfig } from "@next/env";

// Repo split (US-RAG-014): the Next app lives in `apps/web`, but the single
// source-of-truth `.env` stays at the monorepo root. Next only loads env from
// its own project dir, so `next dev` / `next build` here would miss
// NEXT_PUBLIC_SUPABASE_* (build fails prerendering `/`, dev can't auth).
//
// Load the root env explicitly via Next's own loader. This:
//   - keeps one root `.env` (no per-app copy or symlink),
//   - does NOT override already-set vars, so CI/Vercel env wins,
//   - is a no-op when the root `.env` is absent (e.g. on Vercel).
// forceReload (4th arg): Next already calls loadEnvConfig() for this app's own
// dir before evaluating next.config, which populates @next/env's module cache.
// Without forceReload, this second call short-circuits and never reads the root.
const monorepoRoot = path.resolve(process.cwd(), "..", "..");
loadEnvConfig(
  monorepoRoot,
  process.env.NODE_ENV !== "production",
  { info: () => {}, error: console.error },
  true,
);

const nextConfig: NextConfig = {
  // US-RAG-015: the legacy direct-Gemini surfaces are retired. Old URLs route to
  // the RAG flow (upload a document → generate any mode) so bookmarks/links don't
  // 404. Their page files and actions are removed; the legacy tables are dropped
  // by a separate cleanup migration (supabase/migrations/).
  async redirects() {
    return [
      { source: "/dashboard/quizzes", destination: "/dashboard/documents", permanent: false },
      { source: "/dashboard/quizzes/:path*", destination: "/dashboard/documents", permanent: false },
      { source: "/dashboard/cram", destination: "/dashboard/documents", permanent: false },
      { source: "/dashboard/cram/:path*", destination: "/dashboard/documents", permanent: false },
      { source: "/dashboard/mock-exam", destination: "/dashboard/documents", permanent: false },
      { source: "/dashboard/mock-exam/:path*", destination: "/dashboard/documents", permanent: false },
      { source: "/dashboard/leaderboard", destination: "/dashboard/analytics", permanent: false },
    ];
  },
};

export default nextConfig;
