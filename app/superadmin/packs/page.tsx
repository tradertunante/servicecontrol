"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { requireRoleOrRedirect } from "@/lib/auth/RequireRole";
import HotelHeader from "@/app/components/HotelHeader";

type PackRow = {
  id: string;
  business_type: string;
  name: string;
  description: string | null;
  active: boolean;
  created_at: string;
};

export default function SuperadminPacksPage() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [packs, setPacks] = useState<PackRow[]>([]);

  // Crear pack
  const [bt, setBt] = useState("hotel");
  const [name, setName] = useState("");
  const [desc, setDesc] = useState("");

  const styles = useMemo(() => {
    const page: React.CSSProperties = { padding: 24, paddingTop: 80 };
    const card: React.CSSProperties = {
      background: "var(--card-bg)",
      border: "1px solid var(--header-border)",
      borderRadius: 18,
      boxShadow: "var(--shadow-sm)",
      padding: 18,
    };
    const row: React.CSSProperties = {
      background: "var(--row-bg)",
      border: "1px solid rgba(0,0,0,0.06)",
      borderRadius: 14,
      padding: "12px 14px",
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 12,
      flexWrap: "wrap",
    };
    const btnDark: React.CSSProperties = {
      padding: "10px 14px",
      borderRadius: 12,
      border: "1px solid rgba(0,0,0,0.18)",
      background: "#000",
      color: "#fff",
      fontWeight: 900,
      cursor: "pointer",
      fontSize: 14,
      whiteSpace: "nowrap",
    };
    const btnWhite: React.CSSProperties = {
      padding: "10px 14px",
      borderRadius: 12,
      border: "1px solid var(--input-border)",
      background: "var(--input-bg)",
      color: "var(--input-text)",
      fontWeight: 900,
      cursor: "pointer",
      fontSize: 14,
      whiteSpace: "nowrap",
    };
    const input: React.CSSProperties = {
      width: "100%",
      padding: "10px 12px",
      borderRadius: 12,
      outline: "none",
      fontSize: 14,
    };
    const label: React.CSSProperties = { fontSize: 12, opacity: 0.75, fontWeight: 900 };
    return { page, card, row, btnDark, btnWhite, input, label };
  }, []);

  async function load() {
    setLoading(true);
    setError(null);

    const p = await requireRoleOrRedirect(router, ["superadmin"], "/dashboard");
    if (!p) return;

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

  useEffect(() => {
    let alive = true;
    (async () => {
      if (!alive) return;
      await load();
    })();
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function createPack() {
    if (!name.trim()) {
      setError("Pon un nombre al pack.");
      return;
    }

    setSaving(true);
    setError(null);

    const { error: e } = await supabase.from("global_audit_packs").insert({
      business_type: bt.trim(),
      name: name.trim(),
      description: desc.trim() ? desc.trim() : null,
      active: true,
    });

    if (e) {
      setError(e.message);
      setSaving(false);
      return;
    }

    setName("");
    setDesc("");
    await load();
    setSaving(false);
  }

  async function toggleActive(packId: string, next: boolean) {
    setError(null);
    const { error: e } = await supabase.from("global_audit_packs").update({ active: next }).eq("id", packId);
    if (e) setError(e.message);
    else await load();
  }

  return (
    <main style={styles.page}>
      <HotelHeader />

      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
        <div>
          <div style={{ fontSize: 28, fontWeight: 950, letterSpacing: -0.4 }}>Packs Globales</div>
          <div style={{ opacity: 0.75, marginTop: 6, fontSize: 13 }}>
            Crea packs (Forbes 2025, Cristal, LHW…) por tipo de negocio y asigna plantillas globales.
          </div>
        </div>

        <button style={styles.btnWhite} onClick={() => router.push("/superadmin")}>
          ← Atrás
        </button>
      </div>

      {loading ? (
        <div style={{ marginTop: 16, opacity: 0.8 }}>Cargando…</div>
      ) : error ? (
        <div style={{ marginTop: 16, color: "var(--danger)", fontWeight: 900 }}>{error}</div>
      ) : null}

      <div style={{ ...styles.card, marginTop: 16 }}>
        <div style={{ fontSize: 18, fontWeight: 950, marginBottom: 12 }}>+ Crear Pack</div>

        <div style={{ display: "grid", gridTemplateColumns: "220px 1fr", gap: 12, alignItems: "end" }}>
          <div>
            <div style={styles.label}>Tipo de negocio</div>
            <select value={bt} onChange={(e) => setBt(e.target.value)} style={styles.input}>
              <option value="hotel">hotel</option>
              <option value="restaurant">restaurant</option>
              <option value="spa">spa</option>
              <option value="other">other</option>
            </select>
          </div>

          <div>
            <div style={styles.label}>Nombre</div>
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Forbes 2025" style={styles.input} />
          </div>

          <div style={{ gridColumn: "1 / -1" }}>
            <div style={styles.label}>Descripción</div>
            <input value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="Pack de auditorías para..." style={styles.input} />
          </div>

          <div style={{ gridColumn: "1 / -1", display: "flex", gap: 10, justifyContent: "flex-end", flexWrap: "wrap" }}>
            <button style={styles.btnDark} disabled={saving} onClick={createPack}>
              {saving ? "Creando…" : "Crear Pack"}
            </button>
          </div>
        </div>
      </div>

      <div style={{ ...styles.card, marginTop: 16 }}>
        <div style={{ fontSize: 18, fontWeight: 950, marginBottom: 10 }}>Listado</div>

        {packs.length === 0 ? (
          <div style={{ opacity: 0.75 }}>Aún no hay packs creados.</div>
        ) : (
          <div style={{ display: "grid", gap: 10 }}>
            {packs.map((p) => (
              <div key={p.id} style={styles.row}>
                <div style={{ minWidth: 260 }}>
                  <div style={{ display: "flex", gap: 10, alignItems: "baseline", flexWrap: "wrap" }}>
                    <div style={{ fontWeight: 950 }}>{p.name}</div>
                    <span style={{ fontSize: 12, opacity: 0.7 }}>({p.business_type})</span>
                    {!p.active && (
                      <span style={{ fontSize: 11, padding: "2px 8px", borderRadius: 8, background: "rgba(0,0,0,0.12)", opacity: 0.75 }}>
                        Inactivo
                      </span>
                    )}
                  </div>
                  <div style={{ marginTop: 4, fontSize: 12, opacity: 0.75 }}>{p.description ?? "—"}</div>
                </div>

                <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
                  <button style={styles.btnWhite} onClick={() => toggleActive(p.id, !p.active)}>
                    {p.active ? "Desactivar" : "Activar"}
                  </button>
                  <button style={styles.btnDark} onClick={() => router.push(`/superadmin/packs/${p.id}`)}>
                    Gestionar
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