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
  const title = locale === "es" ? "Cómo funciona Fyn por dentro" : "How Fyn works under the hood";
  const description =
    locale === "es"
      ? "Arquitectura, conectores, normalización, ranking y límites del experimento de búsqueda inmobiliaria con IA de Fyn."
      : "Architecture, connectors, normalization, ranking, and limitations of Fyn's experimental AI property search project.";
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
