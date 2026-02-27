// FILE: app/(app)/areas/[areaId]/_components/TemplatesPanel.tsx
"use client";

import type { AuditTemplate } from "../_lib/areaTypes";

export default function TemplatesPanel({
  templates,
  starting,
  onStart,
}: {
  templates: AuditTemplate[];
  starting: string | null;
  onStart: (templateId: string) => void;
}) {
  return (
    <>
      <h2 style={{ fontSize: 24, marginBottom: 12 }}>Auditorías disponibles</h2>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 16 }}>
        {templates.map((t) => (
          <div
            key={t.id}
            style={{
              background: "#fff",
              color: "#000",
              borderRadius: 18,
              padding: 18,
              minHeight: 120,
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 12,
            }}
          >
            <div style={{ fontWeight: 900, fontSize: 16 }}>{t.name}</div>

            <button
              onClick={() => onStart(t.id)}
              disabled={starting === t.id}
              style={{
                padding: "10px 14px",
                borderRadius: 12,
                border: "1px solid rgba(0,0,0,0.2)",
                background: "#000",
                color: "#fff",
                fontWeight: 900,
                cursor: starting === t.id ? "not-allowed" : "pointer",
                opacity: starting === t.id ? 0.7 : 1,
              }}
            >
              {starting === t.id ? "Iniciando…" : "Iniciar"}
            </button>
          </div>
        ))}
      </div>

      {templates.length === 0 ? (
        <p style={{ marginTop: 16, opacity: 0.85 }}>No hay auditorías asignadas a esta área todavía.</p>
      ) : null}
    </>
  );
}