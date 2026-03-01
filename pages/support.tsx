import type { GetStaticProps, InferGetStaticPropsType } from "next";
import Link from "next/link";

import { InfoPageLayout } from "@/components/info-page-layout";
import type { Locale } from "@/content/site-content";
import { SUPPORT_EMAIL } from "@/lib/site-config";

interface Props {
  locale: Locale;
}

export const getStaticProps: GetStaticProps<Props> = async ({ locale }) => ({
  props: {
    locale: locale === "en" ? "en" : "es"
  }
});

export default function SupportPage({ locale }: InferGetStaticPropsType<typeof getStaticProps>) {
  const title = locale === "es" ? "Soporte de Fyn" : "Fyn Support";
  const description =
    locale === "es"
      ? "Canales de contacto, salud del servicio y pautas para resolver incidencias con la app de Fyn."
      : "Contact channel, service health, and guidance for resolving issues with the Fyn app.";

  return (
    <InfoPageLayout
      locale={locale}
      path="/support"
      title={title}
      description={description}
      eyebrow={locale === "es" ? "Soporte" : "Support"}
      intro={
        locale === "es"
          ? "Si Fyn no devuelve resultados, ves enlaces rotos o detectas información incorrecta, usa esta página como referencia operativa y de contacto."
          : "If Fyn does not return results, shows broken links, or surfaces incorrect information, use this page as the operational and contact reference."
      }
      updatedAt="March 1, 2026"
      activeHref="/support"
      asideTitle={locale === "es" ? "Estado y escalado" : "Status and escalation"}
      asideBody={
        locale === "es"
          ? "Primero comprueba el estado del servicio. Si el problema persiste, envía una descripción breve con la ciudad, filtros y hora aproximada de la incidencia."
          : "Check service status first. If the issue persists, send a short description with the city, filters, and approximate time of the issue."
      }
      asideCtaLabel={locale === "es" ? "Ver health endpoint" : "Open health endpoint"}
      asideCtaHref="/health"
    >
      <h2>{locale === "es" ? "1. Contacto" : "1. Contact"}</h2>
      <p>
        {locale === "es"
          ? "Para soporte operativo, privacidad o incidencias de disponibilidad, escribe a "
          : "For operational support, privacy requests, or availability issues, email "}
        <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>.
      </p>

      <h2>{locale === "es" ? "2. Qué incluir en tu mensaje" : "2. What to include in your message"}</h2>
      <ul>
        <li>
          {locale === "es"
            ? "La consulta o flujo exacto que produjo el problema."
            : "The exact query or flow that produced the issue."}
        </li>
        <li>
          {locale === "es"
            ? "La ciudad o municipios usados y filtros relevantes."
            : "The city or municipalities used and any relevant filters."}
        </li>
        <li>
          {locale === "es"
            ? "La hora aproximada en la que ocurrió el error."
            : "The approximate time when the issue occurred."}
        </li>
        <li>
          {locale === "es"
            ? "Capturas o enlaces, si ayudan a reproducirlo."
            : "Screenshots or links, if they help reproduce the problem."}
        </li>
      </ul>

      <h2>{locale === "es" ? "3. Comprobaciones rápidas" : "3. Quick checks"}</h2>
      <ul>
        <li>
          {locale === "es"
            ? "Comprueba si el servicio responde en el endpoint de salud."
            : "Check whether the service responds on the health endpoint."}
        </li>
        <li>
          {locale === "es"
            ? "Intenta una consulta con menos restricciones o con otra ciudad para descartar un bloqueo puntual del portal."
            : "Retry with fewer constraints or another city to rule out a portal-specific block."}
        </li>
        <li>
          {locale === "es"
            ? "Si un enlace externo falla, confirma el anuncio directamente en el portal de origen."
            : "If an external link fails, verify the listing directly on the source portal."}
        </li>
      </ul>

      <h2>{locale === "es" ? "4. Enlaces útiles" : "4. Useful links"}</h2>
      <ul>
        <li>
          <a href="/health">/health</a>
        </li>
        <li>
          <Link href="/privacy" locale={locale}>
            /privacy
          </Link>
        </li>
        <li>
          <Link href="/terms" locale={locale}>
            /terms
          </Link>
        </li>
      </ul>
    </InfoPageLayout>
  );
}
