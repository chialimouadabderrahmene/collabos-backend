import path from "node:path";
import type { NextConfig } from "next";

const apiUrl = (process.env.API_URL ?? "http://localhost:3000").replace(/\/+$/, "");

const nextConfig: NextConfig = {
  // The app lives in frontend/ inside the backend repository; pin the
  // workspace root so the backend's lockfile is never picked up.
  turbopack: { root: path.resolve(__dirname) },
  outputFileTracingRoot: path.resolve(__dirname),
  poweredByHeader: false,
  reactStrictMode: true,
  // Legacy media (brand logos/covers, drop/product media) is served by the
  // backend under /uploads/* with backend-relative URLs. Rewrite them through
  // this origin so the backend URL stays server-side configuration.
  async rewrites() {
    return [{ source: "/uploads/:path*", destination: `${apiUrl}/uploads/:path*` }];
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
        ],
      },
      {
        // Private share pages must not leak their token via Referer or be indexed.
        source: "/share/:token*",
        headers: [
          { key: "Referrer-Policy", value: "no-referrer" },
          { key: "X-Robots-Tag", value: "noindex, nofollow" },
        ],
      },
      ...["/reset-password", "/verify-email"].map((source) => ({
        // Emailed single-use tokens arrive in the query string.
        source,
        headers: [
          { key: "Referrer-Policy", value: "no-referrer" },
          { key: "X-Robots-Tag", value: "noindex, nofollow" },
        ],
      })),
    ];
  },
};

export default nextConfig;
