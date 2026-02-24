import Head from "next/head";
import type { GetStaticProps, InferGetStaticPropsType } from "next";

import { DevelopersPage } from "@/components/developers-page";
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

export default function DevelopersRoute({ locale }: InferGetStaticPropsType<typeof getStaticProps>) {
  const content = siteContent[locale];

  return (
    <>
      <Head>
        <title>{locale === "es" ? "Fyn Desarrolladores — Integra búsqueda natural" : "Fyn Developers — Integrate natural search"}</title>
        <meta
          name="description"
          content={
            locale === "es"
              ? "Conecta tus LLMs y agentes al MCP de Fyn para búsqueda inmobiliaria en España."
              : "Connect your LLMs and agents to the Fyn MCP for property search across Spain."
          }
        />
      </Head>
      <DevelopersPage locale={locale} content={content} />
    </>
  );
}
