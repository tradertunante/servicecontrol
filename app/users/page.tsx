"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import BackButton from "@/app/components/BackButton";
import { requireRoleOrRedirect } from "@/lib/auth/RequireRole";
import { canManageUsers } from "@/lib/auth/permissions";

type Role = "admin" | "manager" | "auditor";

type Profile = {
  id: string;
  hotel_id: string;
  role: Role;
  active: boolean;
  full_name?: string | null;
};

type UserRow = {
  id: string;
  full_name: string | null;
  email: string | null;
  role: Role;
  active: boolean;
};

export default function UsersPage() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [profile, setProfile] = useState<Profile | null>(null);
  const [users, setUsers] = useState<UserRow[]>([]);
  const [busyId, setBusyId] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setError(null);

    try {
      const p = await requireRoleOrRedirect(router, ["admin", "manager"], "/login");
      if (!p) return;

      if (!canManageUsers(p.role)) {
        router.push("/");
        return;
      }

      setProfile(p as Profile);

      if (!p.hotel_id) {
        setUsers([]);
        setLoading(false);
        return;
      }

      const { data, error: uErr } = await supabase
        .from("profiles")
        .select("id, full_name, email, role, active")
        .eq("hotel_id", p.hotel_id)
        .order("full_name", { ascending: true });

      if (uErr) throw uErr;

      setUsers((data ?? []) as UserRow[]);
    } catch (e: any) {
      setError(e?.message ?? "No se pudieron cargar los usuarios.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router]);

  async function deleteUser(userId: string) {
    if (!profile) return;

    const u = users.find((x) => x.id === userId);
    const name = u?.full_name || u?.email || userId.slice(0, 8);

    if (userId === profile.id) {
      alert("No puedes borrarte a ti mismo.");
      return;
    }

    const ok = confirm(`Vas a borrar permanentemente a: ${name}\n\n¿Quieres continuar?`);
    if (!ok) return;

    const typed = prompt('Para confirmar, escribe BORRAR');
    if ((typed ?? "").trim().toUpperCase() !== "BORRAR") {
      alert("Cancelado. No se escribió BORRAR.");
      return;
    }

    try {
      setBusyId(userId);

      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData?.session?.access_token;
      if (!accessToken) throw new Error("Sesión inválida. Vuelve a iniciar sesión.");

      const res = await fetch("/api/admin/delete-user", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ user_id: userId }),
      });

      const text = await res.text();
      let payload: any = null;
      try {
        payload = JSON.parse(text);
      } catch {
        payload = { error: text?.slice(0, 200) || "Respuesta no-JSON del servidor." };
      }

      if (!res.ok) throw new Error(payload?.error ?? "No se pudo borrar el usuario.");

      await load();
    } catch (e: any) {
      alert(`❌ Error borrando: ${e?.message ?? "desconocido"}`);
    } finally {
      setBusyId(null);
    }
  }

  const card: React.CSSProperties = {
    borderRadius: 18,
    border: "1px solid rgba(0,0,0,0.08)",
    background: "rgba(255,255,255,0.75)",
    overflow: "hidden",
  };

  const topBtn: React.CSSProperties = {
    padding: "12px 16px",
    borderRadius: 12,
    border: "1px solid rgba(0,0,0,0.2)",
    background: "#000",
    color: "#fff",
    fontWeight: 950,
    cursor: "pointer",
    height: 44,
  };

  const topBtnLight: React.CSSProperties = {
    padding: "12px 16px",
    borderRadius: 12,
    border: "1px solid rgba(0,0,0,0.2)",
    background: "#fff",
    color: "#000",
    fontWeight: 950,
    cursor: "pointer",
    height: 44,
  };

  const headerCell: React.CSSProperties = {
    fontWeight: 950,
    padding: "14px 16px",
    borderBottom: "1px solid rgba(0,0,0,0.06)",
    background: "rgba(255,255,255,0.85)",
  };

  const rowCell: React.CSSProperties = {
    padding: "14px 16px",
    borderBottom: "1px solid rgba(0,0,0,0.05)",
    verticalAlign: "middle",
  };

  const actionBtn: React.CSSProperties = {
    padding: "10px 14px",
    borderRadius: 12,
    border: "1px solid rgba(0,0,0,0.35)",
    background: "#fff",
    fontWeight: 950,
    cursor: "pointer",
    height: 42,
  };

  const dangerBtn: React.CSSProperties = {
    padding: "10px 14px",
    borderRadius: 12,
    border: "1px solid rgba(220,20,60,0.55)",
    background: "rgba(220,20,60,0.08)",
    color: "crimson",
    fontWeight: 950,
    cursor: "pointer",
    height: 42,
    opacity: 1,
  };

  if (loading) {
    return (
      <main style={{ padding: 24 }}>
        <BackButton fallback="/" />
        <h1 style={{ fontSize: 56, marginBottom: 6 }}>Usuarios</h1>
        <div style={{ opacity: 0.8 }}>Cargando…</div>
      </main>
    );
  }

  if (error) {
    return (
      <main style={{ padding: 24 }}>
        <BackButton fallback="/" />
        <h1 style={{ fontSize: 56, marginBottom: 6 }}>Usuarios</h1>
        <div style={{ color: "crimson", fontWeight: 950 }}>{error}</div>
      </main>
    );
  }

  return (
    <main style={{ padding: 24 }}>
      <BackButton fallback="/" />

      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
        <div>
          <h1 style={{ fontSize: 56, marginBottom: 6 }}>Usuarios</h1>
          <div style={{ opacity: 0.8 }}>
            Solo admin · Hotel:{" "}
            <span style={{ fontFamily: "monospace" }}>{profile?.hotel_id ?? "—"}</span>
          </div>
        </div>

        <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
          <button style={topBtn} onClick={() => router.push("/users/new")}>
            + Crear usuario
          </button>
          <button style={topBtnLight} onClick={() => router.push("/")}>
            Volver
          </button>
        </div>
      </div>

      <div style={{ marginTop: 18, ...card }}>
        <div style={{ display: "grid", gridTemplateColumns: "2fr 2fr 1fr 1fr 220px", alignItems: "center" }}>
          <div style={headerCell}>Nombre</div>
          <div style={headerCell}>Email</div>
          <div style={headerCell}>Rol</div>
          <div style={headerCell}>Estado</div>
          <div style={headerCell}></div>

          {users.map((u) => (
            <div key={u.id} style={{ display: "contents" }}>
              <div style={rowCell}>
                <div style={{ fontWeight: 950 }}>
                  {u.full_name?.trim() ? u.full_name : "—"}
                  <span style={{ marginLeft: 10, opacity: 0.55, fontSize: 13 }}>
                    {u.id.slice(0, 8)}…
                  </span>
                </div>
              </div>

              <div style={rowCell}>
                <div style={{ opacity: 0.9, fontWeight: 800 }}>{u.email ?? "—"}</div>
              </div>

              <div style={rowCell}>
                <div style={{ fontWeight: 900 }}>{u.role}</div>
              </div>

              <div style={rowCell}>
                <div style={{ fontWeight: 900 }}>{u.active ? "Activo" : "Inactivo"}</div>
              </div>

              <div style={{ ...rowCell, display: "flex", justifyContent: "flex-end", gap: 10, flexWrap: "wrap" }}>
                <button style={actionBtn} onClick={() => router.push(`/users/${u.id}`)}>
                  Editar
                </button>

                <button
                  style={{ ...dangerBtn, opacity: busyId === u.id ? 0.6 : 1, cursor: busyId ? "not-allowed" : "pointer" }}
                  disabled={!!busyId}
                  onClick={() => deleteUser(u.id)}
                >
                  {busyId === u.id ? "Borrando..." : "Borrar"}
                </button>
              </div>
            </div>
          ))}

          {users.length === 0 ? (
            <div style={{ padding: 16, opacity: 0.8, gridColumn: "1 / -1" }}>
              No hay usuarios para mostrar.
            </div>
          ) : null}
        </div>
      </div>
    </main>
  );
}
