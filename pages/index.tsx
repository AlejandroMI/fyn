import Head from "next/head";
import type { GetStaticProps, InferGetStaticPropsType } from "next";

import { HomePage } from "@/components/home-page";
import { siteContent, type Locale } from "@/content/site-content";

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

  return (
    <>
      <Head>
        <title>Fyn — Find Your Nest</title>
        <meta
          name="description"
          content={
            locale === "es"
              ? "Describe tu próxima casa en lenguaje natural. Fyn devuelve matches explicables de vivienda con enlaces directos y fotos reales."
              : "Describe your next home in plain language. Fyn returns explainable housing matches with direct links and real photos."
          }
        />
      </Head>
      <HomePage locale={locale} content={content} />
    </>
  );
}
