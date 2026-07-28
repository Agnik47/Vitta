import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // This app's own folder is its root — the outer repo (sibling package-lock.json at the
  // project root) is a separate, unrelated Node project (the CLI), not a workspace.
  turbopack: {
    root: __dirname,
  },
};

export default nextConfig;
