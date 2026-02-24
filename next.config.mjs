/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
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
