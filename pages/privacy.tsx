import Link from "next/link";
import type { GetStaticProps, InferGetStaticPropsType } from "next";

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

export default function PrivacyPage({ locale }: InferGetStaticPropsType<typeof getStaticProps>) {
  const spanish = locale === "es";

  return (
    <InfoPageLayout
      locale={locale}
      path="/privacy"
      title={spanish ? "Privacidad" : "Privacy"}
      description={
        spanish
          ? "Información básica sobre los datos tratados por el experimento Fyn."
          : "Basic information about data processed by the Fyn experiment."
      }
      eyebrow={spanish ? "Privacidad" : "Privacy"}
      intro={
        spanish
          ? "Fyn es un experimento independiente. No crea perfiles de usuario ni vende datos personales."
          : "Fyn is an independent experiment. It does not build user profiles or sell personal data."
      }
      updatedAt="June 21, 2026"
      activeHref="/privacy"
      asideTitle={spanish ? "Contacto" : "Contact"}
      asideBody={
        spanish
          ? "Para cualquier cuestión o solicitud relacionada con privacidad, utiliza el correo de soporte del proyecto."
          : "For privacy questions or requests, use the project's support address."
      }
      asideCtaLabel={spanish ? "Ver soporte" : "Open support"}
      asideCtaHref="/support"
      asideExtra={
        <p>
          <Link href="/terms" locale={locale}>
            {spanish ? "Consulta también las condiciones del experimento." : "See the experiment terms as well."}
          </Link>
        </p>
      }
    >
      <h2>{spanish ? "Responsable" : "Controller"}</h2>
      <p>
        {spanish ? "Alejandro Marco es el responsable de Fyn." : "Alejandro Marco is responsible for Fyn."}{" "}
        {spanish ? "Contacto:" : "Contact:"}{" "}
        <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>.
      </p>

      <h2>{spanish ? "Qué datos se tratan y para qué" : "Data processed and purpose"}</h2>
      <p>
        {spanish
          ? "Fyn procesa las consultas y filtros que envías para realizar la búsqueda. La infraestructura también puede tratar datos técnicos, como la dirección IP, marcas temporales y registros de errores, para prestar y proteger el servicio. Si escribes a soporte, se tratarán los datos incluidos en tu mensaje para responderte."
          : "Fyn processes the queries and filters you submit to perform a search. Its infrastructure may also process technical data such as IP addresses, timestamps, and error logs to provide and protect the service. If you contact support, the data in your message is processed to reply to you."}
      </p>
      <p>
        {spanish
          ? "El tratamiento se basa en atender la solicitud del usuario y en el interés legítimo de mantener seguro este experimento. No incluyas datos sensibles en las búsquedas."
          : "Processing is based on fulfilling the user's request and the legitimate interest in keeping this experiment secure. Do not include sensitive data in searches."}
      </p>

      <h2>{spanish ? "Proveedores, fuentes y conservación" : "Providers, sources, and retention"}</h2>
      <p>
        {spanish
          ? "Fyn utiliza Vercel para alojamiento y consulta fuentes inmobiliarias de terceros. Al abrir un resultado pasas a la web y políticas del portal correspondiente. Los datos técnicos y mensajes se conservan solo durante el tiempo necesario para operar, proteger y atender el experimento."
          : "Fyn uses Vercel for hosting and queries third-party property sources. Opening a result takes you to the relevant portal and its policies. Technical data and messages are kept only for as long as needed to operate, protect, and support the experiment."}
      </p>

      <h2>{spanish ? "Tus derechos" : "Your rights"}</h2>
      <p>
        {spanish
          ? "Puedes solicitar acceso, rectificación o supresión de los datos personales que podamos conservar escribiendo al correo de soporte."
          : "You may request access, correction, or deletion of personal data we may retain by writing to the support address."}
      </p>
    </InfoPageLayout>
  );
}
