"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import HotelHeader from "@/app/components/HotelHeader";
import { supabase } from "@/lib/supabaseClient";
import { requireRoleOrRedirect, type Profile } from "@/lib/auth/RequireRole";

type Role = "admin" | "manager" | "auditor" | "superadmin";

type UserRow = {
  id: string;
  full_name: string | null;
  role: Role;
  hotel_id: string | null;
  active: boolean | null;
  email?: string | null;
  created_at?: string | null;
};

const HOTEL_KEY = "sc_hotel_id";
const HOTEL_CHANGED_EVENT = "sc-hotel-changed";

const EDITABLE_ROLES = ["admin", "manager", "auditor"] as const;
type EditableRole = (typeof EDITABLE_ROLES)[number];
function isEditableRole(x: any): x is EditableRole {
  return EDITABLE_ROLES.includes(x);
}

export default function AdminUsersPage() {
  const router = useRouter();

  const [booting, setBooting] = useState(true);
  const [profile, setProfile] = useState<Profile | null>(null);

  const [activeHotelId, setActiveHotelId] = useState<string | null>(null);

  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string>("");
  const [message, setMessage] = useState<string>("");

  const [users, setUsers] = useState<UserRow[]>([]);

  const [q, setQ] = useState("");
  const [roleFilter, setRoleFilter] = useState<"all" | Role>("all");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "inactive">("all");

  // Gate permisos
  useEffect(() => {
    let mounted = true;

    (async () => {
      const prof = await requireRoleOrRedirect(router, ["admin", "superadmin"], "/login");
      if (!mounted) return;
      setProfile(prof);
      setBooting(false);
    })().catch((e) => {
      console.error(e);
      if (!mounted) return;
      setError("Error cargando permisos (mira consola).");
      setBooting(false);
    });

    return () => {
      mounted = false;
    };
  }, [router]);

  // Hotel activo (localStorage)
  useEffect(() => {
    const readHotel = () => {
      try {
        const hid = localStorage.getItem(HOTEL_KEY);
        setActiveHotelId(hid);
      } catch {
        setActiveHotelId(null);
      }
    };

    readHotel();
    window.addEventListener(HOTEL_CHANGED_EVENT, readHotel);
    window.addEventListener("storage", readHotel);

    return () => {
      window.removeEventListener(HOTEL_CHANGED_EVENT, readHotel);
      window.removeEventListener("storage", readHotel);
    };
  }, []);

  async function loadUsers() {
    setError("");
    setMessage("");

    if (!activeHotelId) {
      setUsers([]);
      setLoading(false);
      setError("No hay hotel seleccionado. Selecciona un hotel primero.");
      return;
    }

    setLoading(true);

    try {
      // OJO: select email solo si existe en profiles.
      // Si no existe, quítalo del select y listo.
      const { data, error: err } = await supabase
        .from("profiles")
        .select("id, full_name, role, hotel_id, active, email, created_at")
        .eq("hotel_id", activeHotelId)
        .order("full_name", { ascending: true });

      if (err) throw err;

      setUsers((data ?? []) as any);
      setLoading(false);
    } catch (e: any) {
      console.error(e);
      setLoading(false);
      setError(e?.message || "Error cargando usuarios.");
    }
  }

  useEffect(() => {
    if (!booting) loadUsers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [booting, activeHotelId]);

  const filtered = useMemo(() => {
    let list = [...users];

    const needle = q.trim().toLowerCase();
    if (needle) {
      list = list.filter((u) => {
        const name = (u.full_name ?? "").toLowerCase();
        const id = (u.id ?? "").toLowerCase();
        const role = (u.role ?? "").toLowerCase();
        const email = (u.email ?? "").toLowerCase();
        return (
          name.includes(needle) ||
          id.includes(needle) ||
          role.includes(needle) ||
          email.includes(needle)
        );
      });
    }

    if (roleFilter !== "all") {
      list = list.filter((u) => u.role === roleFilter);
    }

    if (statusFilter !== "all") {
      list =
        statusFilter === "active"
          ? list.filter((u) => (u.active ?? true) === true)
          : list.filter((u) => (u.active ?? true) === false);
    }

    return list;
  }, [users, q, roleFilter, statusFilter]);

  async function getBearer() {
    const { data } = await supabase.auth.getSession();
    return data.session?.access_token ?? null;
  }

  async function updateUserRole(userId: string, nextRole: EditableRole) {
    setError("");
    setMessage("");

    if (!activeHotelId) {
      setError("No hay hotel seleccionado.");
      return;
    }

    const token = await getBearer();
    if (!token) {
      setError("No autorizado (sin sesión).");
      return;
    }

    setBusyId(userId);
    try {
      const res = await fetch("/api/admin/update-user-role", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          user_id: userId,
          hotel_id: activeHotelId,
          role: nextRole, // ✅ nunca superadmin
        }),
      });

      const json = await res.json().catch(() => ({} as any));
      if (!res.ok) {
        throw new Error(json?.error || `Error (${res.status}) actualizando rol.`);
      }

      setUsers((prev) =>
        prev.map((u) => (u.id === userId ? { ...u, role: nextRole } : u))
      );
      setMessage("Rol actualizado.");
    } catch (e: any) {
      setError(e?.message || "Error actualizando rol.");
    } finally {
      setBusyId(null);
    }
  }

  async function setActive(userId: string, nextActive: boolean) {
    setError("");
    setMessage("");

    if (!activeHotelId) {
      setError("No hay hotel seleccionado.");
      return;
    }

    const token = await getBearer();
    if (!token) {
      setError("No autorizado (sin sesión).");
      return;
    }

    setBusyId(userId);
    try {
      const res = await fetch("/api/admin/set-user-active", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          user_id: userId,
          hotel_id: activeHotelId,
          active: nextActive,
        }),
      });

      const json = await res.json().catch(() => ({} as any));
      if (!res.ok) {
        throw new Error(json?.error || `Error (${res.status}) actualizando estado.`);
      }

      setUsers((prev) =>
        prev.map((u) => (u.id === userId ? { ...u, active: nextActive } : u))
      );
      setMessage(nextActive ? "Usuario activado." : "Usuario desactivado.");
    } catch (e: any) {
      setError(e?.message || "Error actualizando estado.");
    } finally {
      setBusyId(null);
    }
  }

  async function softDelete(userId: string) {
    setError("");
    setMessage("");

    if (!activeHotelId) {
      setError("No hay hotel seleccionado.");
      return;
    }

    const token = await getBearer();
    if (!token) {
      setError("No autorizado (sin sesión).");
      return;
    }

    setBusyId(userId);
    try {
      const res = await fetch("/api/admin/delete-user", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          user_id: userId,
          hotel_id: activeHotelId,
        }),
      });

      const json = await res.json().catch(() => ({} as any));
      if (!res.ok) {
        throw new Error(json?.error || `Error (${res.status}) borrando usuario.`);
      }

      setUsers((prev) =>
        prev.map((u) => (u.id === userId ? { ...u, active: false } : u))
      );
      setMessage("Usuario desactivado (borrado lógico).");
    } catch (e: any) {
      setError(e?.message || "Error borrando usuario.");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg)", color: "var(--text)" }}>
      <HotelHeader />

      <div style={{ padding: 24 }}>
        <div
          style={{
            background: "var(--card-bg)",
            border: "1px solid var(--border)",
            borderRadius: 16,
            boxShadow: "var(--shadow-sm)",
            padding: 18,
          }}
        >
          <div style={{ fontSize: 13, color: "var(--muted)", fontWeight: 800 }}>
            Panel · Administración
          </div>

          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
            <div>
              <h1 style={{ margin: "6px 0 0", fontSize: 22, fontWeight: 900 }}>
                Administrar usuarios
              </h1>

              <div style={{ marginTop: 8, color: "var(--muted)", fontSize: 13 }}>
                {booting ? (
                  "Cargando permisos…"
                ) : profile ? (
                  <>
                    Sesión:{" "}
                    <span style={{ fontWeight: 900 }}>
                      {profile.full_name ?? "Usuario"}
                    </span>{" "}
                    · rol{" "}
                    <span style={{ fontWeight: 900 }}>{profile.role}</span>
                  </>
                ) : (
                  "Sin perfil."
                )}
              </div>
            </div>

            <div style={{ display: "flex", gap: 10 }}>
              <button
                onClick={() => router.push("/admin")}
                style={{
                  padding: "10px 14px",
                  borderRadius: 12,
                  border: "1px solid var(--border)",
                  background: "var(--card-bg)",
                  fontWeight: 900,
                  cursor: "pointer",
                }}
              >
                ← Admin
              </button>

              <button
                onClick={() => router.push("/admin/create-user")}
                style={{
                  padding: "10px 14px",
                  borderRadius: 12,
                  border: "1px solid var(--border)",
                  background: "black",
                  color: "white",
                  fontWeight: 900,
                  cursor: "pointer",
                }}
              >
                + Crear usuario
              </button>

              <button
                onClick={loadUsers}
                style={{
                  padding: "10px 14px",
                  borderRadius: 12,
                  border: "1px solid var(--border)",
                  background: "var(--card-bg)",
                  fontWeight: 900,
                  cursor: "pointer",
                }}
              >
                Recargar
              </button>
            </div>
          </div>

          <div
            style={{
              marginTop: 14,
              display: "flex",
              gap: 12,
              alignItems: "center",
              flexWrap: "wrap",
              padding: 12,
              borderRadius: 14,
              background: "rgba(0,0,0,0.03)",
              border: "1px solid var(--border)",
            }}
          >
            <div style={{ fontSize: 13, color: "var(--muted)", fontWeight: 900 }}>
              Hotel:{" "}
              <span style={{ fontWeight: 900, color: "var(--text)" }}>
                {activeHotelId ?? "—"}
              </span>
            </div>

            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Buscar por nombre, rol o ID..."
              style={{
                flex: 1,
                minWidth: 260,
                padding: "10px 12px",
                borderRadius: 12,
                border: "1px solid var(--border)",
                background: "var(--card-bg)",
              }}
            />

            <select
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value as any)}
              style={{
                padding: "10px 12px",
                borderRadius: 12,
                border: "1px solid var(--border)",
                background: "var(--card-bg)",
                fontWeight: 900,
              }}
            >
              <option value="all">Todos</option>
              <option value="admin">admin</option>
              <option value="manager">manager</option>
              <option value="auditor">auditor</option>
              {/* 🚫 NO superadmin */}
            </select>

            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as any)}
              style={{
                padding: "10px 12px",
                borderRadius: 12,
                border: "1px solid var(--border)",
                background: "var(--card-bg)",
                fontWeight: 900,
              }}
            >
              <option value="all">Todos</option>
              <option value="active">Activos</option>
              <option value="inactive">Inactivos</option>
            </select>
          </div>
        </div>

        {error ? (
          <div
            style={{
              marginTop: 14,
              padding: 12,
              borderRadius: 12,
              border: "1px solid rgba(220,0,0,0.35)",
              background: "rgba(220,0,0,0.06)",
              color: "crimson",
              fontWeight: 900,
              maxWidth: 980,
            }}
          >
            {error}
          </div>
        ) : null}

        {message ? (
          <div
            style={{
              marginTop: 14,
              padding: 12,
              borderRadius: 12,
              border: "1px solid var(--border)",
              background: "rgba(0,200,0,0.10)",
              color: "green",
              fontWeight: 900,
              maxWidth: 980,
            }}
          >
            {message}
          </div>
        ) : null}

        <div style={{ marginTop: 16, maxWidth: 980 }}>
          {loading ? (
            <div style={{ fontWeight: 900 }}>Cargando…</div>
          ) : filtered.length === 0 ? (
            <div
              style={{
                background: "var(--card-bg)",
                border: "1px solid var(--border)",
                borderRadius: 16,
                boxShadow: "var(--shadow-sm)",
                padding: 18,
              }}
            >
              <div style={{ fontWeight: 900 }}>No hay usuarios</div>
              <div style={{ marginTop: 6, color: "var(--muted)" }}>
                No hay usuarios en este hotel (o no coinciden con el filtro).
              </div>
            </div>
          ) : (
            filtered.map((u) => {
              const disabled = busyId === u.id;
              const isActive = (u.active ?? true) === true;

              return (
                <div
                  key={u.id}
                  style={{
                    background: "var(--card-bg)",
                    border: "1px solid var(--border)",
                    borderRadius: 16,
                    boxShadow: "var(--shadow-sm)",
                    padding: 16,
                    marginBottom: 12,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: 12,
                    flexWrap: "wrap",
                  }}
                >
                  <div style={{ minWidth: 260 }}>
                    <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
                      <div style={{ fontWeight: 900 }}>
                        {u.full_name ?? "Sin nombre"}
                      </div>

                      <span
                        style={{
                          fontSize: 12,
                          fontWeight: 900,
                          padding: "4px 8px",
                          borderRadius: 999,
                          border: "1px solid var(--border)",
                          background: "rgba(0,0,0,0.03)",
                        }}
                      >
                        {u.role}
                      </span>

                      <span
                        style={{
                          fontSize: 12,
                          fontWeight: 900,
                          padding: "4px 8px",
                          borderRadius: 999,
                          border: "1px solid var(--border)",
                          background: isActive ? "rgba(0,200,0,0.10)" : "rgba(0,0,0,0.04)",
                          color: isActive ? "green" : "var(--muted)",
                        }}
                      >
                        {isActive ? "ACTIVO" : "INACTIVO"}
                      </span>
                    </div>

                    <div style={{ marginTop: 6, fontSize: 12, color: "var(--muted)" }}>
                      ID: {u.id}
                      {u.email ? <> · {u.email}</> : null}
                    </div>
                  </div>

                  <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
                    {/* 🚫 Nunca permitir cambiar rol a superadmin */}
                    {u.role === "superadmin" ? (
                      <span
                        style={{
                          padding: "8px 10px",
                          borderRadius: 10,
                          border: "1px solid var(--border)",
                          background: "rgba(0,0,0,0.03)",
                          fontWeight: 900,
                          opacity: 0.8,
                        }}
                        title="Este rol no se puede cambiar desde Admin"
                      >
                        superadmin 🔒
                      </span>
                    ) : (
                      <select
                        value={isEditableRole(u.role) ? u.role : "admin"}
                        disabled={disabled}
                        onChange={(e) => {
                          const next = e.target.value;
                          if (!isEditableRole(next)) {
                            setError("No se puede asignar superadmin desde esta pantalla.");
                            return;
                          }
                          updateUserRole(u.id, next);
                        }}
                        style={{
                          padding: "8px 10px",
                          borderRadius: 10,
                          border: "1px solid var(--border)",
                          background: "var(--card-bg)",
                          fontWeight: 900,
                          cursor: disabled ? "not-allowed" : "pointer",
                          opacity: disabled ? 0.6 : 1,
                        }}
                      >
                        <option value="admin">admin</option>
                        <option value="manager">manager</option>
                        <option value="auditor">auditor</option>
                      </select>
                    )}

                    <button
                      disabled={disabled || u.role === "superadmin"}
                      onClick={() => setActive(u.id, !isActive)}
                      style={{
                        padding: "8px 10px",
                        borderRadius: 12,
                        border: "1px solid var(--border)",
                        background: "var(--card-bg)",
                        fontWeight: 900,
                        cursor: disabled ? "not-allowed" : "pointer",
                        opacity: disabled || u.role === "superadmin" ? 0.6 : 1,
                      }}
                      title={u.role === "superadmin" ? "No editable aquí" : ""}
                    >
                      {isActive ? "Desactivar" : "Activar"}
                    </button>

                    <button
                      disabled={disabled || u.role === "superadmin"}
                      onClick={() => softDelete(u.id)}
                      style={{
                        padding: "8px 10px",
                        borderRadius: 12,
                        border: "1px solid rgba(220,0,0,0.35)",
                        background: "rgba(220,0,0,0.06)",
                        color: "crimson",
                        fontWeight: 900,
                        cursor: disabled ? "not-allowed" : "pointer",
                        opacity: disabled || u.role === "superadmin" ? 0.6 : 1,
                      }}
                      title={u.role === "superadmin" ? "No editable aquí" : ""}
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
    </div>
  );
}