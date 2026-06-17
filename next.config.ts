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
    // Panel pages are session-dependent (per-user) and must not be
    // cached by browsers or CDN.
    const panelPrivateHeaders = [
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

    // API endpoints get the security headers but NOT the no-store
    // Cache-Control by default — individual route handlers are
    // responsible for their own Cache-Control policy. This is
    // important because `next.config.ts` headers take precedence
    // over route handler `headers` overrides, so any API endpoint
    // that wants a non-default Cache-Control (e.g. `/api/workspace`
    // with the P1-2 short-window cache) must either omit
    // `Cache-Control` here or be excluded from this default.
    const apiSecurityHeaders = panelPrivateHeaders.filter(
      (header) =>
        header.key !== "Cache-Control" &&
        header.key !== "Cloudflare-CDN-Cache-Control",
    );

    return [
      {
        source: "/:path*",
        headers: apiSecurityHeaders,
      },
      {
        source: "/panel/:path*",
        headers: panelPrivateHeaders,
      },
      {
        source: "/api/:path*",
        headers: apiSecurityHeaders,
      },
    ];
  },
};

export default nextConfig;
