import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The dev overlay badge sits bottom-left, over the floating widget.
  devIndicators: false,
  experimental: {
    // Next's default (30s) lets the client-side Router Cache serve a stale
    // snapshot of a dynamic page — e.g. navigating to "/employer" shortly
    // after finishing onboarding can replay an old snapshot instead of
    // re-running the server's redirect-to-dashboard check. Forcing this to
    // 0 means every navigation to a dynamic route (including clicking the
    // logo, which round-trips through "/" -> "/employer") always re-fetches
    // from the server.
    staleTimes: { dynamic: 0 },
  },
};

export default nextConfig;
