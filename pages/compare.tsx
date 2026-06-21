import type { GetStaticProps, InferGetStaticPropsType } from "next";

import { InfoPageLayout } from "@/components/info-page-layout";
import type { Locale } from "@/content/site-content";

interface Props { locale: Locale }

export const getStaticProps: GetStaticProps<Props> = async ({ locale }) => ({
  props: { locale: locale === "en" ? "en" : "es" }
});

export default function ComparePage({ locale }: InferGetStaticPropsType<typeof getStaticProps>) {
  const spanish = locale === "es";

  return (
    <InfoPageLayout
      locale={locale}
      path="/compare"
      title={spanish ? "Fyn frente a búsquedas de un solo portal" : "Fyn vs. single-portal property search"}
      description={spanish ? "Comparación transparente entre la capa MCP multiportal de Fyn, asistentes de portales individuales e integraciones personalizadas." : "A transparent comparison of Fyn's multi-portal MCP layer, individual portal assistants, and custom integrations."}
      eyebrow={spanish ? "Comparación" : "Comparison"}
      intro={spanish ? "Fyn no intenta sustituir a Idealista, Fotocasa ni otros portales. Los consulta como fuentes y ofrece a los agentes una capa común cuando una búsqueda necesita más cobertura que una sola fuente." : "Fyn does not try to replace Idealista, Fotocasa, or other portals. It treats them as sources and gives agents a common layer when a search needs broader coverage than one source."}
      updatedAt="June 21, 2026"
      activeHref="/compare"
      asideTitle={spanish ? "Resumen" : "Summary"}
      asideBody={spanish ? "Elige un portal directo para su experiencia completa. Elige Fyn cuando importan la búsqueda multiportal, un contrato MCP único y diagnósticos normalizados." : "Choose a portal directly for its complete first-party experience. Choose Fyn when multi-portal search, one MCP contract, and normalized diagnostics matter."}
      asideCtaLabel={spanish ? "Ver guía técnica" : "Open developer guide"}
      asideCtaHref="/developers"
    >
      <h2>{spanish ? "Fyn: agregación multiportal para agentes" : "Fyn: multi-portal aggregation for agents"}</h2>
      <p>{spanish ? "A diferencia de una integración de un solo portal, Fyn permite pedir varias ubicaciones y fuentes con el mismo conjunto de campos. Normaliza resultados, conserva el enlace de origen y explica qué portales y ubicaciones se pudieron consultar. Esto reduce lógica específica en el agente, pero no garantiza cobertura exhaustiva: los portales pueden bloquear automatización o cambiar sus interfaces." : "Unlike a single-portal integration, Fyn lets an agent query several locations and sources with the same fields. It normalizes results, preserves source links, and explains which portals and locations were reached. This reduces portal-specific logic in the agent, but does not guarantee exhaustive coverage: portals can block automation or change their interfaces."}</p>

      <h2>{spanish ? "Idealista o Fotocasa directamente" : "Idealista or Fotocasa directly"}</h2>
      <p>{spanish ? "La experiencia directa de un portal suele ofrecer sus datos más completos, alertas, cuentas y funciones comerciales propias. Es la opción adecuada cuando el usuario ya ha elegido ese portal o necesita una función exclusiva. Su límite para un agente comparador es que el contrato, cobertura y comportamiento pertenecen a una sola fuente." : "A portal's first-party experience usually provides its most complete data, alerts, accounts, and commercial features. It is the right choice when a user has chosen that portal or needs an exclusive feature. For a comparison agent, its limit is that the contract, coverage, and behavior belong to one source."}</p>

      <h2>{spanish ? "Integración personalizada" : "Custom integration"}</h2>
      <p>{spanish ? "Una integración propia da máximo control sobre fuentes, almacenamiento, cumplimiento y lógica de ranking. También exige construir y mantener conectores, normalización, seguridad, límites y observabilidad. Fyn es útil como punto de partida abierto o como servicio ligero cuando ese coste no está justificado." : "A custom integration gives maximum control over sources, storage, compliance, and ranking. It also requires building and maintaining connectors, normalization, security, rate limits, and observability. Fyn is useful as an open starting point or a lightweight service when that cost is not justified."}</p>

      <h2>{spanish ? "Decisión rápida" : "Quick decision"}</h2>
      <ul>
        <li>{spanish ? "Usa Fyn para prototipos y agentes que necesitan una búsqueda común entre varios portales españoles." : "Use Fyn for prototypes and agents that need one search contract across several Spanish portals."}</li>
        <li>{spanish ? "Usa el portal directamente para cuentas, alertas y funciones propias de ese portal." : "Use a portal directly for accounts, alerts, and portal-specific features."}</li>
        <li>{spanish ? "Construye una integración propia cuando necesites garantías, datos licenciados, escritura o flujos transaccionales." : "Build a custom integration when you need guarantees, licensed data, write operations, or transactional workflows."}</li>
      </ul>
    </InfoPageLayout>
  );
}
