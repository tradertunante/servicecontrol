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

export default function GlobalAuditsPage() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [packs, setPacks] = useState<PackRow[]>([]);

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
    const row: React.CSSProperties = {
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
    const tag: React.CSSProperties = {
      padding: "6px 10px",
      borderRadius: 999,
      border: "1px solid rgba(0,0,0,0.12)",
      background: "rgba(0,0,0,0.03)",
      fontSize: 12,
      fontWeight: 900,
      textTransform: "uppercase",
      letterSpacing: 0.4,
    };
    return { page, card, btnDark, btnWhite, row, tag };
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

  return (
    <main style={styles.page}>
      <HotelHeader />

      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
        <div>
          <div style={{ fontSize: 28, fontWeight: 950, letterSpacing: -0.4 }}>Global Audits</div>
          <div style={{ opacity: 0.75, marginTop: 6, fontSize: 13 }}>Packs globales y sus plantillas.</div>
        </div>

        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <button style={styles.btnWhite} onClick={() => router.push("/superadmin/packs")}>
            ← Atrás
          </button>
          <button style={styles.btnWhite} onClick={load}>
            Recargar
          </button>
        </div>
      </div>

      <div style={{ ...styles.card, marginTop: 16 }}>
        {loading ? (
          <div style={{ opacity: 0.8 }}>Cargando…</div>
        ) : error ? (
          <div style={{ color: "var(--danger)", fontWeight: 900 }}>{error}</div>
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