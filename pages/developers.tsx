import Head from "next/head";
import type { GetStaticProps, InferGetStaticPropsType } from "next";

import { DevelopersPage } from "@/components/developers-page";
import { siteContent, type Locale } from "@/content/site-content";
import { absoluteOriginPath, absoluteSiteUrl } from "@/lib/site-config";

interface Props {
  locale: Locale;
}

export const getStaticProps: GetStaticProps<Props> = async ({ locale }) => {
  return {
    props: {
      locale: locale === "en" ? "en" : "es"
    }
  };
};

export default function DevelopersRoute({ locale }: InferGetStaticPropsType<typeof getStaticProps>) {
  const content = siteContent[locale];
  const title =
    locale === "es" ? "Fyn Desarrolladores — Integra búsqueda natural" : "Fyn Developers — Integrate natural search";
  const description =
    locale === "es"
      ? "Conecta tus LLMs y agentes al MCP de Fyn para búsqueda inmobiliaria en España."
      : "Connect your LLMs and agents to the Fyn MCP for property search across Spain.";
  const canonicalUrl = absoluteSiteUrl("/developers", locale);

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
        <meta name="twitter:card" content="summary" />
      </Head>
      <DevelopersPage locale={locale} content={content} />
    </>
  );
}
