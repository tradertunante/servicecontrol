"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { requireRoleOrRedirect, type Profile as LoadedProfile } from "@/lib/auth/RequireRole";
import type { Role } from "@/lib/auth/permissions";

export default function ProfilePage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<LoadedProfile | null>(null);
  const [error, setError] = useState<string>("");

  useEffect(() => {
    let alive = true;

    (async () => {
      try {
        setLoading(true);
        setError("");

        const allowed: Role[] = ["superadmin", "admin", "manager", "auditor"];

        const p = await requireRoleOrRedirect(router, allowed, "/login");
        if (!alive) return;

        if (!p) return;

        setProfile(p);
      } catch (e: any) {
        if (!alive) return;
        setError(e?.message ?? "No se pudo cargar el perfil.");
      } finally {
        if (alive) setLoading(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, [router]);

  if (loading) {
    return (
      <main style={{ padding: 24 }}>
        <h1 style={{ fontSize: 28, fontWeight: 900 }}>Perfil</h1>
        <p style={{ opacity: 0.7, marginTop: 8 }}>Cargando…</p>
      </main>
    );
  }

  if (error) {
    return (
      <main style={{ padding: 24 }}>
        <h1 style={{ fontSize: 28, fontWeight: 900 }}>Perfil</h1>
        <p style={{ color: "crimson", marginTop: 12 }}>{error}</p>
        <button
          onClick={async () => {
            await supabase.auth.signOut();
            router.replace("/login");
          }}
          style={{
            marginTop: 14,
            padding: "10px 14px",
            borderRadius: 12,
            border: "1px solid rgba(0,0,0,0.15)",
            background: "#fff",
            fontWeight: 900,
            cursor: "pointer",
          }}
        >
          Volver a login
        </button>
      </main>
    );
  }

  if (!profile) {
    return (
      <main style={{ padding: 24 }}>
        <h1 style={{ fontSize: 28, fontWeight: 900 }}>Perfil</h1>
        <p style={{ opacity: 0.7, marginTop: 8 }}>Sin datos.</p>
      </main>
    );
  }

  return (
    <main style={{ padding: 24 }}>
      <h1 style={{ fontSize: 28, fontWeight: 900 }}>Perfil</h1>

      <div style={{ marginTop: 16, padding: 14, border: "1px solid #eee", borderRadius: 12, background: "#fff" }}>
        <div style={{ fontWeight: 900, fontSize: 16 }}>{profile.full_name ?? "Sin nombre"}</div>
        <div style={{ marginTop: 6, opacity: 0.8 }}>Rol: {profile.role}</div>
        <div style={{ marginTop: 6, opacity: 0.8 }}>Hotel ID: {profile.hotel_id ?? "—"}</div>
      </div>
    </main>
  );
}
