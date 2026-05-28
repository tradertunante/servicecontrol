import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Términos y Condiciones | ServiceControl",
  robots: { index: false },
};

const TERMS_VERSION = "1.0";
const TERMS_DATE = "28 de mayo de 2026";
const COMPANY_NAME = "ServiceControl";
const COMPANY_EMAIL = "legal@servicecontrol.app";

export default function TermsPage() {
  return (
    <main
      style={{
        minHeight: "100vh",
        backgroundColor: "#f9f9f9",
        padding: "48px 24px",
        fontFamily: "system-ui, sans-serif",
        color: "#111",
      }}
    >
      <div style={{ maxWidth: 760, margin: "0 auto" }}>
        <Link
          href="/login"
          style={{ fontSize: 13, color: "#555", textDecoration: "underline", display: "inline-block", marginBottom: 32 }}
        >
          ← Volver al inicio
        </Link>

        <h1 style={{ fontSize: 32, fontWeight: 900, marginBottom: 4 }}>
          Términos y Condiciones de Uso
        </h1>
        <p style={{ color: "#666", marginBottom: 40, fontSize: 14 }}>
          Versión {TERMS_VERSION} — Vigente desde el {TERMS_DATE}
        </p>

        <Section title="1. Aceptación de los Términos">
          <p>
            Al acceder y utilizar la plataforma <strong>{COMPANY_NAME}</strong> (en adelante, "la Plataforma"), el
            usuario acepta quedar vinculado por los presentes Términos y Condiciones de Uso (en adelante,
            "los Términos"). Si no está de acuerdo con alguna de las condiciones aquí establecidas, deberá
            abstenerse de utilizar la Plataforma.
          </p>
          <p>
            El acceso a {COMPANY_NAME} es exclusivo para usuarios invitados por un hotel o empresa cliente
            (en adelante, "el Cliente"). Los usuarios no pueden registrarse de forma autónoma.
          </p>
        </Section>

        <Section title="2. Descripción del Servicio">
          <p>
            {COMPANY_NAME} es una plataforma SaaS (Software como Servicio) diseñada para la gestión de
            auditorías operativas en establecimientos hoteleros. Permite a los Clientes crear plantillas de
            auditoría, asignar auditores, registrar resultados, gestionar acciones correctivas y generar
            informes de desempeño.
          </p>
          <p>
            El servicio se presta bajo la modalidad de suscripción y está sujeto a los términos del contrato
            comercial firmado entre {COMPANY_NAME} y el Cliente.
          </p>
        </Section>

        <Section title="3. Acceso y Credenciales">
          <p>
            El usuario es responsable de mantener la confidencialidad de sus credenciales de acceso (correo
            electrónico y contraseña). Queda estrictamente prohibido compartir credenciales con terceros.
          </p>
          <p>
            Cualquier actividad realizada con las credenciales del usuario es responsabilidad exclusiva de
            este. En caso de sospecha de acceso no autorizado, el usuario deberá notificarlo de inmediato al
            administrador de su organización y a {COMPANY_NAME} en <strong>{COMPANY_EMAIL}</strong>.
          </p>
        </Section>

        <Section title="4. Uso Aceptable">
          <p>El usuario se compromete a utilizar la Plataforma únicamente para los fines legítimos para los
          que fue diseñada y a no:</p>
          <ul style={{ paddingLeft: 20, lineHeight: 1.9 }}>
            <li>Introducir información falsa, engañosa o fraudulenta.</li>
            <li>Intentar acceder a datos de otros hoteles o usuarios sin autorización.</li>
            <li>Realizar ingeniería inversa, descompilar o intentar extraer el código fuente de la Plataforma.</li>
            <li>Utilizar bots, scrapers u otras herramientas automatizadas no autorizadas.</li>
            <li>Interferir con la seguridad, integridad o disponibilidad de la Plataforma.</li>
            <li>Transmitir malware, virus u otro código malicioso.</li>
          </ul>
        </Section>

        <Section title="5. Propiedad Intelectual">
          <p>
            Todos los derechos de propiedad intelectual sobre la Plataforma, incluyendo su código fuente,
            diseño, marcas, logotipos y documentación, son propiedad exclusiva de {COMPANY_NAME} o sus
            licenciantes. Queda prohibida su reproducción, distribución o modificación sin autorización
            expresa y escrita.
          </p>
          <p>
            Los datos introducidos por el Cliente y sus usuarios (plantillas, resultados de auditorías,
            informes, etc.) son propiedad del Cliente. {COMPANY_NAME} los almacena y procesa únicamente para
            prestar el servicio contratado.
          </p>
        </Section>

        <Section title="6. Privacidad y Protección de Datos">
          <p>
            {COMPANY_NAME} trata los datos personales de los usuarios conforme a la normativa aplicable en
            materia de protección de datos. Al utilizar la Plataforma, el usuario consiente el tratamiento
            de sus datos para la prestación del servicio, incluyendo nombre, correo electrónico, rol y
            registros de actividad.
          </p>
          <p>
            Los datos no serán vendidos ni compartidos con terceros no relacionados con la prestación del
            servicio, salvo requerimiento legal. Para más información, consulte nuestra Política de
            Privacidad o contacte a <strong>{COMPANY_EMAIL}</strong>.
          </p>
        </Section>

        <Section title="7. Disponibilidad y Mantenimiento">
          <p>
            {COMPANY_NAME} se esfuerza por mantener la Plataforma disponible de forma continua, pero no
            garantiza una disponibilidad del 100%. Pueden producirse interrupciones por mantenimiento
            programado, actualizaciones o causas de fuerza mayor. Se notificará con antelación razonable
            cuando sea posible.
          </p>
        </Section>

        <Section title="8. Limitación de Responsabilidad">
          <p>
            En la máxima medida permitida por la ley aplicable, {COMPANY_NAME} no será responsable de daños
            indirectos, incidentales, especiales o consecuentes derivados del uso o la imposibilidad de uso
            de la Plataforma, incluyendo pérdida de datos, lucro cesante o interrupción de negocio.
          </p>
          <p>
            La responsabilidad total de {COMPANY_NAME} frente al Cliente no superará el importe abonado por
            el servicio en los tres (3) meses anteriores al evento que generó la reclamación.
          </p>
        </Section>

        <Section title="9. Modificación de los Términos">
          <p>
            {COMPANY_NAME} se reserva el derecho de modificar los presentes Términos en cualquier momento.
            Los cambios serán notificados a los usuarios mediante aviso en la Plataforma o por correo
            electrónico con un mínimo de 15 días de antelación. El uso continuado de la Plataforma tras la
            entrada en vigor de los cambios implica la aceptación de los nuevos Términos.
          </p>
        </Section>

        <Section title="10. Terminación">
          <p>
            {COMPANY_NAME} podrá suspender o cancelar el acceso de un usuario que incumpla los presentes
            Términos, sin perjuicio de las acciones legales que pudieran corresponder. El Cliente podrá
            también revocar el acceso de sus usuarios en cualquier momento desde el panel de administración.
          </p>
        </Section>

        <Section title="11. Legislación Aplicable y Jurisdicción">
          <p>
            Los presentes Términos se rigen por la legislación española. Para la resolución de cualquier
            controversia derivada de la interpretación o ejecución de estos Términos, las partes se someten
            a la jurisdicción de los Juzgados y Tribunales de la ciudad de Madrid, con renuncia expresa a
            cualquier otro fuero que pudiera corresponderles.
          </p>
        </Section>

        <Section title="12. Contacto">
          <p>
            Para cualquier consulta relacionada con estos Términos, puede contactarnos en:{" "}
            <a href={`mailto:${COMPANY_EMAIL}`} style={{ color: "#000", fontWeight: 700 }}>
              {COMPANY_EMAIL}
            </a>
          </p>
        </Section>

        <p style={{ marginTop: 48, fontSize: 13, color: "#888", borderTop: "1px solid #e5e5e5", paddingTop: 24 }}>
          © {new Date().getFullYear()} {COMPANY_NAME}. Todos los derechos reservados. Versión {TERMS_VERSION}.
        </p>
      </div>
    </main>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section style={{ marginBottom: 32 }}>
      <h2 style={{ fontSize: 17, fontWeight: 800, marginBottom: 10, color: "#111" }}>{title}</h2>
      <div style={{ lineHeight: 1.75, color: "#333", fontSize: 15 }}>{children}</div>
    </section>
  );
}