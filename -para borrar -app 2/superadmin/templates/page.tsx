"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { requireRoleOrRedirect } from "@/lib/auth/RequireRole";
import HotelHeader from "@/app/components/HotelHeader";

type TemplateRow = {
  id: string;
  name: string;
  active: boolean | null;
  area_id: string | null;
  created_at: string | null;
  scope: string | null;
};

type AreaRow = { id: string; name: string; type: string | null };

function safeStr(v: any): string {
  return (v ?? "").toString();
}

export default function SuperadminTemplatesPage() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [templates, setTemplates] = useState<TemplateRow[]>([]);
  const [areasById, setAreasById] = useState<Map<string, AreaRow>>(new Map());

  const [q, setQ] = useState("");
  const [onlyActive, setOnlyActive] = useState(false);

  useEffect(() => {
    let mounted = true;

    (async () => {
      setLoading(true);
      setError(null);

      const p = await requireRoleOrRedirect(router, ["superadmin"], "/dashboard");
      if (!p) return;

      try {
        const { data: tData, error: tErr } = await supabase
          .from("audit_templates")
          .select("id,name,active,area_id,created_at,scope")
          .eq("scope", "global")
          .order("created_at", { ascending: false })
          .limit(300);

        if (tErr) throw tErr;
        const list = (tData ?? []) as TemplateRow[];

        const areaIds = Array.from(new Set(list.map((t) => t.area_id).filter(Boolean))) as string[];

        const areaMap = new Map<string, AreaRow>();
        if (areaIds.length) {
          const { data: aData, error: aErr } = await supabase
            .from("areas")
            .select("id,name,type")
            .in("id", areaIds);

          if (aErr) throw aErr;
          for (const a of (aData ?? []) as AreaRow[]) areaMap.set(a.id, a);
        }

        if (!mounted) return;
        setTemplates(list);
        setAreasById(areaMap);
      } catch (e: any) {
        if (!mounted) return;
        setError(e?.message ?? "Error cargando plantillas.");
      } finally {
        if (mounted) setLoading(false);
      }
    })();

    return () => {
      mounted = false;
    };
  }, [router]);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return templates.filter((t) => {
      if (onlyActive && t.active === false) return false;
      if (!needle) return true;

      const area = t.area_id ? areasById.get(t.area_id) : null;
      const haystack = [safeStr(t.name), safeStr(t.id), safeStr(area?.name), safeStr(area?.type)]
        .join(" ")
        .toLowerCase();

      return haystack.includes(needle);
    });
  }, [templates, areasById, q, onlyActive]);

  const card: React.CSSProperties = {
    borderRadius: 18,
    border: "1px solid rgba(0,0,0,0.08)",
    background: "rgba(255,255,255,0.75)",
    padding: 18,
  };

  const btnBlack: React.CSSProperties = {
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

  const btnWhite: React.CSSProperties = {
    padding: "10px 14px",
    borderRadius: 12,
    border: "1px solid rgba(0,0,0,0.2)",
    background: "#fff",
    color: "#000",
    fontWeight: 900,
    cursor: "pointer",
    height: 42,
    whiteSpace: "nowrap",
  };

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

      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          gap: 12,
          flexWrap: "wrap",
        }}
      >
        <div>
          <h1 style={{ fontSize: 56, margin: "10px 0 6px" }}>Biblioteca Global</h1>
          <div style={{ opacity: 0.75, fontWeight: 900 }}>Packs + Plantillas (Global)</div>
        </div>

        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <button onClick={() => router.push("/superadmin/global-audits")} style={btnWhite}>
            Ver packs
          </button>

          {/* ✅ PASO 1: crear plantilla → /superadmin/templates/new */}
          <button onClick={() => router.push("/superadmin/templates/new")} style={btnBlack}>
            + Crear plantilla
          </button>
        </div>
      </div>

      {error ? <div style={{ marginTop: 12, color: "crimson", fontWeight: 950 }}>{error}</div> : null}

      <div style={{ ...card, marginTop: 14 }}>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Buscar por nombre, área, tipo o ID…"
            style={{
              flex: 1,
              minWidth: 260,
              padding: "12px 14px",
              borderRadius: 14,
              border: "1px solid rgba(0,0,0,0.18)",
              outline: "none",
              fontWeight: 900,
              fontSize: 16,
              background: "#fff",
            }}
          />

          <label style={{ display: "flex", gap: 8, alignItems: "center", fontWeight: 900 }}>
            <input type="checkbox" checked={onlyActive} onChange={(e) => setOnlyActive(e.target.checked)} />
            Solo activas
          </label>

          <div style={{ fontWeight: 900, opacity: 0.8 }}>Total: {filtered.length}</div>
        </div>

        <div style={{ marginTop: 14, display: "grid", gap: 10 }}>
          {filtered.map((t) => {
            const area = t.area_id ? areasById.get(t.area_id) : null;
            const status = t.active === false ? "INACTIVA" : "ACTIVA";

            return (
              <button
                key={t.id}
                onClick={() => router.push(`/superadmin/templates/${t.id}`)}
                style={{
                  textAlign: "left",
                  padding: "14px 14px",
                  borderRadius: 16,
                  border: "1px solid rgba(0,0,0,0.12)",
                  background: "#fff",
                  cursor: "pointer",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
                  <div style={{ fontWeight: 950, fontSize: 16 }}>{t.name ?? "Sin nombre"}</div>

                  <div
                    style={{
                      padding: "6px 10px",
                      borderRadius: 999,
                      background: "rgba(0,0,0,0.06)",
                      border: "1px solid rgba(0,0,0,0.12)",
                      fontWeight: 950,
                      fontSize: 12,
                    }}
                  >
                    {status}
                  </div>
                </div>

                <div style={{ marginTop: 6, opacity: 0.75, fontWeight: 900, fontSize: 12 }}>
                  Área: {area?.name ?? "—"}
                  {area?.type ? ` · ${area.type}` : ""} ·{" "}
                  {t.created_at ? new Date(t.created_at).toLocaleString() : "—"}
                </div>

                <div style={{ marginTop: 2, opacity: 0.55, fontWeight: 900, fontSize: 11 }}>
                  ID: {t.id}
                </div>
              </button>
            );
          })}

          {filtered.length === 0 ? <div style={{ padding: 10, opacity: 0.8 }}>No hay resultados.</div> : null}
        </div>
      </div>
    </main>
  );
}