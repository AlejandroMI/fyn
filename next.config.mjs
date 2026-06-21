/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
          { key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" }
        ]
      }
    ];
  },
  i18n: {
    locales: ["es", "en"],
    defaultLocale: "es",
    localeDetection: false
  },
  async rewrites() {
    return [
      {
        source: "/mcp",
        destination: "/api/mcp"
      },
      {
        source: "/health",
        destination: "/api/health"
      },
      {
        source: "/developers.html",
        destination: "/developers"
      }
    ];
  }
};

export default nextConfig;
