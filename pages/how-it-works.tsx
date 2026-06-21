import Head from "next/head";
import type { GetStaticProps, InferGetStaticPropsType } from "next";

import { HowItWorksPage } from "@/components/how-it-works-page";
import { siteContent, type Locale } from "@/content/site-content";
import { absoluteOriginPath, absoluteSiteUrl } from "@/lib/site-config";

interface Props {
  locale: Locale;
}

export const getStaticProps: GetStaticProps<Props> = async ({ locale }) => ({
  props: { locale: locale === "en" ? "en" : "es" }
});

export default function HowItWorksRoute({ locale }: InferGetStaticPropsType<typeof getStaticProps>) {
  const title = locale === "es" ? "Cómo funciona Fyn" : "How Fyn works";
  const description =
    locale === "es"
      ? "Descubre cómo Fyn convierte una conversación en resultados inmobiliarios comparables, explicables y enlazados a su fuente."
      : "See how Fyn turns a conversation into comparable, explainable property results linked to their source.";
  const canonicalUrl = absoluteSiteUrl("/how-it-works", locale);

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
      <HowItWorksPage locale={locale} content={siteContent[locale]} />
    </>
  );
}
