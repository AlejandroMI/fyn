import type { GetServerSideProps } from "next";

import { getSiteOrigin } from "@/lib/site-config";

export const getServerSideProps: GetServerSideProps = async ({ res }) => {
  const origin = getSiteOrigin();
  const hostname = new URL(origin).hostname;

  res.setHeader("Content-Type", "text/plain; charset=utf-8");
  res.write(
    [
      "User-agent: *",
      "Allow: /",
      "Disallow: /api/",
      "Disallow: /mcp",
      "Disallow: /health",
      `Sitemap: ${origin}/sitemap.xml`,
      `Host: ${hostname}`
    ].join("\n")
  );
  res.end();

  return { props: {} };
};

export default function RobotsTxt() {
  return null;
}
