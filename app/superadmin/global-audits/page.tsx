// FILE: app/superadmin/global-audits/page.tsx
"use client";

import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { requireRoleOrRedirect } from "@/lib/auth/RequireRole";

type PackRow = {
  id: string;
  business_type: string;
  name: string;
  description: string | null;
  active: boolean;
  created_at?: string | null;
};

export default function GlobalAuditsPage() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [busyCreate, setBusyCreate] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [packs, setPacks] = useState<PackRow[]>([]);

  // Create form state
  const [name, setName] = useState("");
  const [businessType, setBusinessType] = useState("hotel");
  const [description, setDescription] = useState("");
  const [active, setActive] = useState(true);

  const styles = useMemo(() => {
    const page: CSSProperties = { padding: 24, paddingTop: 24 };

    const card: CSSProperties = {
      background: "var(--card-bg)",
      border: "1px solid var(--header-border)",
      borderRadius: 18,
      boxShadow: "var(--shadow-sm)",
      padding: 18,
    };

    const btnDark: CSSProperties = {
      padding: "10px 14px",
      borderRadius: 12,
      border: "1px solid rgba(0,0,0,0.18)",
      background: "#000",
      color: "#fff",
      fontWeight: 950,
      cursor: "pointer",
      fontSize: 14,
      whiteSpace: "nowrap",
    };

    const btnWhite: CSSProperties = {
      padding: "10px 14px",
      borderRadius: 12,
      border: "1px solid var(--input-border)",
      background: "var(--input-bg)",
      color: "var(--input-text)",
      fontWeight: 950,
      cursor: "pointer",
      fontSize: 14,
      whiteSpace: "nowrap",
    };

    const row: CSSProperties = {
      background: "rgba(0,0,0,0.02)",
      border: "1px solid rgba(0,0,0,0.08)",
      borderRadius: 14,
      padding: "12px 14px",
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center",
      gap: 12,
      flexWrap: "wrap",
    };

    const tag: CSSProperties = {
      padding: "6px 10px",
      borderRadius: 999,
      border: "1px solid rgba(0,0,0,0.12)",
      background: "rgba(0,0,0,0.03)",
      fontSize: 12,
      fontWeight: 950,
      textTransform: "uppercase",
      letterSpacing: 0.4,
    };

    const label: CSSProperties = { fontWeight: 950, fontSize: 12, opacity: 0.9, marginBottom: 6 };

    const input: CSSProperties = {
      width: "100%",
      height: 44,
      borderRadius: 12,
      border: "1px solid var(--input-border)",
      background: "var(--input-bg)",
      color: "var(--input-text)",
      padding: "0 12px",
      outline: "none",
    };

    const textarea: CSSProperties = {
      width: "100%",
      borderRadius: 12,
      border: "1px solid var(--input-border)",
      background: "var(--input-bg)",
      color: "var(--input-text)",
      padding: 12,
      outline: "none",
      minHeight: 92,
      resize: "vertical",
    };

    return { page, card, btnDark, btnWhite, row, tag, label, input, textarea };
  }, []);

  async function load() {
    setLoading(true);
    setError(null);

    const p = await requireRoleOrRedirect(router, ["superadmin"], "/dashboard");
    if (!p) {
      setLoading(false);
      return;
    }

    const { data, error: e } = await supabase
      .from("global_audit_packs")
      .select("id, business_type, name, description, active, created_at")
      .order("created_at", { ascending: false });

    if (e) {
      setError(e.message);
      setLoading(false);
      return;
    }

    setPacks((data ?? []) as PackRow[]);
    setLoading(false);
  }

  async function createPack() {
    setError(null);

    const cleanName = name.trim();
    if (!cleanName) {
      setError("El nombre del pack es obligatorio.");
      return;
    }

    setBusyCreate(true);
    try {
      const { error: e } = await supabase.from("global_audit_packs").insert([
        {
          name: cleanName,
          business_type: businessType,
          description: description.trim() ? description.trim() : null,
          active,
        },
      ]);

      if (e) throw e;

      setName("");
      setDescription("");
      setBusinessType("hotel");
      setActive(true);

      await load();
    } catch (e: any) {
      setError(e?.message ?? "No se pudo crear el pack.");
    } finally {
      setBusyCreate(false);
    }
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <main style={styles.page}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
        <div>
          <div style={{ fontSize: 28, fontWeight: 950, letterSpacing: -0.4 }}>Biblioteca Global</div>
          <div style={{ opacity: 0.75, marginTop: 6, fontSize: 13 }}>
            Crea packs y gestiona qué plantillas contiene cada pack.
          </div>
        </div>

        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <button style={styles.btnWhite} onClick={() => router.push("/superadmin")}>
            ← Volver
          </button>
          <button style={styles.btnWhite} onClick={load}>
            Recargar
          </button>
        </div>
      </div>

      {!!error && (
        <div
          style={{
            marginTop: 14,
            padding: 12,
            borderRadius: 12,
            background: "#fee",
            border: "1px solid #fcc",
            color: "#7a0b0b",
            whiteSpace: "pre-wrap",
            fontWeight: 900,
          }}
        >
          {error}
        </div>
      )}

      {/* Crear pack */}
      <div style={{ ...styles.card, marginTop: 16 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
          <div>
            <div style={{ fontWeight: 950, fontSize: 16 }}>Crear pack</div>
            <div style={{ opacity: 0.75, fontSize: 12, marginTop: 4 }}>
              Un pack agrupa varias plantillas globales (por área/negocio).
            </div>
          </div>

          <button
            style={{ ...styles.btnDark, opacity: busyCreate ? 0.75 : 1, cursor: busyCreate ? "not-allowed" : "pointer" }}
            onClick={createPack}
            disabled={busyCreate}
          >
            {busyCreate ? "Creando…" : "Crear pack"}
          </button>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1.2fr 0.8fr", gap: 12, marginTop: 14 }}>
          <div>
            <div style={styles.label}>Nombre</div>
            <input
              style={styles.input}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ej: Housekeeping - Estándar"
            />
          </div>

          <div>
            <div style={styles.label}>Tipo de negocio</div>
            <select style={styles.input} value={businessType} onChange={(e) => setBusinessType(e.target.value)}>
              <option value="hotel">Hotel</option>
              <option value="spa">Spa</option>
              <option value="restaurant">Restaurante</option>
              <option value="public_areas">Áreas públicas</option>
              <option value="other">Otro</option>
            </select>
          </div>

          <div style={{ gridColumn: "1 / -1" }}>
            <div style={styles.label}>Descripción (opcional)</div>
            <textarea
              style={styles.textarea}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Breve contexto del pack…"
            />
          </div>

          <div style={{ gridColumn: "1 / -1", display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
            <label style={{ display: "flex", alignItems: "center", gap: 10, fontWeight: 900 }}>
              <input
                type="checkbox"
                checked={active}
                onChange={(e) => setActive(e.target.checked)}
                style={{ width: 18, height: 18 }}
              />
              Activo
            </label>
            <div style={{ opacity: 0.7, fontSize: 12 }}>
              Si lo desactivas, seguirá existiendo pero no lo usarás en asignaciones.
            </div>
          </div>
        </div>
      </div>

      {/* Listado packs */}
      <div style={{ ...styles.card, marginTop: 16 }}>
        {loading ? (
          <div style={{ opacity: 0.8 }}>Cargando…</div>
        ) : packs.length === 0 ? (
          <div style={{ opacity: 0.75 }}>No hay packs globales aún.</div>
        ) : (
          <div style={{ display: "grid", gap: 10 }}>
            {packs.map((p) => (
              <div key={p.id} style={styles.row}>
                <div style={{ minWidth: 260 }}>
                  <div style={{ fontWeight: 950, fontSize: 16 }}>{p.name}</div>
                  <div style={{ fontSize: 12, opacity: 0.75, marginTop: 4 }}>
                    ID: {p.id}
                    {p.description ? ` · ${p.description}` : ""}
                  </div>
                </div>

                <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
                  <span style={styles.tag}>{p.business_type}</span>
                  <span style={{ ...styles.tag, opacity: p.active ? 1 : 0.45 }}>{p.active ? "Activo" : "Inactivo"}</span>

                  <button style={styles.btnDark} onClick={() => router.push(`/superadmin/global-audits/${p.id}`)}>
                    Abrir
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}