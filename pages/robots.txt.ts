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
      "Disallow: /api/connector-status/refresh",
      "",
      "User-agent: ChatGPT-User",
      "Allow: /",
      "",
      "User-agent: ClaudeBot",
      "Allow: /",
      "",
      "User-agent: Google-Extended",
      "Allow: /",
      "",
      "User-agent: CCBot",
      "Disallow: /",
      "",
      "User-agent: Bytespider",
      "Disallow: /",
      "",
      "Content-Signal: search=yes, ai-input=yes, ai-train=no",
      `Schemamap: ${origin}/schema-map.xml`,
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
