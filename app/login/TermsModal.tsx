"use client";

import { useRef, useState, useEffect } from "react";

const TERMS_VERSION = "1.0";

interface Props {
  onAccept: () => void;
  loading: boolean;
}

export default function TermsModal({ onAccept, loading }: Props) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [scrolledToBottom, setScrolledToBottom] = useState(false);
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;

    function onScroll() {
      if (!el) return;
      const atBottom = el.scrollTop + el.clientHeight >= el.scrollHeight - 32;
      if (atBottom) setScrolledToBottom(true);
    }

    el.addEventListener("scroll", onScroll);
    onScroll();
    return () => el.removeEventListener("scroll", onScroll);
  }, []);

  const canAccept = scrolledToBottom && checked;

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.55)",
        backdropFilter: "blur(4px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 16,
        zIndex: 9999,
      }}
    >
      <div
        style={{
          background: "#fff",
          borderRadius: 20,
          width: "100%",
          maxWidth: 600,
          maxHeight: "90vh",
          display: "flex",
          flexDirection: "column",
          boxShadow: "0 20px 60px rgba(0,0,0,0.3)",
          overflow: "hidden",
        }}
      >
        {/* Header */}
        <div style={{ padding: "22px 24px 16px", borderBottom: "1px solid #eee" }}>
          <h2 style={{ fontSize: 20, fontWeight: 900, margin: 0 }}>
            Términos y Condiciones
          </h2>
          <p style={{ fontSize: 13, color: "#666", margin: "4px 0 0" }}>
            Versión {TERMS_VERSION} — Léelos antes de continuar
          </p>
        </div>

        {/* Scrollable content */}
        <div
          ref={scrollRef}
          style={{ flex: 1, overflowY: "auto", padding: "20px 24px", fontSize: 13, lineHeight: 1.7, color: "#333" }}
        >
          <TermsContent />
        </div>

        {/* Footer */}
        <div style={{ padding: "16px 24px 20px", borderTop: "1px solid #eee", background: "#fafafa" }}>
          {!scrolledToBottom && (
            <p style={{ fontSize: 12, color: "#999", margin: "0 0 12px", textAlign: "center" }}>
              Desplázate hasta el final para poder aceptar
            </p>
          )}

          <label
            style={{
              display: "flex",
              alignItems: "flex-start",
              gap: 10,
              cursor: scrolledToBottom ? "pointer" : "not-allowed",
              opacity: scrolledToBottom ? 1 : 0.45,
              marginBottom: 14,
              fontSize: 13,
              lineHeight: 1.5,
            }}
          >
            <input
              type="checkbox"
              checked={checked}
              disabled={!scrolledToBottom}
              onChange={(e) => setChecked(e.target.checked)}
              style={{ marginTop: 2, width: 16, height: 16, flexShrink: 0, cursor: "inherit" }}
            />
            <span>
              He leído y acepto los{" "}
              <a href="/terms" target="_blank" rel="noopener noreferrer" style={{ color: "#000", fontWeight: 700, textDecoration: "underline" }}>
                Términos y Condiciones
              </a>{" "}
              de uso de ServiceControl.
            </span>
          </label>

          <button
            onClick={onAccept}
            disabled={!canAccept || loading}
            style={{
              width: "100%",
              height: 48,
              borderRadius: 14,
              border: "1px solid rgba(0,0,0,0.2)",
              background: canAccept && !loading ? "#000" : "#aaa",
              color: "#fff",
              fontWeight: 900,
              fontSize: 15,
              cursor: canAccept && !loading ? "pointer" : "not-allowed",
              transition: "background 0.15s",
            }}
          >
            {loading ? "Registrando aceptación…" : "Aceptar y continuar"}
          </button>
        </div>
      </div>
    </div>
  );
}

function TermsContent() {
  return (
    <div>
      <Section title="1. Aceptación de los Términos">
        Al acceder y utilizar ServiceControl, el usuario acepta quedar vinculado por los presentes Términos
        y Condiciones. El acceso es exclusivo para usuarios invitados por un hotel o empresa cliente.
      </Section>
      <Section title="2. Descripción del Servicio">
        ServiceControl es una plataforma SaaS para la gestión de auditorías operativas en establecimientos
        hoteleros. Permite crear plantillas, asignar auditores, registrar resultados, gestionar acciones
        correctivas y generar informes.
      </Section>
      <Section title="3. Acceso y Credenciales">
        El usuario es responsable de mantener la confidencialidad de sus credenciales. Está prohibido
        compartirlas con terceros. Ante cualquier acceso no autorizado sospechado, notifica a tu
        administrador y a legal@servicecontrol.app.
      </Section>
      <Section title="4. Uso Aceptable">
        <p style={{ margin: "0 0 8px" }}>Queda prohibido:</p>
        <ul style={{ paddingLeft: 18, margin: 0 }}>
          <li>Introducir información falsa o fraudulenta.</li>
          <li>Acceder a datos de otros hoteles sin autorización.</li>
          <li>Realizar ingeniería inversa sobre la plataforma.</li>
          <li>Usar herramientas automatizadas no autorizadas (bots, scrapers).</li>
          <li>Interferir con la seguridad o disponibilidad del servicio.</li>
          <li>Transmitir malware u otro código malicioso.</li>
        </ul>
      </Section>
      <Section title="5. Propiedad Intelectual">
        Todos los derechos sobre la plataforma son propiedad de ServiceControl. Los datos introducidos por
        el Cliente son propiedad de este; ServiceControl los usa únicamente para prestar el servicio.
      </Section>
      <Section title="6. Privacidad y Datos Personales">
        Los datos personales (nombre, email, rol, actividad) se tratan para prestar el servicio y no se
        venden ni ceden a terceros salvo requerimiento legal. Consultas: legal@servicecontrol.app.
      </Section>
      <Section title="7. Disponibilidad">
        ServiceControl no garantiza disponibilidad ininterrumpida. Pueden producirse interrupciones por
        mantenimiento o causas de fuerza mayor. Se notificará con antelación cuando sea posible.
      </Section>
      <Section title="8. Limitación de Responsabilidad">
        ServiceControl no será responsable de daños indirectos o consecuentes. La responsabilidad máxima no
        superará el importe abonado en los 3 meses anteriores al evento que generó la reclamación.
      </Section>
      <Section title="9. Modificación de los Términos">
        ServiceControl podrá modificar estos Términos notificando con 15 días de antelación. El uso
        continuado tras la entrada en vigor implica aceptación.
      </Section>
      <Section title="10. Terminación">
        ServiceControl podrá suspender el acceso ante incumplimiento de estos Términos. El administrador
        del Cliente puede revocar accesos en cualquier momento desde el panel.
      </Section>
      <Section title="11. Legislación y Jurisdicción">
        Rigen las leyes españolas. Cualquier controversia se somete a los Juzgados y Tribunales de Madrid.
      </Section>
      <Section title="12. Contacto">
        Para consultas sobre estos Términos: <strong>legal@servicecontrol.app</strong>
      </Section>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 18 }}>
      <strong style={{ display: "block", marginBottom: 4, color: "#111" }}>{title}</strong>
      <div>{children}</div>
    </div>
  );
}