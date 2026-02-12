"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { requireRoleOrRedirect } from "@/lib/auth/RequireRole";

type Role = "admin" | "manager" | "auditor";

type Profile = {
  id: string;
  full_name?: string | null;
  role: Role;
  hotel_id: string | null;
  active?: boolean | null;
};

export default function ProfilePage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [error, setError] = useState<string | null>(null);

  const card: React.CSSProperties = {
    borderRadius: 18,
    border: "1px solid rgba(0,0,0,0.08)",
    background: "rgba(255,255,255,0.75)",
    padding: 18,
    boxShadow: "0 10px 30px rgba(0,0,0,0.06)",
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

  useEffect(() => {
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const p = await requireRoleOrRedirect(router, ["admin", "manager", "auditor"], "/login");
        if (!p) return;
        setProfile(p);
      } catch (e: any) {
        setError(e?.message ?? "No se pudo cargar el perfil.");
      } finally {
        setLoading(false);
      }
    })();
  }, [router]);

  async function logout() {
    await supabase.auth.signOut();
    router.replace("/login");
  }

  if (loading) {
    return (
      <main style={{ padding: 24 }}>
        <h1 style={{ fontSize: 56, marginBottom: 6 }}>Perfil</h1>
        <div style={{ opacity: 0.8 }}>Cargando…</div>
      </main>
    );
  }

  if (error) {
    return (
      <main style={{ padding: 24 }}>
        <h1 style={{ fontSize: 56, marginBottom: 6 }}>Perfil</h1>
        <div style={{ color: "crimson", fontWeight: 900 }}>{error}</div>

        <div style={{ marginTop: 14, display: "flex", gap: 10, flexWrap: "wrap" }}>
          <button onClick={() => router.back()} style={btnWhite}>
            Volver
          </button>
          <button onClick={logout} style={btnBlack}>
            Cerrar sesión
          </button>
        </div>
      </main>
    );
  }

  return (
    <main style={{ padding: 24 }}>
      {/* Contenedor: empuja el logout al final real de la pantalla */}
      <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column" }}>
        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
          <div>
            <h1 style={{ fontSize: 56, marginBottom: 6 }}>Perfil</h1>
            <div style={{ opacity: 0.85, fontWeight: 800 }}>
              {profile?.full_name ? profile.full_name : "Usuario"} · Rol: <strong>{profile?.role}</strong>
            </div>
          </div>

          {/* Un botón discreto para volver (no era requisito, pero es útil y no molesta).
              Si NO lo quieres, bórralo y ya. */}
          <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
            <button onClick={() => router.push("/dashboard")} style={btnWhite}>
              Volver
            </button>
          </div>
        </div>

        {/* Contenido */}
        <div style={{ marginTop: 14, display: "grid", gap: 14 }}>
          <div style={card}>
            <div style={{ fontWeight: 950, marginBottom: 10 }}>Configuración</div>
            <div style={{ opacity: 0.75 }}>Aquí configuraremos preferencias, notificaciones, etc.</div>
          </div>
        </div>

        {/* Footer: abajo del todo */}
        <div style={{ marginTop: "auto", paddingTop: 18, display: "flex", justifyContent: "flex-end" }}>
          <button onClick={logout} style={btnBlack}>
            Cerrar sesión
          </button>
        </div>
      </div>
    </main>
  );
}
