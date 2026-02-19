"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { requireRoleOrRedirect } from "@/lib/auth/RequireRole";
import HotelHeader from "@/app/components/HotelHeader";

type Role = "admin" | "manager" | "auditor" | "superadmin";

type Profile = {
  id: string;
  full_name?: string | null;
  role: Role;
  hotel_id: string | null;
  active?: boolean | null;
};

type AreaRow = {
  id: string;
  name: string;
  type: string | null;
  hotel_id: string | null;
  created_at?: string | null;
};

type HotelRow = {
  id: string;
  name: string;
};

const HOTEL_KEY = "sc_hotel_id";

export default function AreasPage() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [profile, setProfile] = useState<Profile | null>(null);

  const [hotelId, setHotelId] = useState<string | null>(null);
  const [hotelName, setHotelName] = useState<string | null>(null);

  const [areas, setAreas] = useState<AreaRow[]>([]);
  const [query, setQuery] = useState("");

  // ---- Theme vars (globals.css) ----
  const fg = "var(--text)";
  const bg = "var(--bg)";
  const muted = "var(--muted)";
  const cardBg = "var(--card-bg)";
  const border = "var(--border)";
  const rowBg = "var(--row-bg)";
  const shadowLg = "var(--shadow-lg)";
  const shadowSm = "var(--shadow-sm)";
  const inputBg = "var(--input-bg)";
  const inputBorder = "var(--input-border)";
  const placeholder = "var(--placeholder)";

  const btn: React.CSSProperties = {
    padding: "10px 12px",
    borderRadius: 12,
    border: `1px solid ${inputBorder}`,
    background: inputBg,
    color: fg,
    cursor: "pointer",
    fontWeight: 950,
    fontSize: 13,
    boxShadow: shadowSm,
    whiteSpace: "nowrap",
  };

  const primaryBtn: React.CSSProperties = {
    padding: "10px 12px",
    borderRadius: 12,
    border: `1px solid ${inputBorder}`,
    background: fg,
    color: bg,
    cursor: "pointer",
    fontWeight: 950,
    fontSize: 13,
    boxShadow: shadowSm,
    whiteSpace: "nowrap",
  };

  const card: React.CSSProperties = {
    borderRadius: 18,
    border: `1px solid ${border}`,
    background: cardBg,
    padding: 16,
    boxShadow: shadowLg,
    color: fg,
  };

  // 1) Cargar perfil + decidir hotelIdToUse (superadmin -> localStorage)
  useEffect(() => {
    let alive = true;

    (async () => {
      setLoading(true);
      setError(null);

      try {
        const p = (await requireRoleOrRedirect(router, ["admin", "manager", "auditor", "superadmin"], "/login")) as
          | Profile
          | null;

        if (!alive || !p) return;

        setProfile(p);

        let hotelIdToUse: string | null = null;

        if (p.role === "superadmin") {
          hotelIdToUse = typeof window !== "undefined" ? localStorage.getItem(HOTEL_KEY) : null;

          if (!hotelIdToUse) {
            setError("No hay hotel seleccionado. Vuelve al dashboard y selecciona uno.");
            setLoading(false);
            return;
          }
        } else {
          if (!p.hotel_id) {
            setError("Tu usuario no tiene hotel asignado.");
            setLoading(false);
            return;
          }
          hotelIdToUse = p.hotel_id;
          if (typeof window !== "undefined") localStorage.setItem(HOTEL_KEY, hotelIdToUse);
        }

        setHotelId(hotelIdToUse);

        // Nombre del hotel (para mostrar arriba)
        const { data: h, error: hErr } = await supabase
          .from("hotels")
          .select("id,name")
          .eq("id", hotelIdToUse)
          .single();

        if (hErr) throw hErr;
        if (!alive) return;
        setHotelName((h as HotelRow)?.name ?? null);

        setLoading(false);
      } catch (e: any) {
        if (!alive) return;
        setError(e?.message ?? "No se pudo cargar la página de áreas.");
        setLoading(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, [router]);

  // 2) Cargar áreas del hotel seleccionado (y accesos si auditor)
  useEffect(() => {
    let alive = true;

    (async () => {
      if (!profile || !hotelId) return;

      setLoading(true);
      setError(null);

      try {
        const isAdminLike = profile.role === "admin" || profile.role === "manager" || profile.role === "superadmin";

        let areasList: AreaRow[] = [];

        if (isAdminLike) {
          const { data, error: aErr } = await supabase
            .from("areas")
            .select("id,name,type,hotel_id,created_at")
            .eq("hotel_id", hotelId)
            .order("created_at", { ascending: false });

          if (aErr) throw aErr;
          areasList = (data ?? []) as AreaRow[];
        } else {
          // auditor: solo accesos permitidos (por hotel)
          const { data: accessData, error: accessErr } = await supabase
            .from("user_area_access")
            .select("area_id")
            .eq("user_id", profile.id)
            .eq("hotel_id", hotelId);

          if (accessErr) throw accessErr;

          const allowedIds = (accessData ?? []).map((r: any) => r.area_id).filter(Boolean);

          if (allowedIds.length > 0) {
            const { data: areasData, error: areasErr } = await supabase
              .from("areas")
              .select("id,name,type,hotel_id,created_at")
              .eq("hotel_id", hotelId)
              .in("id", allowedIds)
              .order("created_at", { ascending: false });

            if (areasErr) throw areasErr;
            areasList = (areasData ?? []) as AreaRow[];
          } else {
            areasList = [];
          }
        }

        if (!alive) return;
        setAreas(areasList);
        setLoading(false);
      } catch (e: any) {
        if (!alive) return;
        setError(e?.message ?? "No se pudieron cargar las áreas.");
        setLoading(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, [profile, hotelId]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return areas;

    return areas.filter((a) => {
      const hay = `${a.name ?? ""} ${a.type ?? ""} ${a.id ?? ""}`.toLowerCase();
      return hay.includes(q);
    });
  }, [areas, query]);

  const goArea = (areaId: string) => {
    router.push(`/areas/${areaId}/history`);
  };

  const createArea = async () => {
    if (!profile || !hotelId) return;

    const name = window.prompt("Nombre del área (ej: Front Office)");
    if (!name?.trim()) return;

    const type = window.prompt("Tipo (ej: FO, HK, F&B) (opcional)")?.trim() || null;

    setLoading(true);
    setError(null);

    try {
      const { data, error: insErr } = await supabase
        .from("areas")
        .insert([{ name: name.trim(), type, hotel_id: hotelId }])
        .select("id,name,type,hotel_id,created_at");

      if (insErr) throw insErr;

      const created = (data ?? []) as AreaRow[];
      setAreas((prev) => [...created, ...prev]);
      setLoading(false);
    } catch (e: any) {
      setError(e?.message ?? "No se pudo crear el área.");
      setLoading(false);
    }
  };

  return (
    <main style={{ padding: 24, paddingTop: 80, background: bg, color: fg }}>
      <HotelHeader />

      {/* Top bar */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <div style={{ fontSize: 22, fontWeight: 950 }}>
            Áreas {hotelName ? <span style={{ opacity: 0.65, fontWeight: 800 }}>· {hotelName}</span> : null}
          </div>
          <div style={{ fontSize: 13, opacity: 0.7 }}>
            Rol: <strong>{profile?.role ?? "—"}</strong>{" "}
            <span style={{ opacity: 0.6 }}>·</span>{" "}
            Total: <strong>{areas.length}</strong>
          </div>
        </div>

        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <button onClick={() => router.back()} style={btn}>
            ← Atrás
          </button>

          {(profile?.role === "admin" || profile?.role === "manager" || profile?.role === "superadmin") && (
            <button onClick={createArea} style={primaryBtn}>
              + Nueva Área
            </button>
          )}
        </div>
      </div>

      {/* Search */}
      <div style={{ marginTop: 16, display: "flex", gap: 12, alignItems: "center" }}>
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Buscar por nombre, tipo o ID…"
          style={{
            width: "100%",
            padding: "12px 14px",
            borderRadius: 14,
            border: `1px solid ${inputBorder}`,
            background: "var(--input-bg)",
            color: "var(--input-text)",
            boxShadow: shadowSm,
            outline: "none",
          }}
        />
      </div>

      {/* Loading / Error */}
      {loading && <div style={{ marginTop: 14, opacity: 0.8 }}>Cargando…</div>}

      {error && (
        <div
          style={{
            marginTop: 14,
            padding: 12,
            borderRadius: 14,
            border: `1px solid var(--danger, #c62828)`,
            background: "rgba(198, 40, 40, 0.08)",
            color: "var(--danger, #c62828)",
            fontWeight: 900,
          }}
        >
          {error}
        </div>
      )}

      {/* List */}
      {!loading && !error && (
        <div style={{ marginTop: 16, display: "grid", gap: 14 }}>
          {filtered.length === 0 ? (
            <div style={card}>
              <div style={{ fontWeight: 950 }}>No hay áreas</div>
              <div style={{ marginTop: 6, opacity: 0.75 }}>
                {query.trim()
                  ? "No hay resultados para tu búsqueda."
                  : "Este hotel todavía no tiene áreas creadas."}
              </div>
            </div>
          ) : (
            filtered.map((a) => (
              <div
                key={a.id}
                style={{
                  ...card,
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  gap: 12,
                }}
              >
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 18, fontWeight: 950 }}>{a.name}</div>

                  <div style={{ marginTop: 6, display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
                    <span
                      style={{
                        padding: "4px 10px",
                        borderRadius: 999,
                        background: rowBg,
                        border: `1px solid ${border}`,
                        fontSize: 12,
                        fontWeight: 900,
                        opacity: 0.9,
                      }}
                    >
                      {a.type ?? "Sin tipo"}
                    </span>

                    <span style={{ fontSize: 12, opacity: 0.7 }}>
                      ID: <span style={{ opacity: 0.9 }}>{a.id}</span>
                    </span>

                    {a.created_at ? (
                      <span style={{ fontSize: 12, opacity: 0.7 }}>
                        Creada:{" "}
                        <span style={{ opacity: 0.9 }}>
                          {new Date(a.created_at).toLocaleDateString("es-ES", {
                            day: "2-digit",
                            month: "short",
                            year: "numeric",
                          })}
                        </span>
                      </span>
                    ) : null}
                  </div>
                </div>

                <button onClick={() => goArea(a.id)} style={primaryBtn}>
                  Entrar
                </button>
              </div>
            ))
          )}
        </div>
      )}
    </main>
  );
}
