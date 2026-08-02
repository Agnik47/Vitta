import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // This app's own folder is its root — the outer repo (sibling package-lock.json at the
  // project root) is a separate, unrelated Node project (the CLI), not a workspace.
  turbopack: {
    root: __dirname,
  },
  // lib/gate-cli.ts, lib/agent-cli.ts and lib/live-search.ts all locate the compiled CLI via a
  // runtime path.join(), not a static import — Next's file-tracer can't see that and would
  // otherwise leave the compiled CLI out of the deployed function, so every gate/agent/search
  // spawn would 404 in production even though the build itself succeeds. Force it in explicitly.
  // Turbopack rejects a tracing glob that navigates outside the project root (`../dist/**`), so
  // vercel.json's buildCommand copies the root CLI build into ./dist first — this pattern must
  // stay in-root to match.
  outputFileTracingIncludes: {
    "/api/**/*": ["./dist/**/*"],
  },
};

export default nextConfig;
