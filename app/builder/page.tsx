"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { requireRoleOrRedirect } from "@/lib/auth/RequireRole";

type AreaRow = { id: string; name: string; type: string | null };

type TemplateRow = {
  id: string;
  name: string;
  active: boolean | null;
  area_id: string | null;
  created_at?: string | null;
  areas?: { id: string; name: string; type: string | null } | null;
};

function fmtDate(iso?: string | null) {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleString("es-ES", { year: "numeric", month: "short", day: "2-digit" });
}

export default function BuilderHomePage() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [profile, setProfile] = useState<any>(null);
  const [templates, setTemplates] = useState<TemplateRow[]>([]);
  const [areasById, setAreasById] = useState<Record<string, AreaRow>>({});

  const [q, setQ] = useState("");
  const [areaFilter, setAreaFilter] = useState<string>("ALL");

  useEffect(() => {
    (async () => {
      setLoading(true);
      setError(null);

      try {
        const p = await requireRoleOrRedirect(router, ["admin", "manager"], "/areas");
        if (!p) return;
        setProfile(p);

        // Areas (para filtro y mostrar nombre)
        const { data: aData, error: aErr } = await supabase
          .from("areas")
          .select("id,name,type")
          .eq("hotel_id", p.hotel_id)
          .order("name", { ascending: true });

        if (aErr) throw aErr;

        const map: Record<string, AreaRow> = {};
        for (const a of (aData ?? []) as any[]) map[a.id] = a;
        setAreasById(map);

        // Templates (constructor)
        const { data: tData, error: tErr } = await supabase
          .from("audit_templates")
          .select("id,name,active,area_id,created_at")
          .eq("hotel_id", p.hotel_id)
          .order("created_at", { ascending: false })
          .limit(200);

        if (tErr) throw tErr;

        setTemplates((tData ?? []) as TemplateRow[]);
        setLoading(false);
      } catch (e: any) {
        setLoading(false);
        setError(e?.message ?? "Error cargando constructor.");
      }
    })();
  }, [router]);

  const filtered = useMemo(() => {
    const query = q.trim().toLowerCase();

    return templates.filter((t) => {
      const areaName =
        t.areas?.name ??
        (t.area_id ? areasById[t.area_id]?.name : null) ??
        "";

      const okArea = areaFilter === "ALL" ? true : t.area_id === areaFilter;
      const okQuery =
        !query ||
        t.name.toLowerCase().includes(query) ||
        areaName.toLowerCase().includes(query) ||
        t.id.toLowerCase().includes(query);

      return okArea && okQuery;
    });
  }, [templates, q, areaFilter, areasById]);

  const card: React.CSSProperties = {
    borderRadius: 18,
    border: "1px solid rgba(0,0,0,0.08)",
    background: "rgba(255,255,255,0.85)",
    padding: 18,
  };

  const btnPrimary: React.CSSProperties = {
    padding: "10px 14px",
    borderRadius: 12,
    border: "1px solid rgba(0,0,0,0.2)",
    background: "#000",
    color: "#fff",
    fontWeight: 900,
    cursor: "pointer",
    textDecoration: "none",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    height: 42,
  };

  const btnGhost: React.CSSProperties = {
    padding: "10px 14px",
    borderRadius: 12,
    border: "1px solid rgba(0,0,0,0.2)",
    background: "#fff",
    color: "#000",
    fontWeight: 900,
    cursor: "pointer",
    textDecoration: "none",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    height: 42,
  };

  if (loading) {
    return (
      <main style={{ padding: 24 }}>
        <h1 style={{ fontSize: 54, marginBottom: 8 }}>Constructor de auditorías</h1>
        <p>Cargando…</p>
      </main>
    );
  }

  if (error) {
    return (
      <main style={{ padding: 24 }}>
        <h1 style={{ fontSize: 54, marginBottom: 8 }}>Constructor de auditorías</h1>
        <p style={{ color: "crimson", fontWeight: 900 }}>{error}</p>
        <div style={{ marginTop: 16 }}>
          <Link href="/areas" style={btnGhost}>
            Volver a áreas
          </Link>
        </div>
      </main>
    );
  }

  const areaOptions = Object.values(areasById);

  return (
    <main style={{ padding: 24 }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
        <div>
          <h1 style={{ fontSize: 54, margin: 0 }}>Constructor de auditorías</h1>
          <div style={{ opacity: 0.85, marginTop: 8 }}>
            Rol: <strong>{profile?.role}</strong>
          </div>
        </div>

        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <Link href="/builder/new" style={btnPrimary}>
            + Nueva auditoría
          </Link>
          <Link href="/areas" style={btnGhost}>
            Volver a áreas
          </Link>
        </div>
      </div>

      <div style={{ marginTop: 16, ...card }}>
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Buscar por nombre, área o ID…"
              style={{
                padding: "10px 12px",
                borderRadius: 14,
                border: "1px solid rgba(0,0,0,0.18)",
                minWidth: 260,
                fontWeight: 800,
                outline: "none",
              }}
            />

            <select
              value={areaFilter}
              onChange={(e) => setAreaFilter(e.target.value)}
              style={{
                padding: "10px 12px",
                borderRadius: 14,
                border: "1px solid rgba(0,0,0,0.18)",
                minWidth: 220,
                fontWeight: 900,
                outline: "none",
                background: "#fff",
              }}
            >
              <option value="ALL">Todas</option>
              {areaOptions.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </select>
          </div>

          <div style={{ fontWeight: 900, opacity: 0.8 }}>Total: {filtered.length}</div>
        </div>
      </div>

      <div style={{ marginTop: 14, display: "grid", gap: 12 }}>
        {filtered.map((t) => {
          const isActive = t.active !== false;
          const a = t.areas ?? (t.area_id ? areasById[t.area_id] : null);

          return (
            <div key={t.id} style={card}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
                <div>
                  <div style={{ fontSize: 20, fontWeight: 950 }}>{t.name}</div>
                  <div style={{ marginTop: 6, opacity: 0.85 }}>
                    <strong>Área:</strong> {a ? `${a.name}${a.type ? ` · ${a.type}` : ""}` : "—"} ·{" "}
                    <strong>Creada:</strong> {fmtDate(t.created_at)}
                  </div>
                  <div style={{ marginTop: 6, fontSize: 12.5, opacity: 0.75 }}>
                    ID:{" "}
                    <span style={{ fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace" }}>
                      {t.id}
                    </span>
                  </div>
                </div>

                <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
                  <span
                    style={{
                      padding: "6px 10px",
                      borderRadius: 999,
                      border: "1px solid rgba(0,0,0,0.15)",
                      background: isActive ? "rgba(0,0,0,0.06)" : "rgba(200,0,0,0.06)",
                      fontWeight: 950,
                      fontSize: 12,
                    }}
                  >
                    {isActive ? "ACTIVA" : "INACTIVA"}
                  </span>

                  <Link href={`/builder/${t.id}`} style={btnPrimary}>
                    Editar
                  </Link>

                  {t.area_id ? (
                    <Link href={`/areas/${t.area_id}?tab=templates`} style={btnGhost}>
                      Ver en área
                    </Link>
                  ) : null}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </main>
  );
}