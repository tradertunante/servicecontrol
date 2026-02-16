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

      // ✅ Usa getSession (más fiable) en vez de getUser
      const { data: sessionData, error: sessionErr } =
        await supabase.auth.getSession();
      if (!alive) return;

      const user = sessionData?.session?.user;

      if (sessionErr || !user) {
        router.replace("/login");
        return;
      }

      // Cargar perfil
      const { data: prof, error: profErr } = await supabase
        .from("profiles")
        .select("id, full_name, role, hotel_id, active, email")
        .eq("id", user.id)
        .maybeSingle();

      if (!alive) return;

      if (profErr) {
        setError(`No se pudo cargar el perfil: ${profErr.message}`);
        setLoading(false);
        return;
      }

      if (!prof) {
        setError(
          "No se encontró tu perfil en la tabla profiles. " +
            "Hay que crearlo (registro/onboarding) o revisar el flujo de alta."
        );
        setLoading(false);
        return;
      }

      if (prof.active === false) {
        setError("Tu usuario está inactivo.");
        setLoading(false);
        return;
      }

      // Normaliza role por si viene raro (aunque ahora redirigimos siempre)
      const role = normalizeRole(prof.role);

      const profile: Profile = {
        id: prof.id,
        full_name: prof.full_name ?? null,
        role,
        hotel_id: prof.hotel_id ?? null,
        active: prof.active ?? null,
      };

      // Guarda hotel actual si existe
      if (profile.hotel_id) {
        try {
          localStorage.setItem("currentHotelId", profile.hotel_id);
        } catch {}
      }

      // ✅ Por ahora todo el mundo va a dashboard
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
        <h1 style={{ fontSize: 28, fontWeight: 800 }}>ServiceControl</h1>
        <p style={{ opacity: 0.7, marginTop: 8 }}>Cargando...</p>
      </main>
    );
  }

  if (error) {
    return (
      <main style={{ padding: 24 }}>
        <h1 style={{ fontSize: 28, fontWeight: 800 }}>ServiceControl</h1>
        <p style={{ color: "crimson", marginTop: 12, whiteSpace: "pre-wrap" }}>
          {error}
        </p>

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
            fontWeight: 800,
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
      <h1 style={{ fontSize: 28, fontWeight: 800 }}>ServiceControl</h1>
      <p style={{ opacity: 0.7, marginTop: 8 }}>Redirigiendo...</p>
    </main>
  );
}
