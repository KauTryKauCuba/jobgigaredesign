import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The dev overlay badge sits bottom-left, over the floating widget.
  devIndicators: false,
  // ffmpeg-static resolves its bundled binary's path at runtime — bundling
  // would rewrite that path, so it's loaded with plain Node `require` instead.
  // Used to convert video pitches to 480p MP4 (src/lib/video-pitch.ts).
  serverExternalPackages: ["ffmpeg-static"],
  // An SVG can carry scripts. Uploaded ones still show as images (<img> never
  // runs them), but opened directly they mustn't run on this site's origin.
  async headers() {
    return [
      {
        source: "/uploads/:file(.*\\.svg)",
        headers: [
          { key: "Content-Security-Policy", value: "default-src 'none'; style-src 'unsafe-inline'; sandbox" },
          { key: "X-Content-Type-Options", value: "nosniff" },
        ],
      },
    ];
  },
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
