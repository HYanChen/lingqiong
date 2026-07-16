import type { NextConfig } from "next";

const platformApiProxyTarget = process.env.PLATFORM_API_PROXY_TARGET?.trim().replace(
  /\/+$/,
  ""
);

const nextConfig: NextConfig = {
  allowedDevOrigins: ["127.0.0.1"],
  output: "standalone",
  experimental: {
    proxyClientMaxBodySize: "22mb"
  },
  images: {
    formats: ["image/avif", "image/webp"]
  },
  serverExternalPackages: ["@napi-rs/canvas", "pdf-parse"],
  async rewrites() {
    return [
      {
        source: "/_wcu-api/:path*",
        destination: platformApiProxyTarget
          ? `${platformApiProxyTarget}/api/:path*`
          : "/api/:path*"
      },
      {
        source: "/platform-api/v1/:path*",
        destination: platformApiProxyTarget
          ? `${platformApiProxyTarget}/api/v1/:path*`
          : "/api/v1/:path*"
      },
      {
        source: "/bookstack/:path*",
        destination: "http://127.0.0.1:6875/:path*"
      }
    ];
  }
};

export default nextConfig;
