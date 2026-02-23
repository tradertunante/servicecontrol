// app/(app)/admin/delete-user/page.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import HotelHeader from "@/app/components/HotelHeader";
import { supabase } from "@/lib/supabaseClient";
import { requireRoleOrRedirect, type Profile as LoadedProfile } from "@/lib/auth/RequireRole";

type Role = "admin" | "manager" | "auditor" | "superadmin";

type UserRow = {
  id: string;
  full_name: string | null;
  role: Role;
  hotel_id: string | null;
  active: boolean | null;
  created_at: string | null;
};

const HOTEL_KEY = "sc_hotel_id";
const HOTEL_CHANGED_EVENT = "sc-hotel-changed";

function getActiveHotelId(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(HOTEL_KEY);
}

export default function AdminUsersPage() {
  const router = useRouter();

  const [booting, setBooting] = useState(true);
  const [loading, setLoading] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string>("");

  const [profile, setProfile] = useState<LoadedProfile | null>(null);
  const [hotelId, setHotelId] = useState<string | null>(null);

  const [users, setUsers] = useState<UserRow[]>([]);
  const [query, setQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState<Role | "ALL">("ALL");
  const [statusFilter, setStatusFilter] = useState<"ALL" | "ACTIVE" | "INACTIVE">("ALL");

  // fallbacks por si CSS vars no están
  const fg = "var(--text, #111)";
  const bg = "var(--bg, #f6f7fb)";
  const muted = "var(--muted, rgba(0,0,0,0.6))";
  const cardBg = "var(--card-bg, rgba(255,255,255,0.92))";
  const border = "var(--border, rgba(0,0,0,0.12))";
  const rowBg = "var(--row-bg, rgba(0,0,0,0.04))";
  const inputBg = "var(--input-bg, rgba(255,255,255,0.85))";
  const inputBorder = "var(--input-border, rgba(0,0,0,0.14))";
  const shadowSm = "var(--shadow-sm, 0 4px 16px rgba(0,0,0,0.08))";
  const shadowLg = "var(--shadow-lg, 0 10px 30px rgba(0,0,0,0.14))";
  const danger = "var(--danger, #c62828)";

  const cardStyle: React.CSSProperties = {
    borderRadius: 18,
    border: `1px solid ${border}`,
    background: cardBg,
    padding: 16,
    boxShadow: shadowLg,
    color: fg,
  };

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
    ...btn,
    background: fg,
    color: bg,
  };

  const smallBtn: React.CSSProperties = {
    padding: "8px 10px",
    borderRadius: 12,
    border: `1px solid ${inputBorder}`,
    background: inputBg,
    color: fg,
    cursor: "pointer",
    fontWeight: 950,
    fontSize: 12,
    boxShadow: shadowSm,
    whiteSpace: "nowrap",
  };

  const dangerBtn: React.CSSProperties = {
    ...smallBtn,
    border: `1px solid rgba(198,40,40,0.35)`,
    background: "rgba(198,40,40,0.08)",
    color: danger,
  };

  const loadUsers = async (hId: string) => {
    setLoading(true);
    setError("");

    try {
      const { data, error: qErr } = await supabase
        .from("profiles")
        .select("id, full_name, role, hotel_id, active, created_at")
        .eq("hotel_id", hId)
        .order("created_at", { ascending: false });

      if (qErr) throw qErr;

      setUsers((data ?? []) as UserRow[]);
    } catch (e: any) {
      setUsers([]);
      setError(e?.message ?? "No se pudieron cargar los usuarios.");
    } finally {
      setLoading(false);
    }
  };

  // Guard + resolver hotel activo
  useEffect(() => {
    let alive = true;

    (async () => {
      try {
        setError("");
        setBooting(true);

        const p = (await requireRoleOrRedirect(router, ["admin", "superadmin"], "/dashboard")) as LoadedProfile | null;
        if (!alive || !p) return;

        setProfile(p);

        // Importante:
        // - superadmin: usa SIEMPRE el hotel seleccionado (localStorage)
        // - admin: usa su propio hotel_id y lo fuerza en localStorage
        let hId: string | null = null;

        if (p.role === "superadmin") {
          hId = getActiveHotelId();
          if (!hId) {
            setUsers([]);
            setHotelId(null);
            setError("No hay hotel seleccionado. Vuelve al dashboard y selecciona uno.");
            setBooting(false);
            return;
          }
        } else {
          hId = p.hotel_id ?? null;
          if (!hId) {
            setUsers([]);
            setHotelId(null);
            setError("Tu usuario no tiene hotel asignado.");
            setBooting(false);
            return;
          }
          if (typeof window !== "undefined") localStorage.setItem(HOTEL_KEY, hId);
        }

        setHotelId(hId);
        setBooting(false);
      } catch (e: any) {
        if (!alive) return;
        setUsers([]);
        setError(e?.message ?? "No se pudo cargar Administrar usuarios.");
        setBooting(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, [router]);

  // ✅ Escuchar cambios de hotel desde el header y refrescar
  useEffect(() => {
    if (typeof window === "undefined") return;

    const onHotelChanged = () => {
      const next = getActiveHotelId();
      setHotelId(next);
    };

    window.addEventListener(HOTEL_CHANGED_EVENT, onHotelChanged);
    return () => window.removeEventListener(HOTEL_CHANGED_EVENT, onHotelChanged);
  }, []);

  // Cargar usuarios cuando haya hotelId
  useEffect(() => {
    if (!hotelId) return;
    loadUsers(hotelId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hotelId]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();

    return users
      .filter((u) => (roleFilter === "ALL" ? true : u.role === roleFilter))
      .filter((u) => {
        const isActive = (u.active ?? true) === true;
        if (statusFilter === "ALL") return true;
        if (statusFilter === "ACTIVE") return isActive;
        return !isActive;
      })
      .filter((u) => {
        if (!q) return true;
        const hay = `${u.full_name ?? ""} ${u.role ?? ""} ${u.id ?? ""}`.toLowerCase();
        return hay.includes(q);
      });
  }, [users, query, roleFilter, statusFilter]);

  const setUserActive = async (userId: string, next: boolean) => {
    if (!hotelId) return;

    setBusyId(userId);
    setError("");

    try {
      const { error: upErr } = await supabase
        .from("profiles")
        .update({ active: next })
        .eq("id", userId)
        .eq("hotel_id", hotelId);

      if (upErr) throw upErr;

      setUsers((prev) => prev.map((u) => (u.id === userId ? { ...u, active: next } : u)));
    } catch (e: any) {
      setError(e?.message ?? "No se pudo actualizar el estado.");
    } finally {
      setBusyId(null);
    }
  };

  const setUserRole = async (userId: string, nextRole: Role) => {
    if (!hotelId) return;

    setBusyId(userId);
    setError("");

    try {
      const { error: upErr } = await supabase
        .from("profiles")
        .update({ role: nextRole })
        .eq("id", userId)
        .eq("hotel_id", hotelId);

      if (upErr) throw upErr;

      setUsers((prev) => prev.map((u) => (u.id === userId ? { ...u, role: nextRole } : u)));
    } catch (e: any) {
      setError(e?.message ?? "No se pudo actualizar el rol.");
    } finally {
      setBusyId(null);
    }
  };

  const deleteUser = async (u: UserRow) => {
    const ok = window.confirm(
      `¿Seguro que quieres borrar a "${u.full_name ?? "Usuario"}"?\n\nEsto lo dejará INACTIVO (no podrá entrar).`
    );
    if (!ok) return;

    await setUserActive(u.id, false);
  };

  return (
    <main style={{ paddingTop: 80, minHeight: "100vh", background: bg, color: fg }}>
      <HotelHeader />

      <div style={{ padding: 24 }}>
        <div style={cardStyle}>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              gap: 12,
              flexWrap: "wrap",
              alignItems: "flex-start",
            }}
          >
            <div>
              <div style={{ fontSize: 13, color: muted, fontWeight: 800 }}>Panel · Administración</div>
              <div style={{ marginTop: 6, fontSize: 22, fontWeight: 950 }}>Administrar usuarios</div>
              <div style={{ marginTop: 6, fontSize: 14, color: muted, lineHeight: 1.35 }}>
                Cambia rol, activa/desactiva o “borra” (desactiva).
              </div>
            </div>

            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              <button onClick={() => router.push("/admin")} style={btn}>
                ← Admin
              </button>
              <button onClick={() => router.push("/admin/create-user")} style={primaryBtn}>
                + Crear usuario
              </button>
              <button onClick={() => (hotelId ? loadUsers(hotelId) : null)} style={btn}>
                Recargar
              </button>
            </div>
          </div>

          {/* Estado visible SIEMPRE */}
          <div style={{ marginTop: 12 }}>
            {booting ? (
              <div
                style={{
                  padding: 12,
                  borderRadius: 14,
                  background: rowBg,
                  border: `1px solid ${border}`,
                  color: muted,
                  fontWeight: 900,
                }}
              >
                Iniciando…
              </div>
            ) : error ? (
              <div
                style={{
                  padding: 12,
                  borderRadius: 14,
                  border: `1px solid rgba(198,40,40,0.3)`,
                  background: "rgba(198,40,40,0.08)",
                  color: danger,
                  fontWeight: 900,
                }}
              >
                {error}
              </div>
            ) : (
              <div
                style={{
                  padding: 12,
                  borderRadius: 14,
                  background: rowBg,
                  border: `1px solid ${border}`,
                  display: "flex",
                  justifyContent: "space-between",
                  gap: 10,
                  flexWrap: "wrap",
                }}
              >
                <div style={{ fontWeight: 900, fontSize: 13, color: muted }}>
                  Sesión: <span style={{ color: fg }}>{profile?.full_name ?? "Usuario"}</span> · rol{" "}
                  <span style={{ color: fg }}>{profile?.role ?? "—"}</span>
                </div>
                <div style={{ fontWeight: 900, fontSize: 13, color: muted }}>
                  Hotel: <span style={{ color: fg }}>{hotelId ?? "—"}</span>
                </div>
              </div>
            )}
          </div>

          {/* Filtros */}
          <div style={{ marginTop: 12, display: "grid", gridTemplateColumns: "2fr 1fr 1fr", gap: 10 }}>
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar por nombre, rol o ID…"
              style={{
                width: "100%",
                padding: "12px 14px",
                borderRadius: 14,
                border: `1px solid ${inputBorder}`,
                background: inputBg,
                color: fg,
                boxShadow: shadowSm,
                outline: "none",
              }}
            />

            <select
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value as any)}
              style={{
                padding: "12px 14px",
                borderRadius: 14,
                border: `1px solid ${inputBorder}`,
                background: inputBg,
                color: fg,
                boxShadow: shadowSm,
                outline: "none",
                fontWeight: 900,
              }}
            >
              <option value="ALL">Todos</option>
              <option value="admin">admin</option>
              <option value="manager">manager</option>
              <option value="auditor">auditor</option>
              <option value="superadmin">superadmin</option>
            </select>

            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as any)}
              style={{
                padding: "12px 14px",
                borderRadius: 14,
                border: `1px solid ${inputBorder}`,
                background: inputBg,
                color: fg,
                boxShadow: shadowSm,
                outline: "none",
                fontWeight: 900,
              }}
            >
              <option value="ALL">Todos</option>
              <option value="ACTIVE">Activos</option>
              <option value="INACTIVE">Inactivos</option>
            </select>
          </div>
        </div>

        {/* Lista */}
        <div style={{ marginTop: 14, display: "grid", gap: 12 }}>
          {loading ? (
            <div style={cardStyle}>Cargando usuarios…</div>
          ) : !hotelId ? (
            <div style={cardStyle}>
              <div style={{ fontWeight: 950 }}>Sin hotel</div>
              <div style={{ marginTop: 6, opacity: 0.75 }}>
                No hay hotel seleccionado. Vuelve al dashboard y selecciona uno.
              </div>
            </div>
          ) : filtered.length === 0 ? (
            <div style={cardStyle}>
              <div style={{ fontWeight: 950 }}>No hay usuarios</div>
              <div style={{ marginTop: 6, opacity: 0.75 }}>
                {query.trim() ? "No hay resultados para tu búsqueda." : "No hay usuarios en este hotel."}
              </div>
            </div>
          ) : (
            filtered.map((u) => {
              const isActive = (u.active ?? true) === true;

              return (
                <div
                  key={u.id}
                  style={{
                    ...cardStyle,
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    gap: 12,
                    flexWrap: "wrap",
                  }}
                >
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
                      <div style={{ fontSize: 16, fontWeight: 950 }}>{u.full_name ?? "Sin nombre"}</div>

                      <span
                        style={{
                          padding: "4px 10px",
                          borderRadius: 999,
                          border: `1px solid ${border}`,
                          background: rowBg,
                          fontSize: 12,
                          fontWeight: 900,
                        }}
                      >
                        {u.role}
                      </span>

                      <span
                        style={{
                          padding: "4px 10px",
                          borderRadius: 999,
                          border: `1px solid ${border}`,
                          background: isActive ? "rgba(46,125,50,0.10)" : "rgba(198,40,40,0.08)",
                          color: isActive ? "rgba(46,125,50,1)" : danger,
                          fontSize: 12,
                          fontWeight: 950,
                        }}
                      >
                        {isActive ? "ACTIVO" : "INACTIVO"}
                      </span>
                    </div>

                    <div style={{ marginTop: 8, fontSize: 12, opacity: 0.75, wordBreak: "break-all" }}>ID: {u.id}</div>
                  </div>

                  <div
                    style={{
                      display: "flex",
                      gap: 10,
                      flexWrap: "wrap",
                      justifyContent: "flex-end",
                      alignItems: "center",
                    }}
                  >
                    <select
                      value={u.role}
                      disabled={busyId === u.id}
                      onChange={(e) => setUserRole(u.id, e.target.value as Role)}
                      style={{
                        padding: "10px 12px",
                        borderRadius: 12,
                        border: `1px solid ${inputBorder}`,
                        background: inputBg,
                        color: fg,
                        fontWeight: 950,
                        boxShadow: shadowSm,
                        outline: "none",
                        minWidth: 160,
                        opacity: busyId === u.id ? 0.6 : 1,
                      }}
                    >
                      <option value="admin">admin</option>
                      <option value="manager">manager</option>
                      <option value="auditor">auditor</option>
                      <option value="superadmin">superadmin</option>
                    </select>

                    <button
                      style={{ ...smallBtn, opacity: busyId === u.id ? 0.6 : 1 }}
                      disabled={busyId === u.id}
                      onClick={() => setUserActive(u.id, !isActive)}
                    >
                      {busyId === u.id ? "Guardando…" : isActive ? "Desactivar" : "Activar"}
                    </button>

                    <button
                      style={{ ...dangerBtn, opacity: busyId === u.id ? 0.6 : 1 }}
                      disabled={busyId === u.id}
                      onClick={() => deleteUser(u)}
                    >
                      Borrar
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      <style jsx>{`
        @media (max-width: 720px) {
          main > div {
            padding: 14px 12px !important;
          }
        }
      `}</style>
    </main>
  );
}