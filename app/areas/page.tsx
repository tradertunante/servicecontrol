"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import BackButton from "@/app/components/BackButton";
import { requireRoleOrRedirect } from "@/lib/auth/RequireRole";

type AreaRow = {
  id: string;
  name: string;
  type: string | null;
  hotel_id: string | null;
  created_at: string | null;
};

function fmtDate(iso: string | null) {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleDateString("es-ES", { year: "numeric", month: "short", day: "2-digit" });
}

export default function AreasPage() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [profile, setProfile] = useState<any>(null);
  const [areas, setAreas] = useState<AreaRow[]>([]);

  const [q, setQ] = useState("");

  useEffect(() => {
    (async () => {
      setLoading(true);
      setError(null);

      try {
        const p = await requireRoleOrRedirect(router, ["admin", "manager", "auditor"], "/login");
        if (!p) return;
        setProfile(p);

        if (!p?.hotel_id) {
          setAreas([]);
          setLoading(false);
          return;
        }

        // ✅ ADMIN/MANAGER: ven todas las áreas del hotel
        if (p.role === "admin" || p.role === "manager") {
          const { data, error: aErr } = await supabase
            .from("areas")
            .select("id,name,type,hotel_id,created_at")
            .eq("hotel_id", p.hotel_id)
            .order("name", { ascending: true });

          if (aErr) throw aErr;

          setAreas((data ?? []) as AreaRow[]);
          setLoading(false);
          return;
        }

        // ✅ AUDITOR: solo áreas asignadas en user_area_access
        if (p.role === "auditor") {
          const { data: accessData, error: accessErr } = await supabase
            .from("user_area_access")
            .select("area_id")
            .eq("user_id", p.id)
            .eq("hotel_id", p.hotel_id);

          if (accessErr) throw accessErr;

          const allowedIds = (accessData ?? []).map((r: any) => r.area_id).filter(Boolean);

          if (allowedIds.length === 0) {
            setAreas([]);
            setLoading(false);
            return;
          }

          const { data: areasData, error: areasErr } = await supabase
            .from("areas")
            .select("id,name,type,hotel_id,created_at")
            .eq("hotel_id", p.hotel_id)
            .in("id", allowedIds)
            .order("name", { ascending: true });

          if (areasErr) throw areasErr;

          setAreas((areasData ?? []) as AreaRow[]);
          setLoading(false);
          return;
        }

        // fallback (por si aparece un rol nuevo)
        setAreas([]);
      } catch (e: any) {
        setError(e?.message ?? "No se pudieron cargar las áreas.");
      } finally {
        setLoading(false);
      }
    })();
  }, [router]);

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return areas;

    return areas.filter((a) => {
      const hay = `${a.name ?? ""} ${a.type ?? ""} ${a.id ?? ""}`.toLowerCase();
      return hay.includes(s);
    });
  }, [areas, q]);

  const card: React.CSSProperties = {
    borderRadius: 18,
    border: "1px solid rgba(0,0,0,0.08)",
    background: "rgba(255,255,255,0.75)",
    padding: 18,
  };

  const btn: React.CSSProperties = {
    padding: "10px 14px",
    borderRadius: 12,
    border: "1px solid rgba(0,0,0,0.2)",
    background: "#000",
    color: "#fff",
    fontWeight: 900,
    cursor: "pointer",
    height: 42,
  };

  if (loading) {
    return (
      <main style={{ padding: 24 }}>
        <BackButton fallback="/" />
        <h1 style={{ fontSize: 56, marginBottom: 6 }}>Áreas</h1>
        <div style={{ opacity: 0.8 }}>Cargando…</div>
      </main>
    );
  }

  if (error) {
    return (
      <main style={{ padding: 24 }}>
        <BackButton fallback="/" />
        <h1 style={{ fontSize: 56, marginBottom: 6 }}>Áreas</h1>
        <div style={{ color: "crimson", fontWeight: 900 }}>{error}</div>
      </main>
    );
  }

  return (
    <main style={{ padding: 24 }}>
      <BackButton fallback="/" />

      <h1 style={{ fontSize: 56, marginBottom: 6 }}>Áreas</h1>
      <div style={{ opacity: 0.85, marginBottom: 18 }}>
        Rol: <strong>{profile?.role ?? "—"}</strong>
        {profile?.role === "auditor" ? (
          <span style={{ marginLeft: 10, opacity: 0.8 }}>· Solo ves áreas asignadas</span>
        ) : null}
      </div>

      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center", marginBottom: 16 }}>
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Buscar por nombre, tipo o ID…"
          style={{
            padding: "10px 12px",
            borderRadius: 12,
            border: "1px solid rgba(0,0,0,0.2)",
            outline: "none",
            minWidth: 280,
            fontWeight: 800,
          }}
        />

        <div style={{ marginLeft: "auto", fontWeight: 900, opacity: 0.8 }}>
          Total: {filtered.length}
        </div>
      </div>

      <div style={{ display: "grid", gap: 14 }}>
        {filtered.map((a) => (
          <div key={a.id} style={card}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
              <div>
                <div style={{ fontSize: 20, fontWeight: 950 }}>{a.name}</div>
                <div style={{ opacity: 0.85, marginTop: 6 }}>
                  {a.type ? <span style={{ fontWeight: 900 }}>{a.type}</span> : null}
                  {a.type ? " · " : ""}
                  <span style={{ opacity: 0.8 }}>Creada: {fmtDate(a.created_at)}</span>
                </div>
                <div style={{ opacity: 0.7, marginTop: 6, fontSize: 13 }}>ID: {a.id}</div>
              </div>

              <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                {/* ✅ Entrar ahora lleva a Templates */}
                <button onClick={() => router.push(`/areas/${a.id}?tab=templates`)} style={btn}>
                  Entrar
                </button>
              </div>
            </div>
          </div>
        ))}

        {filtered.length === 0 ? (
          <div style={card}>
            {profile?.role === "auditor"
              ? "No tienes áreas asignadas. Pide a un admin que te habilite accesos."
              : "No hay áreas para mostrar."}
          </div>
        ) : null}
      </div>
    </main>
  );
}
