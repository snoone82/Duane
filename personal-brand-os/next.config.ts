import type { NextConfig } from "next";
import path from "node:path";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // This app lives nested inside the Aligned repo (see README's "separate
  // project" note), which has its own root-level package-lock.json. Without
  // this, Next.js's workspace-root inference finds that outer lockfile and
  // traces file dependencies from the wrong directory.
  outputFileTracingRoot: path.join(__dirname),
};

export default nextConfig;
