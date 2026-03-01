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

export default function PrivacyPage({ locale }: InferGetStaticPropsType<typeof getStaticProps>) {
  const title = locale === "es" ? "Política de Privacidad de Fyn" : "Fyn Privacy Policy";
  const description =
    locale === "es"
      ? "Cómo Fyn procesa datos de búsqueda, telemetría operativa y contenido de terceros para prestar su app de búsqueda inmobiliaria."
      : "How Fyn processes search inputs, operational telemetry, and third-party listing content to provide its property-search app.";

  return (
    <InfoPageLayout
      locale={locale}
      path="/privacy"
      title={title}
      description={description}
      eyebrow={locale === "es" ? "Privacidad" : "Privacy"}
      intro={
        locale === "es"
          ? "Fyn procesa solo la información necesaria para responder a tus búsquedas, mantener la disponibilidad del servicio y enlazar resultados desde portales inmobiliarios de terceros."
          : "Fyn processes only the information needed to answer your searches, maintain service availability, and link results from third-party property portals."
      }
      updatedAt="March 1, 2026"
      activeHref="/privacy"
      asideTitle={locale === "es" ? "Datos mínimos, uso explícito" : "Minimal data, explicit use"}
      asideBody={
        locale === "es"
          ? "La app está diseñada para buscar vivienda, no para perfilar usuarios. Si tienes dudas o solicitudes de privacidad, puedes escribir al correo de soporte."
          : "The app is designed to search properties, not to profile users. For privacy questions or requests, contact support."
      }
      asideCtaLabel={locale === "es" ? "Ver soporte" : "Open support"}
      asideCtaHref="/support"
      asideExtra={
        <p>
          <Link href="/terms" locale={locale}>
            {locale === "es" ? "Lee también los términos de uso." : "Read the terms of use as well."}
          </Link>
        </p>
      }
    >
      <h2>{locale === "es" ? "1. Qué recoge Fyn" : "1. What Fyn collects"}</h2>
      <p>
        {locale === "es"
          ? "Cuando usas Fyn, podemos procesar el texto de tu consulta, filtros estructurados como ubicación, presupuesto o número de habitaciones, y la información técnica mínima necesaria para completar la solicitud."
          : "When you use Fyn, we may process your prompt text, structured filters such as location, budget, or room count, and the minimum technical data needed to complete the request."}
      </p>
      <ul>
        <li>
          {locale === "es"
            ? "Entradas de búsqueda enviadas al tool `search_properties`."
            : "Search inputs submitted to the `search_properties` tool."}
        </li>
        <li>
          {locale === "es"
            ? "Metadatos técnicos como marcas temporales, respuestas de upstream, y diagnósticos de cobertura por portal."
            : "Technical metadata such as timestamps, upstream responses, and per-portal coverage diagnostics."}
        </li>
        <li>
          {locale === "es"
            ? "Datos de uso limitados para detectar errores, abusos, bloqueos de terceros y degradación operativa."
            : "Limited usage data to detect errors, abuse, third-party blocking, and operational degradation."}
        </li>
      </ul>

      <h2>{locale === "es" ? "2. Qué no pretende recoger" : "2. What Fyn is not designed to collect"}</h2>
      <p>
        {locale === "es"
          ? "Fyn no está diseñado para solicitar categorías sensibles de datos personales. No deberías incluir información de salud, documentos de identidad, datos financieros completos ni otra información altamente sensible en tus consultas."
          : "Fyn is not designed to request sensitive categories of personal data. You should not include health information, identity documents, full financial details, or other highly sensitive information in your prompts."}
      </p>

      <h2>{locale === "es" ? "3. Cómo usamos la información" : "3. How information is used"}</h2>
      <ul>
        <li>
          {locale === "es"
            ? "Responder a tu búsqueda y mostrar resultados relevantes."
            : "To answer your search and show relevant results."}
        </li>
        <li>
          {locale === "es"
            ? "Mantener, asegurar y depurar la app y su infraestructura."
            : "To maintain, secure, and debug the app and its infrastructure."}
        </li>
        <li>
          {locale === "es"
            ? "Analizar fallos, límites de rate, bloqueos anti-bot y cambios en esquemas de terceros."
            : "To analyze failures, rate limits, anti-bot blocks, and third-party schema changes."}
        </li>
      </ul>

      <h2>{locale === "es" ? "4. Fuentes y terceros" : "4. Sources and third parties"}</h2>
      <p>
        {locale === "es"
          ? "Fyn consulta portales inmobiliarios externos para recuperar anuncios, miniaturas, precios, enlaces y otra información de disponibilidad. Cada portal externo aplica sus propias políticas, y al abrir un anuncio sales de Fyn y pasas a regirte por las condiciones del portal de destino."
          : "Fyn queries external property portals to retrieve listings, thumbnails, prices, links, and other availability information. Each external portal applies its own policies, and when you open a listing you leave Fyn and become subject to the destination portal's terms."}
      </p>

      <h2>{locale === "es" ? "5. Conservación" : "5. Retention"}</h2>
      <p>
        {locale === "es"
          ? "Conservamos datos operativos solo durante el tiempo razonablemente necesario para prestar el servicio, diagnosticar incidencias, prevenir abuso y cumplir obligaciones legales. Podemos acortar o ampliar periodos de retención cuando sea necesario por seguridad, cumplimiento o resolución de incidentes."
          : "We retain operational data only for as long as reasonably necessary to provide the service, diagnose incidents, prevent abuse, and satisfy legal obligations. Retention periods may be shortened or extended when required for security, compliance, or incident resolution."}
      </p>

      <h2>{locale === "es" ? "6. Seguridad" : "6. Security"}</h2>
      <p>
        {locale === "es"
          ? "Aplicamos controles técnicos y organizativos razonables para limitar el acceso, reducir la exposición de datos y proteger la infraestructura. Ningún sistema es completamente infalible, por lo que no podemos garantizar seguridad absoluta."
          : "We apply reasonable technical and organizational controls to limit access, reduce data exposure, and protect the infrastructure. No system is completely infallible, so we cannot guarantee absolute security."}
      </p>

      <h2>{locale === "es" ? "7. Tus derechos y solicitudes" : "7. Your rights and requests"}</h2>
      <p>
        {locale === "es"
          ? "Puedes solicitar acceso, corrección o supresión de datos personales que podamos mantener, sujeto a verificación razonable y a la legislación aplicable. Para ello, usa el canal indicado en la página de soporte."
          : "You may request access, correction, or deletion of personal data we may hold, subject to reasonable verification and applicable law. Use the contact channel listed on the support page."}
      </p>

      <h2>{locale === "es" ? "8. Cambios en esta política" : "8. Changes to this policy"}</h2>
      <p>
        {locale === "es"
          ? "Podemos actualizar esta política para reflejar cambios del producto, requisitos legales o ajustes operativos. La versión publicada en esta URL es la versión vigente."
          : "We may update this policy to reflect product changes, legal requirements, or operational adjustments. The version published at this URL is the current version."}
      </p>
    </InfoPageLayout>
  );
}
