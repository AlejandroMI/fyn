import Head from "next/head";
import type { GetServerSideProps, InferGetServerSidePropsType } from "next";
import { readFile } from "node:fs/promises";
import path from "node:path";

import { HomePage } from "@/components/home-page";
import { siteContent, type Locale } from "@/content/site-content";
import { absoluteOriginPath, absoluteSiteUrl } from "@/lib/site-config";

interface Props {
  locale: Locale;
}

export const getServerSideProps: GetServerSideProps<Props> = async ({ locale, query, req, res }) => {
  if (query.mode === "agent") {
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.setHeader("Cache-Control", "public, max-age=300, stale-while-revalidate=3600");
    res.statusCode = 200;
    res.end(
      JSON.stringify(
        {
          name: "Fyn",
          description: "Normalized multi-portal property search for Spain, designed for AI agents.",
          capabilities: ["property_search", "multi_portal_aggregation", "source_attribution", "match_explanations"],
          authentication: { type: "none", note: "Public anonymous access; rate limits apply." },
          endpoints: {
            mcp: "https://fynfyn.top/mcp",
            mcp_discovery: "https://fynfyn.top/.well-known/mcp",
            openapi: "https://fynfyn.top/openapi.json",
            health: "https://fynfyn.top/health"
          },
          tools: [{ name: "search_properties", required_guidance: "Provide city or locations for strict searches." }],
          constraints: [
            "Fyn does not reserve, purchase, value, or legally verify property.",
            "Listings and portal availability can change; verify details at the source URL.",
            "Do not send personal or sensitive information in search criteria."
          ],
          documentation: "https://fynfyn.top/llms-full.txt",
          source: "https://github.com/AlejandroMI/fyn"
        },
        null,
        2
      )
    );

    return { props: { locale: locale === "en" ? "en" : "es" } };
  }

  if (req.headers.accept?.split(",").some((value) => value.trim().startsWith("text/markdown"))) {
    const markdown = await readFile(path.join(process.cwd(), "public", "index.md"), "utf8");
    res.setHeader("Content-Type", "text/markdown; charset=utf-8");
    res.setHeader("Vary", "Accept, Accept-Encoding");
    res.setHeader("Content-Location", "/index.md");
    res.statusCode = 200;
    res.end(markdown);

    return { props: { locale: locale === "en" ? "en" : "es" } };
  }

  return {
    props: {
      locale: locale === "en" ? "en" : "es"
    }
  };
};

export default function IndexPage({ locale }: InferGetServerSidePropsType<typeof getServerSideProps>) {
  const content = siteContent[locale];
  const title = "Fyn — Find Your Nest";
  const description =
    locale === "es"
      ? "Describe tu próxima casa en lenguaje natural. Fyn devuelve matches explicables de vivienda con enlaces directos y fotos reales."
      : "Describe your next home in plain language. Fyn returns explainable housing matches with direct links and real photos.";
  const canonicalUrl = absoluteSiteUrl("/", locale);
  const structuredData = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Organization",
        "@id": "https://fynfyn.top/#organization",
        name: "Fyn",
        alternateName: "Find Your Nest",
        url: "https://fynfyn.top",
        logo: absoluteOriginPath("/web/fynlogo.png"),
        email: "support@fynfyn.top",
        sameAs: ["https://github.com/AlejandroMI/fyn"],
        contactPoint: {
          "@type": "ContactPoint",
          email: "support@fynfyn.top",
          contactType: "customer support",
          availableLanguage: ["Spanish", "English"]
        }
      },
      {
        "@type": "WebSite",
        "@id": "https://fynfyn.top/#website",
        url: "https://fynfyn.top",
        name: "Fyn — Find Your Nest",
        publisher: { "@id": "https://fynfyn.top/#organization" },
        inLanguage: ["es", "en"],
        speakable: {
          "@type": "SpeakableSpecification",
          cssSelector: [".hero-content h1", ".hero-content > p", "#use-cases .section-copy"]
        }
      },
      {
        "@type": "SoftwareApplication",
        "@id": "https://fynfyn.top/#software",
        name: "Fyn",
        alternateName: "Find Your Nest",
        url: "https://fynfyn.top",
        applicationCategory: "RealEstateApplication",
        applicationSubCategory: "AI property search",
        operatingSystem: "Web",
        softwareVersion: "0.1.0",
        isAccessibleForFree: true,
        codeRepository: "https://github.com/AlejandroMI/fyn",
        offers: { "@type": "Offer", price: "0", priceCurrency: "EUR", description: "Public experimental access" },
        description,
        provider: { "@id": "https://fynfyn.top/#organization" }
      },
      {
        "@type": "FAQPage",
        "@id": "https://fynfyn.top/#faq",
        mainEntity: [
          {
            "@type": "Question",
            name: "What is Fyn?",
            acceptedAnswer: { "@type": "Answer", text: "Fyn is an open-source property-search service that gives people and AI agents one normalized interface for searching multiple public Spanish property portals." }
          },
          {
            "@type": "Question",
            name: "Does Fyn require authentication?",
            acceptedAnswer: { "@type": "Answer", text: "No. The current public MCP endpoint uses anonymous, rate-limited access and does not require an account, API key, OAuth token, or payment." }
          },
          {
            "@type": "Question",
            name: "Can Fyn buy or reserve a property?",
            acceptedAnswer: { "@type": "Answer", text: "No. Fyn supports property discovery only. Users must verify availability and details with the original portal or listing contact." }
          }
        ]
      }
    ]
  };

  return (
    <>
      <Head>
        <title>{title}</title>
        <meta name="description" content={description} />
        <meta name="robots" content="index,follow" />
        <link rel="canonical" href={canonicalUrl} />
        <meta property="og:type" content="website" />
        <meta property="og:title" content={title} />
        <meta property="og:description" content={description} />
        <meta property="og:url" content={canonicalUrl} />
        <meta property="og:image" content={absoluteOriginPath("/web/fynlogo.png")} />
        <meta name="twitter:card" content="summary_large_image" />
        <link rel="alternate" type="text/markdown" href={absoluteOriginPath("/index.md")} />
        <link rel="service-desc" type="application/vnd.oai.openapi+json" href={absoluteOriginPath("/openapi.json")} />
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }} />
      </Head>
      <HomePage locale={locale} content={content} />
    </>
  );
}
