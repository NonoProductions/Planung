import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Dev only: lets the iOS Simulator / in-app web view load dev assets when
  // the dev server listens on all interfaces (next dev -H 0.0.0.0).
  allowedDevOrigins: ["127.0.0.1"],
};

export default nextConfig;
