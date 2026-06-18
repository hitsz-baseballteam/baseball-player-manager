import type { NextConfig } from "next";

export const CONTENT_SECURITY_POLICY = [
  "default-src 'self'",
  "base-uri 'self'",
  "connect-src 'self'",
  "font-src 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  "img-src 'self' data:",
  "object-src 'none'",
  // Next App Router injects bootstrap scripts needed for hydration and client navigation.
  // `unsafe-eval` is required by React in development mode (Turbopack / HMR).
  process.env.NODE_ENV === "development"
    ? "script-src 'self' 'unsafe-inline' 'unsafe-eval'"
    : "script-src 'self' 'unsafe-inline'",
  "style-src 'self' 'unsafe-inline'",
].join("; ");

const nextConfig: NextConfig = {
  poweredByHeader: false,
  async redirects() {
    return [
      {
        source: "/players/:playerId/games",
        destination: "/panel/players/:playerId/games",
        permanent: true,
      },
      {
        source: "/players/:playerId",
        destination: "/panel/players/:playerId",
        permanent: true,
      },
      {
        source: "/roster",
        destination: "/panel/roster",
        permanent: true,
      },
      {
        source: "/scenarios",
        destination: "/panel/scenarios",
        permanent: true,
      },
      {
        source: "/lineup",
        destination: "/panel/scenarios",
        permanent: true,
      },
      {
        source: "/stats",
        destination: "/panel/stats",
        permanent: true,
      },
      {
        source: "/settings",
        destination: "/panel/settings",
        permanent: true,
      },
    ];
  },
  async headers() {
    const privateHeaders = [
      {
        key: "Content-Security-Policy",
        value: CONTENT_SECURITY_POLICY,
      },
      {
        key: "Cache-Control",
        value: "private, no-store, max-age=0",
      },
      {
        key: "Cloudflare-CDN-Cache-Control",
        value: "no-store",
      },
      {
        key: "Permissions-Policy",
        value: "camera=(), geolocation=(), microphone=()",
      },
      {
        key: "Referrer-Policy",
        value: "strict-origin-when-cross-origin",
      },
      {
        key: "X-Content-Type-Options",
        value: "nosniff",
      },
      {
        key: "X-Frame-Options",
        value: "DENY",
      },
    ];

    return [
      {
        source: "/assets/:path*.webp",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=31536000, immutable",
          },
          {
            key: "Cloudflare-CDN-Cache-Control",
            value: "public, max-age=31536000, immutable",
          },
        ],
      },
      {
        source: "/team/:path*.webp",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=31536000, immutable",
          },
          {
            key: "Cloudflare-CDN-Cache-Control",
            value: "public, max-age=31536000, immutable",
          },
        ],
      },
      {
        source: "/:path*",
        headers: privateHeaders.filter((header) => header.key !== "Cache-Control" && header.key !== "Cloudflare-CDN-Cache-Control"),
      },
      {
        source: "/panel/:path*",
        headers: privateHeaders,
      },
      {
        source: "/api/:path*",
        headers: privateHeaders,
      },
    ];
  },
};

export default nextConfig;
