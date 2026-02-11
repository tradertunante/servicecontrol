"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { normalizeRole, type Role } from "@/lib/auth/permissions";

type Profile = {
  id: string;
  full_name: string | null;
  role: Role;
  hotel_id: string | null;
  active?: boolean | null;
};

export default function AdminPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [profile, setProfile] = useState<Profile | null>(null);

  useEffect(() => {
    let alive = true;

    (async () => {
      const { data: authData, error: authErr } = await supabase.auth.getUser();
      if (!alive) return;

      if (authErr || !authData?.user) {
        router.replace("/login");
        return;
      }

      const { data: prof, error: profErr } = await supabase
        .from("profiles")
        .select("id, full_name, role, hotel_id, active")
        .eq("id", authData.user.id)
        .maybeSingle();

      if (!alive) return;

      if (profErr || !prof) {
        setError("No se pudo cargar el perfil.");
        setLoading(false);
        return;
      }

      if (prof.active === false) {
        setError("Tu usuario está inactivo.");
        setLoading(false);
        return;
      }

      const role = normalizeRole(prof.role);

      if (role !== "admin") {
        router.replace("/dashboard");
        return;
      }

      setProfile({
        id: prof.id,
        full_name: prof.full_name ?? null,
        role,
        hotel_id: prof.hotel_id ?? null,
        active: prof.active ?? null,
      });

      setLoading(false);
    })();

    return () => {
      alive = false;
    };
  }, [router]);

  async function logout() {
    await supabase.auth.signOut();
    router.replace("/login");
  }

  if (loading) {
    return (
      <main style={{ padding: 24 }}>
        <h1 style={{ fontSize: 28, fontWeight: 900 }}>Admin</h1>
        <p style={{ marginTop: 8, opacity: 0.7 }}>Cargando...</p>
      </main>
    );
  }

  if (error) {
    return (
      <main style={{ padding: 24 }}>
        <h1 style={{ fontSize: 28, fontWeight: 900 }}>Admin</h1>
        <p style={{ marginTop: 12, color: "crimson" }}>{error}</p>
        <button
          onClick={logout}
          style={{
            marginTop: 14,
            padding: "10px 14px",
            borderRadius: 12,
            border: "1px solid rgba(0,0,0,0.18)",
            background: "#fff",
            fontWeight: 900,
            cursor: "pointer",
          }}
        >
          Salir
        </button>
      </main>
    );
  }

  return (
    <main style={{ padding: 24 }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
        <div>
          <h1 style={{ fontSize: 30, fontWeight: 950, margin: 0 }}>Admin</h1>
          <p style={{ marginTop: 8, opacity: 0.75 }}>
            {profile?.full_name ? `Hola, ${profile.full_name}. ` : ""}Panel de administración.
          </p>
        </div>

        <button
          onClick={logout}
          style={{
            padding: "10px 14px",
            borderRadius: 12,
            border: "1px solid rgba(0,0,0,0.18)",
            background: "#fff",
            fontWeight: 900,
            cursor: "pointer",
          }}
        >
          Salir
        </button>
      </div>

      <div
        style={{
          marginTop: 16,
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
          gap: 14,
        }}
      >
        <button
          onClick={() => router.push("/dashboard")}
          style={{
            textAlign: "left",
            padding: 18,
            borderRadius: 16,
            border: "1px solid rgba(0,0,0,0.12)",
            background: "#fff",
            boxShadow: "0 6px 24px rgba(0,0,0,0.06)",
            cursor: "pointer",
          }}
        >
          <div style={{ fontSize: 18, fontWeight: 900 }}>Dashboard</div>
          <div style={{ marginTop: 6, opacity: 0.75, fontSize: 14 }}>Volver al dashboard general.</div>
        </button>

        <button
          onClick={() => router.push("/builder")}
          style={{
            textAlign: "left",
            padding: 18,
            borderRadius: 16,
            border: "1px solid rgba(0,0,0,0.12)",
            background: "#fff",
            boxShadow: "0 6px 24px rgba(0,0,0,0.06)",
            cursor: "pointer",
          }}
        >
          <div style={{ fontSize: 18, fontWeight: 900 }}>Builder</div>
          <div style={{ marginTop: 6, opacity: 0.75, fontSize: 14 }}>Crear y editar auditorías.</div>
        </button>

        <button
          onClick={() => router.push("/users")}
          style={{
            textAlign: "left",
            padding: 18,
            borderRadius: 16,
            border: "1px solid rgba(0,0,0,0.12)",
            background: "#fff",
            boxShadow: "0 6px 24px rgba(0,0,0,0.06)",
            cursor: "pointer",
          }}
        >
          <div style={{ fontSize: 18, fontWeight: 900 }}>Usuarios</div>
          <div style={{ marginTop: 6, opacity: 0.75, fontSize: 14 }}>Gestionar usuarios del hotel.</div>
        </button>
      </div>
    </main>
  );
}