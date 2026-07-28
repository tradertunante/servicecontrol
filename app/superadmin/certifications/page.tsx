// FILE: app/superadmin/certifications/page.tsx
"use client";

import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { supabase } from "@/lib/supabaseClient";
import HotelHeader from "@/app/components/HotelHeader";

type CertificationRow = {
  id: string;
  name: string;
  active: boolean;
  created_at: string | null;
};

const card: CSSProperties = {
  borderRadius: 18,
  border: "1px solid rgba(0,0,0,0.08)",
  background: "rgba(255,255,255,0.75)",
  padding: 18,
};

const inputStyle: CSSProperties = {
  padding: "10px 12px",
  borderRadius: 12,
  border: "1px solid rgba(0,0,0,0.18)",
  outline: "none",
  fontWeight: 900,
  background: "#fff",
};

const btnBlack: CSSProperties = {
  padding: "10px 14px",
  borderRadius: 12,
  border: "1px solid rgba(0,0,0,0.2)",
  background: "#000",
  color: "#fff",
  fontWeight: 900,
  cursor: "pointer",
  height: 42,
  whiteSpace: "nowrap",
};

export default function SuperadminCertificationsPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  const [certifications, setCertifications] = useState<CertificationRow[]>([]);
  const [newName, setNewName] = useState("");
  const [renameDrafts, setRenameDrafts] = useState<Record<string, string>>({});

  async function loadCertifications() {
    setLoading(true);
    setError(null);
    try {
      const { data, error: err } = await supabase
        .from("certification_standards")
        .select("id,name,active,created_at")
        .order("name", { ascending: true });
      if (err) throw err;
      setCertifications((data ?? []) as CertificationRow[]);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Error cargando certificados.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadCertifications();
  }, []);

  async function getToken() {
    const { data } = await supabase.auth.getSession();
    return data.session?.access_token ?? "";
  }

  async function createCertification() {
    const trimmed = newName.trim();
    if (!trimmed) return;

    const exists = certifications.some(
      (c) => c.name.trim().toLowerCase() === trimmed.toLowerCase()
    );
    if (exists && !window.confirm(`Ya existe un certificado llamado "${trimmed}". ¿Crear otro igualmente?`)) {
      return;
    }

    setCreating(true);
    setError(null);
    setInfo(null);
    try {
      const token = await getToken();
      const res = await fetch("/api/superadmin/certifications", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ name: trimmed }),
      });
      const payload = await res.json().catch(() => null);
      if (!res.ok || !payload?.ok) throw new Error(payload?.error ?? "No se pudo crear el certificado.");
      setCertifications((prev) =>
        [...prev, payload.certification as CertificationRow].sort((a, b) =>
          a.name.localeCompare(b.name, "es", { sensitivity: "base" })
        )
      );
      setNewName("");
      setInfo("Certificado creado ✅");
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "No se pudo crear el certificado.");
    } finally {
      setCreating(false);
    }
  }

  async function patchCertification(id: string, patch: Record<string, unknown>) {
    setBusyId(id);
    setError(null);
    try {
      const token = await getToken();
      const res = await fetch(`/api/superadmin/certifications/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(patch),
      });
      const payload = await res.json().catch(() => null);
      if (!res.ok || !payload?.ok) throw new Error(payload?.error ?? "No se pudo guardar el cambio.");
      return true;
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "No se pudo guardar el cambio.");
      return false;
    } finally {
      setBusyId(null);
    }
  }

  async function renameCertification(id: string, name: string) {
    const trimmed = name.trim();
    const current = certifications.find((c) => c.id === id);
    if (!trimmed || !current || trimmed === current.name) return;
    const ok = await patchCertification(id, { name: trimmed });
    if (ok) {
      setCertifications((prev) => prev.map((c) => (c.id === id ? { ...c, name: trimmed } : c)));
      setInfo("Certificado renombrado ✅");
    }
  }

  async function toggleActive(id: string, active: boolean) {
    const ok = await patchCertification(id, { active });
    if (ok) {
      setCertifications((prev) => prev.map((c) => (c.id === id ? { ...c, active } : c)));
      setInfo(active ? "Certificado reactivado ✅" : "Certificado desactivado ✅");
    }
  }

  const sorted = useMemo(
    () =>
      [...certifications].sort(
        (a, b) => Number(b.active) - Number(a.active) || a.name.localeCompare(b.name, "es")
      ),
    [certifications]
  );

  if (loading) {
    return (
      <main style={{ padding: 24, paddingTop: 80 }}>
        <HotelHeader />
        <p style={{ opacity: 0.8 }}>Cargando…</p>
      </main>
    );
  }

  return (
    <main style={{ padding: 24, paddingTop: 80 }}>
      <HotelHeader />

      <h1 style={{ fontSize: 48, margin: "10px 0 6px" }}>Certificaciones</h1>
      <div style={{ opacity: 0.75, fontWeight: 900 }}>
        Catálogo global de certificados (Forbes, LHW, Meliá, etc.). Desde aquí se
        crean y gestionan; se etiquetan en cada plantilla desde el builder.
      </div>

      {error ? <div style={{ marginTop: 12, color: "crimson", fontWeight: 950 }}>{error}</div> : null}
      {info ? <div style={{ marginTop: 12, color: "#0a7d2c", fontWeight: 950 }}>{info}</div> : null}

      <div style={{ ...card, marginTop: 14 }}>
        <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
          <input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") createCertification();
            }}
            placeholder="Ej: Forbes Travel Standards"
            style={{ ...inputStyle, flex: 1, minWidth: 260 }}
            disabled={creating}
          />
          <button
            style={{ ...btnBlack, opacity: creating || !newName.trim() ? 0.6 : 1 }}
            disabled={creating || !newName.trim()}
            onClick={createCertification}
          >
            + Añadir certificado
          </button>
        </div>

        <div style={{ marginTop: 16, display: "grid", gap: 10 }}>
          {sorted.map((cert) => {
            const draft = renameDrafts[cert.id] ?? cert.name;
            const busy = busyId === cert.id;
            return (
              <div
                key={cert.id}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  gap: 10,
                  padding: "12px 14px",
                  borderRadius: 16,
                  border: "1px solid rgba(0,0,0,0.12)",
                  background: "#fff",
                  flexWrap: "wrap",
                  opacity: cert.active ? 1 : 0.6,
                }}
              >
                <input
                  value={draft}
                  onChange={(e) => setRenameDrafts((prev) => ({ ...prev, [cert.id]: e.target.value }))}
                  onBlur={() => renameCertification(cert.id, draft)}
                  disabled={busy}
                  style={{ ...inputStyle, flex: 1, minWidth: 220 }}
                />

                <div style={{ display: "flex", gap: 8, alignItems: "center", flexShrink: 0 }}>
                  <div
                    style={{
                      padding: "4px 10px",
                      borderRadius: 999,
                      background: "rgba(0,0,0,0.06)",
                      border: "1px solid rgba(0,0,0,0.12)",
                      fontWeight: 950,
                      fontSize: 12,
                    }}
                  >
                    {cert.active ? "ACTIVO" : "INACTIVO"}
                  </div>
                  <button
                    disabled={busy}
                    onClick={() => toggleActive(cert.id, !cert.active)}
                    style={{
                      padding: "8px 12px",
                      borderRadius: 10,
                      border: "1px solid rgba(0,0,0,0.2)",
                      background: "#fff",
                      fontWeight: 900,
                      cursor: busy ? "not-allowed" : "pointer",
                    }}
                  >
                    {cert.active ? "Desactivar" : "Reactivar"}
                  </button>
                </div>
              </div>
            );
          })}

          {sorted.length === 0 ? (
            <div style={{ padding: 10, opacity: 0.8 }}>Todavía no hay certificados creados.</div>
          ) : null}
        </div>
      </div>
    </main>
  );
}
