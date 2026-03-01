"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { requireRoleOrRedirect } from "@/lib/auth/RequireRole";
import BuilderEmbedded from "@/app/components/BuilderEmbedded";

const HOTEL_KEY = "sc_hotel_id";

type Profile = {
  id: string;
  full_name?: string | null;
  role: string;
  hotel_id: string | null;
};

export default function BuilderShell({
  hotelId,
  embedded = false,
  showBackToDashboard = true,
}: {
  hotelId?: string | null; // ✅ si lo pasas (desde Panel), no hace falta leer localStorage ni nada
  embedded?: boolean; // ✅ si está embebido, evitamos paddings grandes y “Header”
  showBackToDashboard?: boolean; // ✅ en Panel normalmente lo pondrás false
}) {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [profile, setProfile] = useState<Profile | null>(null);
  const [hotelIdInUse, setHotelIdInUse] = useState<string | null>(hotelId ?? null);

  useEffect(() => {
    let alive = true;

    // ✅ Si ya viene el hotelId desde el Panel, no necesitamos cargar nada extra salvo el profile (nombre)
    // pero igualmente validamos roles.
    (async () => {
      setLoading(true);
      setError(null);

      try {
        const p = (await requireRoleOrRedirect(router, ["admin", "superadmin"], "/dashboard")) as Profile | null;
        if (!alive || !p) return;

        setProfile(p);

        // ✅ Si viene hotelId por props (Panel de control), úsalo tal cual.
        if (hotelId) {
          setHotelIdInUse(hotelId);
          setLoading(false);
          return;
        }

        // ✅ Si no viene, usamos la lógica original de tu page:
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
  }, [router, hotelId]);

  // ✅ Layout: embebido vs página
  const containerStyle: React.CSSProperties = embedded
    ? { width: "100%" }
    : { padding: 24, paddingTop: 96 };

  if (loading) {
    return (
      <div style={containerStyle}>
        <div style={{ opacity: 0.8 }}>Cargando…</div>
      </div>
    );
  }

  if (error) {
    return (
      <div style={containerStyle}>
        <div style={{ color: "crimson", fontWeight: 900 }}>{error}</div>
      </div>
    );
  }

  if (!hotelIdInUse) {
    return (
      <div style={containerStyle}>
        <div style={{ color: "crimson", fontWeight: 900 }}>No hay hotel seleccionado.</div>
      </div>
    );
  }

  return (
    <div style={containerStyle}>
      <BuilderEmbedded
        hotelIdInUse={hotelIdInUse}
        greetingName={profile?.full_name ?? null}
        showStandardsCard={true}
        rightActions={
          <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
            <button
              style={btnStyle}
              onClick={() => router.push("/areas/order")}
            >
              Ordenar áreas
            </button>

            {showBackToDashboard && !embedded && (
              <button style={btnStyle} onClick={() => router.push("/dashboard")}>
                ← Atrás
              </button>
            )}
          </div>
        }
      />
    </div>
  );
}

const btnStyle: React.CSSProperties = {
  padding: "10px 14px",
  borderRadius: 12,
  border: "1px solid rgba(0,0,0,0.2)",
  background: "#fff",
  color: "#000",
  fontWeight: 900,
  cursor: "pointer",
  fontSize: 14,
  whiteSpace: "nowrap",
};