import type { GetStaticProps, InferGetStaticPropsType } from "next";

import { InfoPageLayout } from "@/components/info-page-layout";
import type { Locale } from "@/content/site-content";
import { GITHUB_REPOSITORY_URL, SUPPORT_EMAIL } from "@/lib/site-config";

interface Props { locale: Locale }

export const getStaticProps: GetStaticProps<Props> = async ({ locale }) => ({
  props: { locale: locale === "en" ? "en" : "es" }
});

export default function AboutPage({ locale }: InferGetStaticPropsType<typeof getStaticProps>) {
  const spanish = locale === "es";

  return (
    <InfoPageLayout
      locale={locale}
      path="/about"
      title={spanish ? "Sobre Fyn" : "About Fyn"}
      description={spanish ? "Identidad, propósito, límites y modelo operativo del proyecto abierto Fyn." : "Identity, purpose, limits, and operating model of the open Fyn project."}
      eyebrow={spanish ? "Sobre el proyecto" : "About the project"}
      intro={spanish ? "Fyn (Find Your Nest) es un experimento independiente y de código abierto que hace que la búsqueda inmobiliaria española sea más accesible para personas y agentes de IA." : "Fyn (Find Your Nest) is an independent, open-source experiment that makes Spanish property search more accessible to people and AI agents."}
      updatedAt="June 21, 2026"
      activeHref="/about"
      asideTitle={spanish ? "Proyecto abierto" : "Open project"}
      asideBody={spanish ? "El código, los contratos y las instrucciones para contribuir son públicos. Fyn no está afiliado con los portales consultados." : "The code, contracts, and contribution instructions are public. Fyn is not affiliated with the portals it searches."}
      asideCtaLabel="GitHub"
      asideCtaHref={GITHUB_REPOSITORY_URL}
    >
      <h2>{spanish ? "Qué hace Fyn" : "What Fyn does"}</h2>
      <p>{spanish ? "Fyn convierte criterios humanos —ciudad, presupuesto, habitaciones, tipo de vivienda o preferencias como luz y naturaleza— en búsquedas estructuradas. Consulta varias fuentes públicas y devuelve resultados normalizados con el enlace original, explicación de encaje y diagnóstico de cobertura. Para desarrolladores, esta capacidad se expone mediante un servidor MCP Streamable HTTP con un contrato estable." : "Fyn turns human criteria—city, budget, rooms, property type, or preferences such as light and nature—into structured searches. It queries several public sources and returns normalized results with original links, match explanations, and coverage diagnostics. Developers access this capability through a Streamable HTTP MCP server with a stable contract."}</p>

      <h2>{spanish ? "Por qué existe" : "Why it exists"}</h2>
      <p>{spanish ? "La oferta inmobiliaria está repartida entre portales con filtros, formatos y cobertura distintos. Fyn prueba una capa común para reducir búsquedas repetidas y permitir que asistentes y aplicaciones trabajen con un solo modelo de datos sin ocultar la procedencia de cada anuncio." : "Property supply is split across portals with different filters, formats, and coverage. Fyn tests a common layer that reduces repeated searches and lets assistants and applications use one data model without hiding where each listing came from."}</p>

      <h2>{spanish ? "Responsabilidad y límites" : "Responsibility and limits"}</h2>
      <p>{spanish ? "Alejandro Marco mantiene el experimento. Fyn sirve para descubrir anuncios; no vende, reserva, valora ni verifica legalmente inmuebles. La disponibilidad y los datos pueden cambiar, y cada persona debe confirmar precio, estado y condiciones con el portal o anunciante original antes de tomar una decisión." : "Alejandro Marco maintains the experiment. Fyn is for listing discovery; it does not sell, reserve, value, or legally verify property. Availability and listing data can change, and every user must confirm price, condition, and terms with the original portal or advertiser before making a decision."}</p>

      <h2>{spanish ? "Contacto y transparencia" : "Contact and transparency"}</h2>
      <p>{spanish ? "Las incidencias operativas, preguntas de privacidad y propuestas de colaboración se pueden enviar a " : "Operational issues, privacy questions, and collaboration proposals can be sent to "}<a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>. {spanish ? "La arquitectura y el historial técnico están disponibles en el repositorio público." : "The architecture and technical history are available in the public repository."}</p>
    </InfoPageLayout>
  );
}
