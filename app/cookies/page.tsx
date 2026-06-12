import Link from "next/link";
import type { Metadata } from "next";
import ConsentResetClient from "./ConsentResetClient";

export const metadata: Metadata = {
  title: "Política de Cookies | ServiceControl",
  robots: { index: true },
};

const COOKIES_DATE = "12 de junio de 2026";
const COMPANY_NAME = "ServiceControl";

export default function CookiesPage() {
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

        <h1 style={{ fontSize: 32, fontWeight: 900, marginBottom: 4 }}>Política de Cookies</h1>
        <p style={{ color: "#666", marginBottom: 40, fontSize: 14 }}>
          Última actualización: {COOKIES_DATE}
        </p>

        <Section title="1. ¿Qué son las cookies?">
          <p>
            Las cookies son pequeños archivos de texto que un sitio web deposita en tu dispositivo cuando lo
            visitas. Permiten que el sitio recuerde tus preferencias y acciones durante un tiempo.
          </p>
        </Section>

        <Section title="2. Cookies que usamos">
          <p>
            {COMPANY_NAME} utiliza dos categorías de cookies:
          </p>

          <h3 style={{ fontSize: 14, fontWeight: 700, marginTop: 16, marginBottom: 8, color: "#111" }}>
            Cookies estrictamente necesarias
          </h3>
          <p>
            Estas cookies son imprescindibles para el funcionamiento de la plataforma. No requieren tu
            consentimiento y no pueden desactivarse.
          </p>
          <CookieTable rows={[
            {
              name: "AUTH_TOKEN",
              provider: "servicecontrol.app",
              purpose: "Token de sesión autenticada. Necesario para mantener la sesión iniciada.",
              duration: "Sesión / 7 días",
              type: "httpOnly, Secure",
            },
            {
              name: "HOTEL_SCOPE",
              provider: "servicecontrol.app",
              purpose: "Hotel activo seleccionado por el usuario.",
              duration: "Sesión",
              type: "httpOnly, Secure",
            },
            {
              name: "sc_cookie_consent",
              provider: "servicecontrol.app",
              purpose: "Almacena tu preferencia de consentimiento de cookies.",
              duration: "1 año",
              type: "SameSite=Lax",
            },
            {
              name: "NEXT_LOCALE",
              provider: "servicecontrol.app",
              purpose: "Idioma seleccionado por el usuario.",
              duration: "1 año",
              type: "SameSite=Lax",
            },
          ]} />

          <h3 style={{ fontSize: 14, fontWeight: 700, marginTop: 24, marginBottom: 8, color: "#111" }}>
            Cookies analíticas (requieren consentimiento)
          </h3>
          <p>
            Solo se activan si aceptas las cookies analíticas en el banner de consentimiento. Nos ayudan a
            entender cómo se usa la plataforma para mejorarla.
          </p>
          <CookieTable rows={[
            {
              name: "ph_*",
              provider: "PostHog (eu.i.posthog.com)",
              purpose: "Analítica de producto: páginas visitadas, eventos de interacción, rendimiento de funcionalidades. Datos procesados en la UE.",
              duration: "1 año",
              type: "localStorage + cookie",
            },
          ]} />
        </Section>

        <Section title="3. Cookies de terceros">
          <p>
            No instalamos cookies publicitarias ni de redes sociales. PostHog (analítica) es el único
            proveedor de cookies de terceros, y solo opera con tu consentimiento explícito. Usamos el endpoint
            EU de PostHog para garantizar que los datos se procesan dentro del Espacio Económico Europeo.
          </p>
        </Section>

        <Section title="4. Cómo gestionar tu consentimiento">
          <p>
            Puedes cambiar tu preferencia en cualquier momento haciendo clic en el botón de abajo. También
            puedes eliminar las cookies desde la configuración de tu navegador — ten en cuenta que esto puede
            afectar al funcionamiento de la plataforma.
          </p>
          <ConsentResetButton />
          <p style={{ marginTop: 16 }}>
            Instrucciones para gestionar cookies en los principales navegadores:
          </p>
          <ul style={{ paddingLeft: 20, lineHeight: 1.9 }}>
            <li>
              <a href="https://support.google.com/chrome/answer/95647" target="_blank" rel="noopener noreferrer" style={{ color: "#000" }}>
                Google Chrome
              </a>
            </li>
            <li>
              <a href="https://support.mozilla.org/es/kb/habilitar-y-deshabilitar-cookies-sitios-web-rastrear-preferencias" target="_blank" rel="noopener noreferrer" style={{ color: "#000" }}>
                Mozilla Firefox
              </a>
            </li>
            <li>
              <a href="https://support.apple.com/es-es/guide/safari/sfri11471/mac" target="_blank" rel="noopener noreferrer" style={{ color: "#000" }}>
                Safari
              </a>
            </li>
            <li>
              <a href="https://support.microsoft.com/es-es/windows/eliminar-y-administrar-cookies-168dab11-0753-043d-7c16-ede5947fc64d" target="_blank" rel="noopener noreferrer" style={{ color: "#000" }}>
                Microsoft Edge
              </a>
            </li>
          </ul>
        </Section>

        <Section title="5. Más información">
          <p>
            Para más detalles sobre cómo tratamos tus datos personales, consulta nuestra{" "}
            <Link href="/privacy" style={{ color: "#000", fontWeight: 700, textDecoration: "underline" }}>
              Política de Privacidad
            </Link>.
            Para cualquier consulta: <a href="mailto:legal@servicecontrol.app" style={{ color: "#000", fontWeight: 700 }}>legal@servicecontrol.app</a>
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

function CookieTable({
  rows,
}: {
  rows: { name: string; provider: string; purpose: string; duration: string; type: string }[];
}) {
  return (
    <div style={{ overflowX: "auto", marginTop: 8 }}>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
        <thead>
          <tr style={{ background: "#f0f0f0" }}>
            {["Nombre", "Proveedor", "Finalidad", "Duración", "Tipo"].map((h) => (
              <th key={h} style={{ padding: "8px 12px", textAlign: "left", border: "1px solid #ddd", whiteSpace: "nowrap" }}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.name}>
              <td style={{ padding: "8px 12px", border: "1px solid #ddd", fontFamily: "monospace" }}>{r.name}</td>
              <td style={{ padding: "8px 12px", border: "1px solid #ddd" }}>{r.provider}</td>
              <td style={{ padding: "8px 12px", border: "1px solid #ddd" }}>{r.purpose}</td>
              <td style={{ padding: "8px 12px", border: "1px solid #ddd", whiteSpace: "nowrap" }}>{r.duration}</td>
              <td style={{ padding: "8px 12px", border: "1px solid #ddd", fontFamily: "monospace", fontSize: 11 }}>{r.type}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ConsentResetButton() {
  return <ConsentResetClient />;
}