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
  const title = locale === "es" ? "Términos de Uso de Fyn" : "Fyn Terms of Use";
  const description =
    locale === "es"
      ? "Condiciones que regulan el uso de la app y del servicio de búsqueda inmobiliaria de Fyn."
      : "Terms governing use of the Fyn app and property-search service.";

  return (
    <InfoPageLayout
      locale={locale}
      path="/terms"
      title={title}
      description={description}
      eyebrow={locale === "es" ? "Términos" : "Terms"}
      intro={
        locale === "es"
          ? "Estos términos regulan el acceso y uso de Fyn como capa de búsqueda inmobiliaria y enlace a anuncios de terceros."
          : "These terms govern access to and use of Fyn as a property-search layer and linking surface for third-party listings."
      }
      updatedAt="March 1, 2026"
      activeHref="/terms"
      asideTitle={locale === "es" ? "Servicio informativo" : "Informational service"}
      asideBody={
        locale === "es"
          ? "Fyn ayuda a descubrir y comparar anuncios. No actúa como agente inmobiliario, intermediario financiero ni asesor legal."
          : "Fyn helps users discover and compare listings. It is not a real-estate broker, financial intermediary, or legal advisor."
      }
      asideCtaLabel={locale === "es" ? "Ver privacidad" : "Open privacy"}
      asideCtaHref="/privacy"
      asideExtra={
        <p>
          <Link href="/support" locale={locale}>
            {locale === "es" ? "Consulta soporte y canales de contacto." : "Review support and contact channels."}
          </Link>
        </p>
      }
    >
      <h2>{locale === "es" ? "1. Uso permitido" : "1. Permitted use"}</h2>
      <p>
        {locale === "es"
          ? "Puedes usar Fyn para buscar, comparar y abrir anuncios inmobiliarios. No puedes usar el servicio para realizar scraping no autorizado, eludir límites técnicos, probar ataques, generar tráfico abusivo ni infringir derechos de terceros."
          : "You may use Fyn to search, compare, and open property listings. You may not use the service to perform unauthorized scraping, evade technical limits, test attacks, generate abusive traffic, or infringe the rights of others."}
      </p>

      <h2>{locale === "es" ? "2. Precisión y disponibilidad" : "2. Accuracy and availability"}</h2>
      <p>
        {locale === "es"
          ? "Fyn intenta ofrecer resultados útiles, pero la disponibilidad, precio, imágenes, ubicación, estado o condiciones de los inmuebles pueden cambiar en cualquier momento. Los datos mostrados dependen de fuentes externas y pueden contener errores, retrasos o cambios no reflejados inmediatamente."
          : "Fyn aims to provide useful results, but property availability, pricing, imagery, location, status, and conditions may change at any time. Displayed data depends on external sources and may contain errors, delays, or changes not reflected immediately."}
      </p>

      <h2>{locale === "es" ? "3. Enlaces y contenido de terceros" : "3. Third-party links and content"}</h2>
      <p>
        {locale === "es"
          ? "Los anuncios y enlaces externos pertenecen a sus respectivos operadores. Cuando sales de Fyn para abrir un portal externo, tus interacciones quedan sujetas a las políticas y condiciones de ese tercero."
          : "External listings and links belong to their respective operators. When you leave Fyn to open an external portal, your interactions are governed by that third party's own policies and terms."}
      </p>

      <h2>{locale === "es" ? "4. Sin asesoramiento profesional" : "4. No professional advice"}</h2>
      <p>
        {locale === "es"
          ? "Fyn no proporciona asesoramiento legal, hipotecario, fiscal, técnico ni de inversión. Antes de tomar decisiones relevantes, verifica la información directamente con la fuente original y, cuando proceda, con profesionales cualificados."
          : "Fyn does not provide legal, mortgage, tax, technical, or investment advice. Before making material decisions, verify information directly with the original source and, where appropriate, with qualified professionals."}
      </p>

      <h2>{locale === "es" ? "5. Suspensión y cambios" : "5. Suspension and changes"}</h2>
      <p>
        {locale === "es"
          ? "Podemos modificar, suspender o retirar funciones, fuentes o acceso al servicio cuando resulte necesario por seguridad, cumplimiento, mantenimiento o cambios de producto."
          : "We may modify, suspend, or remove features, sources, or access to the service when necessary for security, compliance, maintenance, or product changes."}
      </p>

      <h2>{locale === "es" ? "6. Descargo de responsabilidad" : "6. Disclaimer"}</h2>
      <p>
        {locale === "es"
          ? "Salvo en la medida prohibida por la ley aplicable, Fyn se ofrece 'tal cual' y 'según disponibilidad'. No garantizamos que el servicio sea ininterrumpido, exacto, completo o apto para un fin específico."
          : "Except to the extent prohibited by applicable law, Fyn is provided 'as is' and 'as available'. We do not guarantee that the service will be uninterrupted, accurate, complete, or fit for a particular purpose."}
      </p>

      <h2>{locale === "es" ? "7. Limitación de responsabilidad" : "7. Limitation of liability"}</h2>
      <p>
        {locale === "es"
          ? "En la máxima medida permitida por la ley, no seremos responsables de daños indirectos, incidentales, especiales, consecuenciales o por pérdida de negocio derivados del uso o imposibilidad de uso del servicio."
          : "To the maximum extent permitted by law, we are not liable for indirect, incidental, special, consequential, or business-loss damages arising from use of or inability to use the service."}
      </p>

      <h2>{locale === "es" ? "8. Contacto" : "8. Contact"}</h2>
      <p>
        {locale === "es"
          ? "Si tienes preguntas sobre estos términos, utiliza el canal descrito en la página de soporte."
          : "If you have questions about these terms, use the contact channel described on the support page."}{" "}
        <Link href="/support" locale={locale}>
          {locale === "es" ? "Abrir soporte." : "Open support."}
        </Link>
      </p>
    </InfoPageLayout>
  );
}
