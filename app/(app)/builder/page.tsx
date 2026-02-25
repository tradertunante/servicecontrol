// app/builder/page.tsx
"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { requireRoleOrRedirect } from "@/lib/auth/RequireRole";
import HotelHeader from "@/app/components/HotelHeader";
import BuilderEmbedded from "@/app/components/BuilderEmbedded";

const HOTEL_KEY = "sc_hotel_id";

type Profile = {
  id: string;
  full_name?: string | null;
  role: string;
  hotel_id: string | null;
};

export default function BuilderPage() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [profile, setProfile] = useState<Profile | null>(null);
  const [hotelIdInUse, setHotelIdInUse] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;

    (async () => {
      setLoading(true);
      setError(null);

      try {
        const p = (await requireRoleOrRedirect(router, ["admin", "superadmin"], "/dashboard")) as Profile | null;
        if (!alive || !p) return;

        setProfile(p);

        let hotelIdToUse: string | null = null;

        if (p.role === "superadmin") {
          hotelIdToUse = typeof window !== "undefined" ? localStorage.getItem(HOTEL_KEY) : null;
          if (!hotelIdToUse) {
            router.replace("/superadmin/hotels");
            return;
          }
        } else {
          hotelIdToUse = p.hotel_id;
          if (!hotelIdToUse) {
            setError("No tienes un hotel asignado.");
            setLoading(false);
            return;
          }
        }

        setHotelIdInUse(hotelIdToUse);
        setLoading(false);
      } catch (e: any) {
        setError(e?.message ?? "Error al cargar el builder.");
        setLoading(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, [router]);

  if (loading) {
    return (
      <main style={{ padding: 24, paddingTop: 96 }}>
        <HotelHeader />
        <div style={{ opacity: 0.8 }}>Cargando…</div>
      </main>
    );
  }

  if (error) {
    return (
      <main style={{ padding: 24, paddingTop: 96 }}>
        <HotelHeader />
        <div style={{ color: "crimson", fontWeight: 900 }}>{error}</div>
      </main>
    );
  }

  if (!hotelIdInUse) {
    return (
      <main style={{ padding: 24, paddingTop: 96 }}>
        <HotelHeader />
        <div style={{ color: "crimson", fontWeight: 900 }}>No hay hotel seleccionado.</div>
      </main>
    );
  }

  return (
    <main style={{ padding: 24, paddingTop: 96 }}>
      <HotelHeader />

      <BuilderEmbedded
        hotelIdInUse={hotelIdInUse}
        greetingName={profile?.full_name ?? null}
        showStandardsCard={true}
        rightActions={
          <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
            <button
              style={{
                padding: "10px 14px",
                borderRadius: 12,
                border: "1px solid rgba(0,0,0,0.2)",
                background: "#fff",
                color: "#000",
                fontWeight: 900,
                cursor: "pointer",
                fontSize: 14,
                whiteSpace: "nowrap",
              }}
              onClick={() => router.push("/areas/order")}
            >
              Ordenar áreas
            </button>

            <button
              style={{
                padding: "10px 14px",
                borderRadius: 12,
                border: "1px solid rgba(0,0,0,0.2)",
                background: "#fff",
                color: "#000",
                fontWeight: 900,
                cursor: "pointer",
                fontSize: 14,
                whiteSpace: "nowrap",
              }}
              onClick={() => router.push("/dashboard")}
            >
              ← Atrás
            </button>
          </div>
        }
      />
    </main>
  );
}