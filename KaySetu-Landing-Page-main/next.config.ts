import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Allow the dev server's HMR/assets to be loaded from LAN devices
  // (e.g. testing on a phone). Add any host you open the dev site from.
  allowedDevOrigins: ["192.168.1.13", "localhost", "127.0.0.1"],
  // The module tour used to live at /walkthrough — keep old links working.
  // Query strings (?module=...) are passed through automatically.
  async redirects() {
    return [
      { source: "/walkthrough", destination: "/modules", permanent: true },
    ];
  },
  images: {
    // Allow first-party SVGs (e.g. the hero illustration) through next/image.
    // Sandboxed + CSP so the optimizer can't execute anything inside them.
    dangerouslyAllowSVG: true,
    contentDispositionType: "inline",
    contentSecurityPolicy: "default-src 'self'; script-src 'none'; sandbox;",
  },
};

export default nextConfig;
