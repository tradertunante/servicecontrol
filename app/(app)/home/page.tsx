// FILE: app/(app)/home/page.tsx
"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

const HOTEL_KEY = "sc_hotel_id";

type ProfileRow = {
  id: string;
  role: string | null;
  hotel_id?: string | null;
};

export default function HomeRedirectPage() {
  const router = useRouter();
  const [message, setMessage] = useState("Preparando tu sesión…");

  useEffect(() => {
    let cancelled = false;

    async function boot() {
      try {
        setMessage("Validando sesión…");

        const { data: authData, error: authErr } = await supabase.auth.getUser();

        if (authErr || !authData.user) {
          router.replace("/login");
          return;
        }

        const uid = authData.user.id;

        setMessage("Cargando perfil…");

        const { data: profile, error: profileErr } = await supabase
          .from("profiles")
          .select("id, role, hotel_id")
          .eq("id", uid)
          .single();

        if (profileErr || !profile) {
          router.replace("/login");
          return;
        }

        const p = profile as ProfileRow;
        const role = p.role ?? "";

        let resolvedHotelId = p.hotel_id ?? null;

        // Fallback: si el perfil no trae hotel_id, intenta encontrar uno por acceso de área
        if (!resolvedHotelId) {
          setMessage("Buscando hotel asignado…");

          const accessResp = await supabase
            .from("user_area_access")
            .select("hotel_id")
            .eq("user_id", uid)
            .limit(1)
            .maybeSingle();

          if (!accessResp.error) {
            resolvedHotelId = (accessResp.data as any)?.hotel_id ?? null;
          }
        }

        // Guardar hotel en localStorage si existe
        if (typeof window !== "undefined") {
          if (resolvedHotelId) {
            localStorage.setItem(HOTEL_KEY, resolvedHotelId);
          } else {
            localStorage.removeItem(HOTEL_KEY);
          }
        }

        if (cancelled) return;

        setMessage("Redirigiendo…");

        switch (role) {
          case "superadmin":
            router.replace("/superadmin");
            return;

          case "admin":
          case "quality":
            router.replace("/dashboard");
            return;

          case "manager":
            router.replace("/team");
            return;

          case "auditor":
            router.replace("/my");
            return;

          default:
            router.replace("/dashboard");
            return;
        }
      } catch {
        if (!cancelled) {
          router.replace("/login");
        }
      }
    }

    boot();

    return () => {
      cancelled = true;
    };
  }, [router]);

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "grid",
        placeItems: "center",
        padding: 24,
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: 520,
          border: "1px solid rgba(255,255,255,0.10)",
          borderRadius: 18,
          padding: 24,
          background: "rgba(255,255,255,0.04)",
          boxShadow: "0 10px 30px rgba(0,0,0,0.18)",
          textAlign: "center",
        }}
      >
        <div style={{ fontSize: 28, fontWeight: 900 }}>ServiceControl</div>
        <div style={{ opacity: 0.8, marginTop: 10 }}>{message}</div>
      </div>
    </div>
  );
}