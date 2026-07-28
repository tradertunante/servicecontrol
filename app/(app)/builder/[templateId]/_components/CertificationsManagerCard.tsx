"use client";

import { CertificationStandardRow, cardStyle } from "../_types";

export default function CertificationsManagerCard({
  certifications,
}: {
  certifications: CertificationStandardRow[];
}) {
  return (
    <div style={{ ...cardStyle, marginTop: 14 }}>
      <div style={{ fontWeight: 950, fontSize: 18 }}>Certificados / Estándares</div>
      <div style={{ opacity: 0.75, fontSize: 13, marginTop: 4 }}>
        Marca en cada pregunta de la tabla a qué certificado(s) aplica (Forbes,
        LHW, Meliá, etc.). Con una sola auditoría se calculará el resultado de
        cumplimiento de forma independiente para cada certificado. El catálogo
        de certificados lo gestiona superadmin en{" "}
        <strong>/superadmin/certifications</strong>.
      </div>

      <div style={{ marginTop: 12, display: "flex", flexWrap: "wrap", gap: 10 }}>
        {certifications.map((cert) => (
          <div
            key={cert.id}
            style={{
              padding: "6px 12px",
              borderRadius: 999,
              border: "1px solid rgba(0,0,0,0.15)",
              background: "rgba(0,0,0,0.03)",
              fontWeight: 900,
            }}
          >
            {cert.name}
          </div>
        ))}

        {certifications.length === 0 ? (
          <div style={{ opacity: 0.7, fontSize: 13 }}>
            Todavía no hay certificados en el catálogo. Pide a un superadmin que
            cree uno en /superadmin/certifications.
          </div>
        ) : null}
      </div>
    </div>
  );
}
