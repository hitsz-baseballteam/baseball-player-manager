import type { NextConfig } from "next";

const nextConfig: NextConfig = {
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
        key: "Cache-Control",
        value: "private, no-store, max-age=0",
      },
      {
        key: "Cloudflare-CDN-Cache-Control",
        value: "no-store",
      },
    ];

    return [
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
