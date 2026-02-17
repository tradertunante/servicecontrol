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

    async function run() {
      setLoading(true);
      setError("");

      // ✅ 1) Espera corta a que la sesión esté lista (Safari / App Router)
      const start = Date.now();
      let session = null as any;

      while (Date.now() - start < 1500) {
        const { data } = await supabase.auth.getSession();
        session = data.session;
        if (session) break;
        await new Promise((r) => setTimeout(r, 120));
      }

      if (!alive) return;

      if (!session) {
        router.replace("/login");
        return;
      }

      // ✅ 2) Carga profile
      const { data: userData, error: userErr } = await supabase.auth.getUser();
      if (!alive) return;

      if (userErr || !userData?.user) {
        router.replace("/login");
        return;
      }

      const { data: prof, error: profErr } = await supabase
        .from("profiles")
        .select("id, full_name, role, hotel_id, active")
        .eq("id", userData.user.id)
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

      // ✅ 3) Redirección por rol (sin doble pantalla)
      if (profile.role === "superadmin") {
        router.replace("/superadmin/hotels");
        return;
      }

      if (profile.role === "auditor") {
        router.replace("/audits");
        return;
      }

      router.replace("/dashboard");
    }

    run();

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

  return null;
}
