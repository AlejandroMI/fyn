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
          { key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" },
          {
            key: "Link",
            value: '</sitemap.xml>; rel="sitemap"; type="application/xml", </llms.txt>; rel="describedby"; type="text/plain", </openapi.json>; rel="service-desc"; type="application/vnd.oai.openapi+json", </.well-known/api-catalog>; rel="api-catalog"; type="application/linkset+json"'
          }
        ]
      },
      {
        source: "/:path*.md",
        headers: [
          { key: "Content-Type", value: "text/markdown; charset=utf-8" },
          { key: "Vary", value: "Accept, Accept-Encoding" }
        ]
      },
      {
        source: "/index.md",
        headers: [
          { key: "Link", value: '</>; rel="canonical", </index.md>; rel="alternate"; type="text/markdown"' }
        ]
      },
      {
        source: "/openapi.json",
        headers: [
          { key: "Content-Type", value: "application/vnd.oai.openapi+json; charset=utf-8" }
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
        source: "/.well-known/mcp",
        destination: "/api/mcp"
      },
      {
        source: "/.well-known/api-catalog",
        destination: "/api/discovery/api-catalog"
      },
      {
        source: "/developers.html",
        destination: "/developers"
      }
    ];
  }
};

export default nextConfig;
