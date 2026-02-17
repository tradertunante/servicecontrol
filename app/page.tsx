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

export default function HomePage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>("");

  useEffect(() => {
    let alive = true;

    async function load() {
      setLoading(true);
      setError("");

      // ✅ 1) Session local (evita bucle por timing/red)
      const { data: sessData } = await supabase.auth.getSession();
      if (!alive) return;

      if (!sessData.session) {
        router.replace("/login");
        return;
      }

      // ✅ 2) Ya hay sesión: ahora sí user + profile
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
        setError("No se pudo cargar el perfil (profiles).");
        setLoading(false);
        return;
      }

      if (prof.active === false) {
        setError("Tu usuario está inactivo.");
        setLoading(false);
        return;
      }

      const role = normalizeRole(prof.role);

      const profile: Profile = {
        id: prof.id,
        full_name: prof.full_name ?? null,
        role,
        hotel_id: prof.hotel_id ?? null,
        active: prof.active ?? null,
      };

      // ✅ Rutas por rol
      if (profile.role === "superadmin") {
        router.replace("/select-hotel");
        return;
      }

      if (profile.role === "auditor") {
        router.replace("/audits");
        return;
      }

      router.replace("/dashboard");
    }

    load();

    return () => {
      alive = false;
    };
  }, [router]);

  if (loading) {
    return (
      <main style={{ padding: 24 }}>
        <h1 style={{ fontSize: 28, fontWeight: 900 }}>ServiceControl</h1>
        <p style={{ opacity: 0.7, marginTop: 8 }}>Cargando…</p>
      </main>
    );
  }

  if (error) {
    return (
      <main style={{ padding: 24 }}>
        <h1 style={{ fontSize: 28, fontWeight: 900 }}>ServiceControl</h1>
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

  return (
    <main style={{ padding: 24 }}>
      <h1 style={{ fontSize: 28, fontWeight: 900 }}>ServiceControl</h1>
      <p style={{ opacity: 0.7, marginTop: 8 }}>Redirigiendo…</p>
    </main>
  );
}
