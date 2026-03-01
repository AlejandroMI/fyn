import Head from "next/head";
import type { GetStaticProps, InferGetStaticPropsType } from "next";

import { HomePage } from "@/components/home-page";
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

export default function IndexPage({ locale }: InferGetStaticPropsType<typeof getStaticProps>) {
  const content = siteContent[locale];
  const title = "Fyn — Find Your Nest";
  const description =
    locale === "es"
      ? "Describe tu próxima casa en lenguaje natural. Fyn devuelve matches explicables de vivienda con enlaces directos y fotos reales."
      : "Describe your next home in plain language. Fyn returns explainable housing matches with direct links and real photos.";
  const canonicalUrl = absoluteSiteUrl("/", locale);

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
      </Head>
      <HomePage locale={locale} content={content} />
    </>
  );
}
