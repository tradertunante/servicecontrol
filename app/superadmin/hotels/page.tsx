"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { requireRoleOrRedirect, type Profile as LoadedProfile } from "@/lib/auth/RequireRole";
import type { Role } from "@/lib/auth/permissions";

type Hotel = {
  id: string;
  name: string;
  active?: boolean | null;
  created_at?: string | null;
};

export default function SuperadminHotelsPage() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>("");
  const [profile, setProfile] = useState<LoadedProfile | null>(null);
  const [hotels, setHotels] = useState<Hotel[]>([]);
  const [activeHotelId, setActiveHotelId] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;

    (async () => {
      try {
        setLoading(true);
        setError("");

        const allowed: Role[] = ["superadmin"];
        const p = await requireRoleOrRedirect(router, allowed, "/login");
        if (!alive || !p) return;

        setProfile(p);

        const { data, error: hotelsErr } = await supabase
          .from("hotels")
          .select("id, name, active, created_at")
          .order("created_at", { ascending: true });

        if (hotelsErr) throw hotelsErr;
        if (!alive) return;

        setHotels((data ?? []) as Hotel[]);

        const saved = localStorage.getItem("sc_hotel_id");
        setActiveHotelId(saved);
      } catch (e: any) {
        if (!alive) return;
        setError(e?.message ?? "Error cargando hoteles.");
      } finally {
        if (alive) setLoading(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, [router]);

  const pickHotel = (hotelId: string) => {
    localStorage.setItem("sc_hotel_id", hotelId);
    setActiveHotelId(hotelId);
    router.replace("/dashboard");
  };

  const logout = async () => {
    await supabase.auth.signOut();
    localStorage.removeItem("sc_hotel_id");
    router.replace("/login");
  };

  return (
    <main style={{ padding: 24 }}>
      {/* Header */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          gap: 12,
          alignItems: "center",
        }}
      >
        <div>
          <div style={{ fontSize: 28, fontWeight: 900 }}>
            Elegir hotel
          </div>
          <div style={{ opacity: 0.7, marginTop: 6 }}>
            {profile?.full_name ?? "Superadmin"} · Superadmin
          </div>
        </div>

        <button
          onClick={logout}
          style={{
            padding: "10px 14px",
            borderRadius: 12,
            border: "1px solid rgba(255,255,255,0.2)",
            background: "#1f1f1f",
            color: "#fff",
            fontWeight: 700,
            cursor: "pointer",
          }}
        >
          Cerrar sesión
        </button>
      </div>

      {/* Loading */}
      {loading && <p style={{ marginTop: 20 }}>Cargando…</p>}

      {/* Error */}
      {!!error && (
        <div
          style={{
            marginTop: 20,
            padding: 12,
            borderRadius: 12,
            background: "#2a0000",
            border: "1px solid #550000",
            color: "#ffaaaa",
          }}
        >
          {error}
        </div>
      )}

      {/* Hotels */}
      {!loading && !error && (
        <div style={{ marginTop: 24, display: "grid", gap: 16 }}>
          {hotels.length === 0 ? (
            <div
              style={{
                padding: 16,
                border: "1px solid #333",
                borderRadius: 12,
                background: "#1a1a1a",
              }}
            >
              No hay hoteles creados aún.
            </div>
          ) : (
            hotels.map((h) => {
              const isActive = activeHotelId === h.id;

              return (
                <button
                  key={h.id}
                  onClick={() => pickHotel(h.id)}
                  style={{
                    textAlign: "left",
                    padding: 16,
                    borderRadius: 16,
                    border: isActive
                      ? "2px solid #000"
                      : "1px solid #ddd",
                    background: "#ffffff",
                    color: "#111111",   // ✅ CLAVE para que no sea blanco sobre blanco
                    cursor: "pointer",
                    display: "flex",
                    justifyContent: "space-between",
                    gap: 12,
                    alignItems: "center",
                  }}
                >
                  <div>
                    <div
                      style={{
                        fontWeight: 800,
                        fontSize: 16,
                        marginBottom: 4,
                      }}
                    >
                      {h.name}
                    </div>
                    <div style={{ fontSize: 13, opacity: 0.6 }}>
                      ID: {h.id}
                    </div>
                  </div>

                  <div style={{ fontWeight: 700, fontSize: 13 }}>
                    {isActive ? "Seleccionado" : "Entrar"}
                  </div>
                </button>
              );
            })
          )}
        </div>
      )}
    </main>
  );
}
