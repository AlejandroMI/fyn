import Link from "next/link";
import type { GetStaticProps, InferGetStaticPropsType } from "next";

import { InfoPageLayout } from "@/components/info-page-layout";
import type { Locale } from "@/content/site-content";

interface Props {
  locale: Locale;
}

export const getStaticProps: GetStaticProps<Props> = async ({ locale }) => ({
  props: {
    locale: locale === "en" ? "en" : "es"
  }
});

export default function TermsPage({ locale }: InferGetStaticPropsType<typeof getStaticProps>) {
  const spanish = locale === "es";

  return (
    <InfoPageLayout
      locale={locale}
      path="/terms"
      title={spanish ? "Condiciones del experimento" : "Experiment terms"}
      description={
        spanish
          ? "Condiciones básicas de uso del experimento abierto Fyn."
          : "Basic terms for using the open Fyn experiment."
      }
      eyebrow={spanish ? "Condiciones" : "Terms"}
      intro={
        spanish
          ? "Fyn es un mini proyecto experimental que explora lo que los portales podrían construir con nuevas herramientas de IA."
          : "Fyn is a small experimental project exploring what property portals could build with new AI tools."
      }
      updatedAt="June 21, 2026"
      activeHref="/terms"
      asideTitle={spanish ? "Experimento independiente" : "Independent experiment"}
      asideBody={
        spanish
          ? "Fyn no está afiliado a los portales consultados y puede cambiar, fallar o desaparecer sin previo aviso."
          : "Fyn is not affiliated with the portals it queries and may change, fail, or disappear without notice."
      }
      asideCtaLabel={spanish ? "Ver privacidad" : "Open privacy"}
      asideCtaHref="/privacy"
      asideExtra={
        <p>
          <Link href="/support" locale={locale}>
            {spanish ? "Contacto y soporte." : "Contact and support."}
          </Link>
        </p>
      }
    >
      <h2>{spanish ? "Naturaleza experimental" : "Experimental nature"}</h2>
      <p>
        {spanish
          ? "Fyn es una demostración técnica abierta, no un portal inmobiliario, una agencia ni un servicio profesional. No garantiza continuidad, disponibilidad ni compatibilidad con fuentes externas."
          : "Fyn is an open technical demonstration, not a property portal, agency, or professional service. It does not guarantee continuity, availability, or compatibility with external sources."}
      </p>

      <h2>{spanish ? "Resultados y terceros" : "Results and third parties"}</h2>
      <p>
        {spanish
          ? "Los resultados proceden de terceros y pueden ser incompletos, incorrectos o estar desactualizados. Verifica siempre precio, disponibilidad y condiciones en la fuente original. Cada portal conserva sus marcas, contenido, políticas y condiciones. Fyn no está afiliado ni respaldado por ellos."
          : "Results come from third parties and may be incomplete, incorrect, or outdated. Always verify pricing, availability, and terms at the original source. Each portal retains its trademarks, content, policies, and terms. Fyn is not affiliated with or endorsed by them."}
      </p>

      <h2>{spanish ? "Uso responsable" : "Responsible use"}</h2>
      <p>
        {spanish
          ? "No utilices Fyn para abusar del servicio, eludir límites técnicos, atacar sistemas o infringir derechos o condiciones de terceros. Podemos limitar, modificar o retirar funciones y conectores cuando sea necesario."
          : "Do not use Fyn to abuse the service, evade technical limits, attack systems, or infringe third-party rights or terms. Features and connectors may be limited, changed, or removed when necessary."}
      </p>

      <h2>{spanish ? "Sin garantías" : "No warranty"}</h2>
      <p>
        {spanish
          ? "El experimento se ofrece tal cual y según disponibilidad. En la medida permitida por la ley, Alejandro Marco no responde de decisiones tomadas a partir de sus resultados ni de daños indirectos derivados de su uso."
          : "The experiment is provided as is and as available. To the extent permitted by law, Alejandro Marco is not responsible for decisions based on its results or for indirect damages arising from its use."}
      </p>
    </InfoPageLayout>
  );
}
