import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Standalone output -> tiny Docker image, K8s-friendly.
  output: "standalone",
};

export default nextConfig;
