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
  created_at?: string | null;
};

export default function PacksListPage() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [packs, setPacks] = useState<PackRow[]>([]);

  // create
  const [bt, setBt] = useState("hotel");
  const [name, setName] = useState("");
  const [desc, setDesc] = useState("");
  const [active, setActive] = useState(true);

  const styles = useMemo(() => {
    const page: React.CSSProperties = { padding: 24, paddingTop: 80 };
    const card: React.CSSProperties = {
      background: "var(--card-bg)",
      border: "1px solid var(--header-border)",
      borderRadius: 18,
      boxShadow: "var(--shadow-sm)",
      padding: 18,
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
      border: "1px solid var(--input-border)",
      background: "var(--input-bg)",
      color: "var(--input-text)",
    };
    const label: React.CSSProperties = { fontSize: 12, opacity: 0.75, fontWeight: 900 };
    const row: React.CSSProperties = {
      background: "rgba(0,0,0,0.02)",
      border: "1px solid rgba(0,0,0,0.08)",
      borderRadius: 14,
      padding: "10px 12px",
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center",
      gap: 12,
      flexWrap: "wrap",
    };
    return { page, card, btnDark, btnWhite, input, label, row };
  }, []);

  async function load() {
    setLoading(true);
    setError(null);

    const p = await requireRoleOrRedirect(router, ["superadmin"], "/dashboard");
    if (!p) return;

    const { data, error: e } = await supabase
      .from("global_audit_packs")
      .select("id,business_type,name,description,active,created_at")
      .order("created_at", { ascending: false });

    if (e) setError(e.message);
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
    const trimmed = name.trim();
    if (!trimmed) {
      setError("Pon un nombre para el pack.");
      return;
    }

    setSaving(true);
    setError(null);

    const { data, error: e } = await supabase
      .from("global_audit_packs")
      .insert({
        business_type: bt.trim(),
        name: trimmed,
        description: desc.trim() ? desc.trim() : null,
        active,
      })
      .select("id")
      .single();

    if (e) {
      setError(e.message);
      setSaving(false);
      return;
    }

    const newId = (data as any)?.id as string;
    setName("");
    setDesc("");
    setBt("hotel");
    setActive(true);
    setSaving(false);

    router.push(`/superadmin/hotels/packs/${newId}`);
  }

  return (
    <main style={styles.page}>
      <HotelHeader />

      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
        <div>
          <div style={{ fontSize: 28, fontWeight: 950, letterSpacing: -0.4 }}>Packs Globales</div>
          <div style={{ opacity: 0.75, marginTop: 6, fontSize: 13 }}>
            Crea packs globales y asócialos a plantillas globales.
          </div>
        </div>

        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <button style={styles.btnWhite} onClick={() => router.push("/superadmin")}>
            ← Atrás
          </button>
          <button style={styles.btnWhite} onClick={load}>
            Recargar
          </button>
        </div>
      </div>

      <div style={{ ...styles.card, marginTop: 16 }}>
        <div style={{ fontSize: 16, fontWeight: 950, marginBottom: 10 }}>Crear pack global</div>

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
            <input value={name} onChange={(e) => setName(e.target.value)} style={styles.input} />
          </div>

          <div style={{ gridColumn: "1 / -1" }}>
            <div style={styles.label}>Descripción</div>
            <input value={desc} onChange={(e) => setDesc(e.target.value)} style={styles.input} />
          </div>

          <div style={{ gridColumn: "1 / -1", display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
            <label style={{ display: "flex", alignItems: "center", gap: 10, fontWeight: 900 }}>
              <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} />
              Activo
            </label>

            <div style={{ flex: 1 }} />

            <button style={styles.btnDark} disabled={saving} onClick={createPack}>
              {saving ? "Creando…" : "Crear"}
            </button>
          </div>
        </div>

        {error ? <div style={{ marginTop: 12, color: "var(--danger)", fontWeight: 900 }}>{error}</div> : null}
      </div>

      <div style={{ ...styles.card, marginTop: 16 }}>
        {loading ? (
          <div style={{ opacity: 0.8 }}>Cargando…</div>
        ) : packs.length === 0 ? (
          <div style={{ opacity: 0.75 }}>No hay packs aún.</div>
        ) : (
          <div style={{ display: "grid", gap: 10 }}>
            {packs.map((p) => (
              <div key={p.id} style={styles.row}>
                <div style={{ minWidth: 260 }}>
                  <div style={{ fontWeight: 950, fontSize: 16 }}>{p.name}</div>
                  <div style={{ fontSize: 12, opacity: 0.75, marginTop: 4 }}>
                    {p.business_type} · ID: {p.id}
                  </div>
                </div>

                <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
                  <button style={styles.btnDark} onClick={() => router.push(`/superadmin/hotels/packs/${p.id}`)}>
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