import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Política de Privacidad | ServiceControl",
  robots: { index: true },
};

const PRIVACY_DATE = "12 de junio de 2026";
const COMPANY_NAME = "ServiceControl";
const COMPANY_EMAIL = "legal@servicecontrol.app";
const DPO_EMAIL = "legal@servicecontrol.app";

export default function PrivacyPage() {
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
          href="/"
          style={{ fontSize: 13, color: "#555", textDecoration: "underline", display: "inline-block", marginBottom: 32 }}
        >
          ← Volver al inicio
        </Link>

        <h1 style={{ fontSize: 32, fontWeight: 900, marginBottom: 4 }}>Política de Privacidad</h1>
        <p style={{ color: "#666", marginBottom: 40, fontSize: 14 }}>
          Última actualización: {PRIVACY_DATE}
        </p>

        <Section title="1. Responsable del tratamiento">
          <p>
            <strong>{COMPANY_NAME}</strong> es el responsable del tratamiento de los datos personales recogidos
            a través de esta plataforma. Para cualquier consulta relativa a privacidad, puedes contactarnos en{" "}
            <a href={`mailto:${DPO_EMAIL}`} style={{ color: "#000", fontWeight: 700 }}>{DPO_EMAIL}</a>.
          </p>
        </Section>

        <Section title="2. Qué datos recogemos">
          <p>Recogemos los siguientes datos personales:</p>
          <ul style={{ paddingLeft: 20, lineHeight: 1.9 }}>
            <li><strong>Datos de registro:</strong> nombre completo, dirección de email, nombre del hotel/empresa.</li>
            <li><strong>Datos de uso:</strong> rol en la plataforma, auditorías realizadas, acciones correctivas, registros de actividad.</li>
            <li><strong>Datos técnicos:</strong> dirección IP (anonimizada), tipo de navegador, sistema operativo, páginas visitadas, duración de sesión.</li>
            <li><strong>Fotografías de evidencia:</strong> imágenes subidas durante auditorías (vinculadas al hotel cliente, no a la persona).</li>
          </ul>
          <p>
            No recogemos categorías especiales de datos personales (salud, origen racial, creencias, etc.).
          </p>
        </Section>

        <Section title="3. Finalidades y bases legales">
          <p>Tratamos tus datos con las siguientes finalidades y bases legales:</p>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13, marginTop: 8 }}>
            <thead>
              <tr style={{ background: "#f0f0f0" }}>
                <th style={{ padding: "8px 12px", textAlign: "left", border: "1px solid #ddd" }}>Finalidad</th>
                <th style={{ padding: "8px 12px", textAlign: "left", border: "1px solid #ddd" }}>Base legal</th>
              </tr>
            </thead>
            <tbody>
              {[
                ["Prestación del servicio SaaS contratado", "Ejecución de contrato (art. 6.1.b RGPD)"],
                ["Gestión de cuentas de usuario", "Ejecución de contrato (art. 6.1.b RGPD)"],
                ["Envío de comunicaciones transaccionales (credenciales, alertas)", "Ejecución de contrato (art. 6.1.b RGPD)"],
                ["Análisis de uso y mejora del producto (PostHog)", "Consentimiento (art. 6.1.a RGPD)"],
                ["Cumplimiento de obligaciones legales", "Obligación legal (art. 6.1.c RGPD)"],
                ["Defensa ante reclamaciones", "Interés legítimo (art. 6.1.f RGPD)"],
              ].map(([fin, base]) => (
                <tr key={fin}>
                  <td style={{ padding: "8px 12px", border: "1px solid #ddd" }}>{fin}</td>
                  <td style={{ padding: "8px 12px", border: "1px solid #ddd" }}>{base}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Section>

        <Section title="4. Transferencias internacionales">
          <p>
            Utilizamos los siguientes proveedores que pueden implicar transferencia de datos fuera del EEE:
          </p>
          <ul style={{ paddingLeft: 20, lineHeight: 1.9 }}>
            <li>
              <strong>Supabase</strong> — infraestructura de base de datos y autenticación. Datos alojados en servidores dentro de la UE (región eu-west). Consulta su{" "}
              <a href="https://supabase.com/privacy" target="_blank" rel="noopener noreferrer" style={{ color: "#000" }}>política de privacidad</a>.
            </li>
            <li>
              <strong>PostHog</strong> — analítica de producto (solo si consientes). Usamos el endpoint EU (<code>eu.i.posthog.com</code>). Datos procesados en la UE. Consulta su{" "}
              <a href="https://posthog.com/privacy" target="_blank" rel="noopener noreferrer" style={{ color: "#000" }}>política de privacidad</a>.
            </li>
            <li>
              <strong>Vercel</strong> — despliegue de la aplicación. Puede procesar metadatos de red (IPs) en servidores fuera de la UE amparado en Cláusulas Contractuales Tipo. Consulta su{" "}
              <a href="https://vercel.com/legal/privacy-policy" target="_blank" rel="noopener noreferrer" style={{ color: "#000" }}>política de privacidad</a>.
            </li>
          </ul>
        </Section>

        <Section title="5. Conservación de datos">
          <p>
            Conservamos los datos personales durante el tiempo que dure la relación contractual con el hotel
            cliente y, una vez finalizada, durante los plazos legales aplicables (máximo 6 años para datos
            contables y fiscales). Los datos de analítica anonimizados pueden conservarse indefinidamente.
          </p>
        </Section>

        <Section title="6. Tus derechos">
          <p>
            Bajo el RGPD (Reglamento UE 2016/679) y la LOPDGDD, tienes los siguientes derechos:
          </p>
          <ul style={{ paddingLeft: 20, lineHeight: 1.9 }}>
            <li><strong>Acceso:</strong> obtener confirmación de qué datos tratamos sobre ti.</li>
            <li><strong>Rectificación:</strong> corregir datos inexactos o incompletos.</li>
            <li><strong>Supresión:</strong> solicitar la eliminación de tus datos cuando proceda.</li>
            <li><strong>Oposición:</strong> oponerte al tratamiento basado en interés legítimo.</li>
            <li><strong>Portabilidad:</strong> recibir tus datos en formato estructurado.</li>
            <li><strong>Limitación:</strong> solicitar que restrinjamos el tratamiento.</li>
            <li><strong>Retirada del consentimiento:</strong> en cualquier momento, sin efecto retroactivo.</li>
          </ul>
          <p>
            Para ejercer tus derechos, escríbenos a{" "}
            <a href={`mailto:${DPO_EMAIL}`} style={{ color: "#000", fontWeight: 700 }}>{DPO_EMAIL}</a>.
            Responderemos en un plazo máximo de 30 días. También puedes presentar una reclamación ante la
            Agencia Española de Protección de Datos (<a href="https://www.aepd.es" target="_blank" rel="noopener noreferrer" style={{ color: "#000" }}>aepd.es</a>).
          </p>
        </Section>

        <Section title="7. Seguridad">
          <p>
            Aplicamos medidas técnicas y organizativas adecuadas para proteger tus datos: cifrado en tránsito
            (TLS), autenticación con tokens de sesión httpOnly, control de acceso por roles (RLS), y revisiones
            periódicas de seguridad. En caso de brecha de seguridad que afecte a tus datos, lo notificaremos
            conforme a lo previsto en el RGPD.
          </p>
        </Section>

        <Section title="8. Cookies y tecnologías similares">
          <p>
            Usamos cookies técnicas necesarias para la sesión y, con tu consentimiento, cookies analíticas.
            Para más información, consulta nuestra{" "}
            <Link href="/cookies" style={{ color: "#000", fontWeight: 700, textDecoration: "underline" }}>
              Política de Cookies
            </Link>.
          </p>
        </Section>

        <Section title="9. Menores de edad">
          <p>
            {COMPANY_NAME} es una plataforma de uso profesional destinada a empleados de hoteles. No
            recopilamos conscientemente datos de menores de 16 años. Si detectas que un menor ha facilitado
            datos, contáctanos en {COMPANY_EMAIL} para eliminarlos.
          </p>
        </Section>

        <Section title="10. Cambios en esta política">
          <p>
            Podemos actualizar esta política en cualquier momento. Te notificaremos los cambios relevantes por
            email o mediante aviso destacado en la plataforma. La versión vigente siempre estará accesible en
            esta URL.
          </p>
        </Section>

        <Section title="11. Contacto">
          <p>
            Para cualquier consulta sobre privacidad:{" "}
            <a href={`mailto:${DPO_EMAIL}`} style={{ color: "#000", fontWeight: 700 }}>{DPO_EMAIL}</a>
          </p>
        </Section>

        <p style={{ marginTop: 48, fontSize: 13, color: "#888", borderTop: "1px solid #e5e5e5", paddingTop: 24 }}>
          © {new Date().getFullYear()} {COMPANY_NAME}. Todos los derechos reservados.
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