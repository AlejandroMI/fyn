import type { GetServerSideProps } from "next";

import { absoluteSiteUrl, type AppLocale } from "@/lib/site-config";

const ROUTES = ["/", "/how-it-works", "/developers", "/privacy", "/terms", "/support"] as const;
const LOCALES: AppLocale[] = ["es", "en"];

function xmlEscape(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

export const getServerSideProps: GetServerSideProps = async ({ res }) => {
  const lastmod = "2026-03-01";
  const urls = LOCALES.flatMap((locale) =>
    ROUTES.map((route) => `  <url><loc>${xmlEscape(absoluteSiteUrl(route, locale))}</loc><lastmod>${lastmod}</lastmod></url>`)
  );

  res.setHeader("Content-Type", "application/xml; charset=utf-8");
  res.write(
    [
      '<?xml version="1.0" encoding="UTF-8"?>',
      '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
      ...urls,
      "</urlset>"
    ].join("\n")
  );
  res.end();

  return { props: {} };
};

export default function SitemapXml() {
  return null;
}
