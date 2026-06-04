import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  output: "standalone",
  turbopack: {
    // absolute monorepo root so Turbopack resolves workspace packages correctly
    root: path.resolve(__dirname, "..", ".."),
  },
  experimental: {
    externalDir: true,
  },
};

export default nextConfig;
