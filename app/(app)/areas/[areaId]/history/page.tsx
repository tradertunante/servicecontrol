"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { requireRoleOrRedirect } from "@/lib/auth/RequireRole";
import { canRunAudits } from "@/lib/auth/permissions";

type AuditRunRow = {
  id: string;
  area_id: string;
  audit_template_id: string;
  status: string | null;
  score: number | null;
  executed_at: string | null;
  created_at: string | null;
};

type Area = {
  id: string;
  name: string;
  type: string | null;
};

type Template = {
  id: string;
  name: string;
};

export default function AreaHistoryPage() {
  const router = useRouter();
  const params = useParams<{ areaId: string }>();
  const areaId = params?.areaId;

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [profile, setProfile] = useState<any>(null);
  const [area, setArea] = useState<Area | null>(null);

  const [runs, setRuns] = useState<AuditRunRow[]>([]);
  const [templatesMap, setTemplatesMap] = useState<Record<string, string>>({});

  const [statusFilter, setStatusFilter] = useState<"ALL" | "draft" | "submitted">("ALL");
  const [search, setSearch] = useState("");

  useEffect(() => {
    if (!areaId) return;

    (async () => {
      setLoading(true);
      setError(null);

      try {
        const p = await requireRoleOrRedirect(router, ["admin", "manager", "auditor"], "/areas");
        if (!p) return;
        setProfile(p);

        if (!canRunAudits(p.role)) {
          setError("No tienes permisos para ver el historial de auditorías.");
          setLoading(false);
          return;
        }

        // 1) Área
        const { data: areaData, error: areaErr } = await supabase
          .from("areas")
          .select("id,name,type")
          .eq("id", areaId)
          .single();

        if (areaErr || !areaData) throw areaErr ?? new Error("Área no encontrada.");
        setArea(areaData as Area);

        // 2) Runs del área
        const { data: runData, error: runErr } = await supabase
          .from("audit_runs")
          .select("id,area_id,audit_template_id,status,score,executed_at,created_at")
          .eq("area_id", areaId)
          .order("created_at", { ascending: false });

        if (runErr) throw runErr;

        const list = (runData ?? []) as AuditRunRow[];
        setRuns(list);

        // 3) Templates (sin embed): cargar nombres en batch
        const tplIds = Array.from(new Set(list.map((r) => r.audit_template_id).filter(Boolean)));
        if (tplIds.length > 0) {
          const { data: tplData, error: tplErr } = await supabase
            .from("audit_templates")
            .select("id,name")
            .in("id", tplIds);

          if (tplErr) throw tplErr;

          const map: Record<string, string> = {};
          for (const t of (tplData ?? []) as Template[]) map[t.id] = t.name;
          setTemplatesMap(map);
        } else {
          setTemplatesMap({});
        }

        setLoading(false);
      } catch (e: any) {
        setLoading(false);
        setError(e?.message ?? "Error cargando historial.");
      }
    })();
  }, [areaId, router]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();

    return runs.filter((r) => {
      if (statusFilter !== "ALL") {
        if ((r.status ?? "").toLowerCase() !== statusFilter) return false;
      }

      if (!q) return true;

      const tplName = (templatesMap[r.audit_template_id] ?? "").toLowerCase();
      const id = (r.id ?? "").toLowerCase();
      const st = (r.status ?? "").toLowerCase();

      return tplName.includes(q) || id.includes(q) || st.includes(q);
    });
  }, [runs, templatesMap, statusFilter, search]);

  function chipStyle(active: boolean): React.CSSProperties {
    return {
      padding: "8px 12px",
      borderRadius: 999,
      border: "1px solid rgba(0,0,0,0.2)",
      background: active ? "#000" : "#fff",
      color: active ? "#fff" : "#000",
      fontWeight: 900,
      cursor: "pointer",
    };
  }

  if (loading) {
    return (
      <main style={{ padding: 24 }}>
        <h1 style={{ fontSize: 52, marginBottom: 6 }}>Historial de auditorías</h1>
        <p>Cargando…</p>
      </main>
    );
  }

  if (error) {
    return (
      <main style={{ padding: 24 }}>
        <h1 style={{ fontSize: 52, marginBottom: 6 }}>Historial de auditorías</h1>
        <p style={{ color: "crimson", fontWeight: 900 }}>{error}</p>

        <button
          onClick={() => router.push(`/areas/${areaId}`)}
          style={{
            marginTop: 16,
            padding: "10px 14px",
            borderRadius: 12,
            border: "1px solid rgba(0,0,0,0.2)",
            background: "#fff",
            fontWeight: 900,
            cursor: "pointer",
          }}
        >
          Volver al área
        </button>
      </main>
    );
  }

  return (
    <main style={{ padding: 24 }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
        <div>
          <h1 style={{ fontSize: 52, marginBottom: 6 }}>Historial de auditorías</h1>
          <div style={{ opacity: 0.85 }}>
            <strong>{area?.name ?? "Área"}</strong>
            {area?.type ? ` · ${area.type}` : ""}
            {profile?.role ? (
              <>
                {" "}
                · Rol: <strong>{profile.role}</strong>
              </>
            ) : null}
          </div>
        </div>

        <button
          onClick={() => router.push(`/areas/${areaId}`)}
          style={{
            padding: "10px 14px",
            borderRadius: 12,
            border: "1px solid rgba(0,0,0,0.2)",
            background: "#fff",
            fontWeight: 900,
            cursor: "pointer",
            height: "fit-content",
          }}
        >
          Volver al área
        </button>
      </div>

      {/* filtros */}
      <div style={{ marginTop: 18, display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
        <div style={{ fontWeight: 900 }}>Estado:</div>

        <button style={chipStyle(statusFilter === "ALL")} onClick={() => setStatusFilter("ALL")}>
          Todos
        </button>
        <button style={chipStyle(statusFilter === "draft")} onClick={() => setStatusFilter("draft")}>
          Draft
        </button>
        <button
          style={chipStyle(statusFilter === "submitted")}
          onClick={() => setStatusFilter("submitted")}
        >
          Submitted
        </button>

        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar por plantilla / ID / estado…"
          style={{
            marginLeft: 8,
            padding: "10px 12px",
            borderRadius: 12,
            border: "1px solid rgba(0,0,0,0.2)",
            minWidth: 280,
          }}
        />

        <div style={{ marginLeft: 6, opacity: 0.8 }}>
          Mostrando: <strong>{filtered.length}</strong> / {runs.length}
        </div>
      </div>

      {/* listado */}
      <div style={{ marginTop: 18, display: "grid", gap: 14 }}>
        {filtered.map((r) => {
          const tplName = templatesMap[r.audit_template_id] ?? r.audit_template_id;

          const status = (r.status ?? "draft").toLowerCase();
          const badgeColor =
            status === "submitted" ? "rgba(0,128,0,0.12)" : "rgba(0,0,0,0.07)";
          const badgeBorder = status === "submitted" ? "rgba(0,128,0,0.25)" : "rgba(0,0,0,0.10)";

          return (
            <div
              key={r.id}
              style={{
                background: "rgba(255,255,255,0.75)",
                border: "1px solid rgba(0,0,0,0.10)",
                borderRadius: 18,
                padding: 16,
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                <div>
                  <div style={{ fontSize: 20, fontWeight: 900 }}>{tplName}</div>
                  <div style={{ opacity: 0.85, marginTop: 4, lineHeight: 1.6 }}>
                    <div>
                      <strong>ID:</strong> {r.id}
                    </div>
                    <div>
                      <strong>Estado:</strong>{" "}
                      <span
                        style={{
                          display: "inline-block",
                          padding: "4px 10px",
                          borderRadius: 999,
                          background: badgeColor,
                          border: `1px solid ${badgeBorder}`,
                          fontWeight: 900,
                          fontSize: 12,
                        }}
                      >
                        {r.status ?? "draft"}
                      </span>
                    </div>
                    <div>
                      <strong>Score:</strong> {typeof r.score === "number" ? `${r.score}%` : "-"}
                    </div>
                    <div>
                      <strong>Fecha:</strong>{" "}
                      {r.executed_at
                        ? new Date(r.executed_at).toLocaleString()
                        : r.created_at
                        ? new Date(r.created_at).toLocaleString()
                        : "-"}
                    </div>
                  </div>
                </div>

                <div style={{ display: "flex", gap: 10, alignItems: "flex-start", flexWrap: "wrap" }}>
                  {/* ✅ Aquí está el link al detalle por sección */}
                  <button
                    onClick={() => router.push(`/areas/${areaId}/history/${r.id}`)}
                    style={{
                      padding: "10px 14px",
                      borderRadius: 12,
                      border: "1px solid rgba(0,0,0,0.2)",
                      background: "#000",
                      color: "#fff",
                      fontWeight: 900,
                      cursor: "pointer",
                      height: "fit-content",
                    }}
                  >
                    Detalle por sección
                  </button>

                  {/* opcional: abrir la auditoría (form) */}
                  <button
                    onClick={() => router.push(`/audits/${r.id}`)}
                    style={{
                      padding: "10px 14px",
                      borderRadius: 12,
                      border: "1px solid rgba(0,0,0,0.2)",
                      background: "#fff",
                      fontWeight: 900,
                      cursor: "pointer",
                      height: "fit-content",
                    }}
                    title="Abrir la auditoría"
                  >
                    Ver auditoría
                  </button>
                </div>
              </div>
            </div>
          );
        })}

        {filtered.length === 0 ? (
          <div style={{ marginTop: 8, opacity: 0.8 }}>
            No hay auditorías que coincidan con el filtro/búsqueda.
          </div>
        ) : null}
      </div>
    </main>
  );
}
