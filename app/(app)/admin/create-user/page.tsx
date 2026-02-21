"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import HotelHeader from "@/app/components/HotelHeader";
import { supabase } from "@/lib/supabaseClient";
import { requireRoleOrRedirect, type Profile } from "@/lib/auth/RequireRole";

export default function CreateUserPage() {
  const router = useRouter();

  const [booting, setBooting] = useState(true);
  const [profile, setProfile] = useState<Profile | null>(null);

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<"auditor" | "manager" | "admin">("auditor");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  // Gate de permisos
  useEffect(() => {
    let mounted = true;

    (async () => {
      const prof = await requireRoleOrRedirect(
        router,
        ["admin", "superadmin"],
        "/login"
      );
      if (!mounted) return;
      setProfile(prof);
      setBooting(false);
    })().catch((e) => {
      console.error(e);
      if (!mounted) return;
      setMessage("Error cargando permisos (mira consola).");
      setBooting(false);
    });

    return () => {
      mounted = false;
    };
  }, [router]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setMessage(null);

    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;

    if (!token) {
      setMessage("No autorizado (sin sesión).");
      setLoading(false);
      return;
    }

    try {
      // ✅ ENDPOINT CORRECTO
      const res = await fetch("/api/admin/create-user", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          full_name: fullName ? fullName : null,
          email,
          password,
          role,
        }),
      });

      const json = await res.json().catch(() => ({} as any));

      if (!res.ok) {
        setMessage(json?.error || `Error (${res.status}) creando usuario.`);
      } else {
        setMessage(
          `Usuario creado correctamente. ID: ${json?.user_id ?? "??"}`
        );
        setFullName("");
        setEmail("");
        setPassword("");
        setRole("auditor");
      }
    } catch (err: any) {
      setMessage(err?.message || "Error de red llamando al endpoint.");
    } finally {
      setLoading(false);
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
            Admin · Usuarios
          </div>

          <h1 style={{ margin: "6px 0 0", fontSize: 22, fontWeight: 900 }}>
            Crear usuario
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
                <span style={{ fontWeight: 900 }}>
                  {profile.role}
                </span>
              </>
            ) : (
              "Sin perfil."
            )}
          </div>
        </div>

        <form
          onSubmit={handleSubmit}
          style={{
            marginTop: 16,
            background: "var(--card-bg)",
            border: "1px solid var(--border)",
            borderRadius: 16,
            boxShadow: "var(--shadow-sm)",
            padding: 18,
            maxWidth: 560,
          }}
        >
          <div style={{ display: "grid", gap: 12 }}>
            <div>
              <label style={{ fontWeight: 800, fontSize: 13 }}>
                Nombre completo
              </label>
              <input
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                style={{
                  width: "100%",
                  marginTop: 6,
                  padding: 10,
                  borderRadius: 10,
                  border: "1px solid var(--border)",
                }}
                placeholder="Opcional"
              />
            </div>

            <div>
              <label style={{ fontWeight: 800, fontSize: 13 }}>
                Email
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                style={{
                  width: "100%",
                  marginTop: 6,
                  padding: 10,
                  borderRadius: 10,
                  border: "1px solid var(--border)",
                }}
                placeholder="correo@hotel.com"
              />
            </div>

            <div>
              <label style={{ fontWeight: 800, fontSize: 13 }}>
                Password
              </label>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                style={{
                  width: "100%",
                  marginTop: 6,
                  padding: 10,
                  borderRadius: 10,
                  border: "1px solid var(--border)",
                }}
                placeholder="mínimo 8 caracteres"
              />
            </div>

            <div>
              <label style={{ fontWeight: 800, fontSize: 13 }}>
                Rol
              </label>
              <select
                value={role}
                onChange={(e) => setRole(e.target.value as any)}
                style={{
                  width: "100%",
                  marginTop: 6,
                  padding: 10,
                  borderRadius: 10,
                  border: "1px solid var(--border)",
                }}
              >
                <option value="auditor">Auditor</option>
                <option value="manager">Manager</option>
                <option value="admin">Admin</option>
              </select>
            </div>

            <div style={{ display: "flex", gap: 10 }}>
              <button
                type="submit"
                disabled={loading || booting}
                style={{
                  padding: "10px 14px",
                  borderRadius: 12,
                  border: "1px solid var(--border)",
                  background: "var(--card-bg)",
                  fontWeight: 900,
                  cursor: "pointer",
                }}
              >
                {loading ? "Creando…" : "Crear usuario"}
              </button>

              <button
                type="button"
                onClick={() => router.push("/admin")}
                style={{
                  padding: "10px 14px",
                  borderRadius: 12,
                  border: "1px solid var(--border)",
                  background: "rgba(0,0,0,0.03)",
                  fontWeight: 900,
                  cursor: "pointer",
                }}
              >
                Volver a Admin
              </button>
            </div>

            {message && (
              <div
                style={{
                  marginTop: 8,
                  padding: 12,
                  borderRadius: 12,
                  background: "var(--row-bg)",
                  border: "1px solid var(--border)",
                  fontSize: 13,
                  fontWeight: 800,
                }}
              >
                {message}
              </div>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}