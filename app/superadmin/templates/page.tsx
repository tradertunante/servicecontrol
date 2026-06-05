// FILE: app/superadmin/templates/page.tsx
"use client";

import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
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

const menuItemStyle: CSSProperties = {
  display: "block",
  width: "100%",
  padding: "11px 16px",
  textAlign: "left",
  background: "none",
  border: "none",
  fontWeight: 900,
  fontSize: 14,
  cursor: "pointer",
};

export default function SuperadminTemplatesPage() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);

  const [templates, setTemplates] = useState<TemplateRow[]>([]);
  const [areasById, setAreasById] = useState<Map<string, AreaRow>>(new Map());

  const [q, setQ] = useState("");
  const [onlyActive, setOnlyActive] = useState(false);

  useEffect(() => {
    let mounted = true;
    (async () => {
      setLoading(true);
      setError(null);
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
          const { data: aData, error: aErr } = await supabase.from("areas").select("id,name,type").in("id", areaIds);
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
    return () => { mounted = false; };
  }, []);

  async function getToken() {
    const { data } = await supabase.auth.getSession();
    return data.session?.access_token ?? "";
  }

  async function duplicateTemplate(t: TemplateRow) {
    setOpenMenuId(null);
    setBusyId(t.id);
    try {
      const token = await getToken();
      const res = await fetch(`/api/superadmin/templates/${t.id}/duplicate`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      const payload = await res.json().catch(() => null);
      if (!res.ok) throw new Error(payload?.error ?? "No se pudo duplicar.");
      router.push(`/superadmin/templates/${payload.template_id}`);
    } catch (e: any) {
      setError(e?.message ?? "Error al duplicar.");
    } finally {
      setBusyId(null);
    }
  }

  async function deleteTemplate(t: TemplateRow) {
    setOpenMenuId(null);
    if (!window.confirm(`¿Eliminar "${t.name}"? Borrará todas sus secciones y preguntas. No se puede deshacer.`)) return;
    setBusyId(t.id);
    try {
      const token = await getToken();
      const res = await fetch(`/api/superadmin/templates/${t.id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      const payload = await res.json().catch(() => null);
      if (!res.ok) throw new Error(payload?.error ?? "No se pudo eliminar.");
      setTemplates((prev) => prev.filter((x) => x.id !== t.id));
    } catch (e: any) {
      setError(e?.message ?? "Error al eliminar.");
    } finally {
      setBusyId(null);
    }
  }

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return templates.filter((t) => {
      if (onlyActive && t.active === false) return false;
      if (!needle) return true;
      const area = t.area_id ? areasById.get(t.area_id) : null;
      const haystack = [safeStr(t.name), safeStr(t.id), safeStr(area?.name), safeStr(area?.type)].join(" ").toLowerCase();
      return haystack.includes(needle);
    });
  }, [templates, areasById, q, onlyActive]);

  const card: CSSProperties = {
    borderRadius: 18,
    border: "1px solid rgba(0,0,0,0.08)",
    background: "rgba(255,255,255,0.75)",
    padding: 18,
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

  const btnWhite: CSSProperties = {
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

      {/* invisible overlay to close any open menu */}
      {openMenuId && (
        <div
          style={{ position: "fixed", inset: 0, zIndex: 99 }}
          onClick={() => setOpenMenuId(null)}
        />
      )}

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, flexWrap: "wrap" }}>
        <div>
          <h1 style={{ fontSize: 56, margin: "10px 0 6px" }}>Biblioteca Global</h1>
          <div style={{ opacity: 0.75, fontWeight: 900 }}>Packs + Plantillas (Global)</div>
        </div>

        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <button onClick={() => router.push("/superadmin/global-audits")} style={btnWhite}>
            Ver packs
          </button>
          <button onClick={() => router.push("/superadmin/global-audits")} style={btnBlack}>
            + Crear (desde packs)
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
            const busy = busyId === t.id;
            const menuOpen = openMenuId === t.id;

            return (
              <div
                key={t.id}
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
                }}
              >
                <div
                  style={{ flex: 1, minWidth: 200, cursor: "pointer" }}
                  onClick={() => router.push(`/superadmin/templates/${t.id}`)}
                >
                  <div style={{ fontWeight: 950, fontSize: 15 }}>{t.name ?? "Sin nombre"}</div>
                  <div style={{ marginTop: 4, opacity: 0.7, fontWeight: 900, fontSize: 12 }}>
                    Área: {area?.name ?? "—"}{area?.type ? ` · ${area.type}` : ""} · {t.created_at ? new Date(t.created_at).toLocaleString() : "—"}
                  </div>
                </div>

                <div style={{ display: "flex", gap: 8, alignItems: "center", flexShrink: 0 }}>
                  <div style={{ padding: "4px 10px", borderRadius: 999, background: "rgba(0,0,0,0.06)", border: "1px solid rgba(0,0,0,0.12)", fontWeight: 950, fontSize: 12 }}>
                    {status}
                  </div>

                  {/* three-dot menu */}
                  <div style={{ position: "relative", zIndex: 100 }}>
                    <button
                      disabled={busy}
                      onClick={(e) => { e.stopPropagation(); setOpenMenuId(menuOpen ? null : t.id); }}
                      style={{ ...btnWhite, width: 38, padding: 0, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18 }}
                      title="Opciones"
                    >
                      {busy ? "…" : "⋯"}
                    </button>

                    {menuOpen && (
                      <div style={{
                        position: "absolute",
                        top: "calc(100% + 4px)",
                        right: 0,
                        background: "#fff",
                        border: "1px solid rgba(0,0,0,0.12)",
                        borderRadius: 12,
                        boxShadow: "0 8px 24px rgba(0,0,0,0.12)",
                        minWidth: 160,
                        overflow: "hidden",
                        zIndex: 101,
                      }}>
                        <button
                          style={menuItemStyle}
                          onClick={(e) => { e.stopPropagation(); router.push(`/superadmin/templates/${t.id}`); }}
                          onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(0,0,0,0.04)")}
                          onMouseLeave={(e) => (e.currentTarget.style.background = "none")}
                        >
                          Editar
                        </button>
                        <button
                          style={{ ...menuItemStyle, borderTop: "1px solid rgba(0,0,0,0.06)" }}
                          onClick={(e) => { e.stopPropagation(); duplicateTemplate(t); }}
                          onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(0,0,0,0.04)")}
                          onMouseLeave={(e) => (e.currentTarget.style.background = "none")}
                        >
                          Duplicar
                        </button>
                        <button
                          style={{ ...menuItemStyle, borderTop: "1px solid rgba(0,0,0,0.06)", color: "#b91c1c" }}
                          onClick={(e) => { e.stopPropagation(); deleteTemplate(t); }}
                          onMouseEnter={(e) => (e.currentTarget.style.background = "#fef2f2")}
                          onMouseLeave={(e) => (e.currentTarget.style.background = "none")}
                        >
                          Eliminar
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}

          {filtered.length === 0 ? <div style={{ padding: 10, opacity: 0.8 }}>No hay resultados.</div> : null}
        </div>
      </div>
    </main>
  );
}