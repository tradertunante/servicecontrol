"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

type Hotel = {
  id: string;
  name: string;
  active?: boolean | null;
  created_at?: string | null;
};

export default function SuperadminHotelsPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hotels, setHotels] = useState<Hotel[]>([]);
  const [activeHotelId, setActiveHotelId] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;

    (async () => {
      try {
        setLoading(true);
        setError(null);

        const { data: sess } = await supabase.auth.getSession();
        if (!sess.session) {
          router.replace("/login");
          return;
        }

        // Carga hoteles
        const { data, error } = await supabase
          .from("hotels")
          .select("id, name, active, created_at")
          .order("created_at", { ascending: true });

        if (error) throw error;

        if (!alive) return;

        setHotels((data ?? []) as Hotel[]);
        const saved = localStorage.getItem("sc_hotel_id");
        setActiveHotelId(saved);
      } catch (e: any) {
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

  return (
    <div style={{ padding: 24 }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center" }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 900, margin: 0 }}>Selector de hoteles</h1>
          <p style={{ marginTop: 6, opacity: 0.75 }}>
            Entra al dashboard del hotel que quieras administrar como superadmin.
          </p>
        </div>

        <button
          onClick={async () => {
            await supabase.auth.signOut();
            localStorage.removeItem("sc_hotel_id");
            router.replace("/login");
          }}
          style={{
            padding: "10px 12px",
            borderRadius: 10,
            border: "1px solid #ddd",
            background: "white",
            fontWeight: 800,
            cursor: "pointer",
          }}
        >
          Cerrar sesión
        </button>
      </div>

      {loading && <p style={{ marginTop: 18 }}>Cargando…</p>}

      {error && (
        <div
          style={{
            marginTop: 18,
            padding: 12,
            borderRadius: 10,
            background: "#fee",
            border: "1px solid #fcc",
            whiteSpace: "pre-wrap",
          }}
        >
          {error}
        </div>
      )}

      {!loading && !error && (
        <div style={{ marginTop: 18, display: "grid", gap: 12 }}>
          {hotels.length === 0 ? (
            <div style={{ padding: 14, border: "1px solid #eee", borderRadius: 12, background: "white" }}>
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
                    padding: 14,
                    borderRadius: 12,
                    border: isActive ? "2px solid #000" : "1px solid #eee",
                    background: "white",
                    cursor: "pointer",
                    display: "flex",
                    justifyContent: "space-between",
                    gap: 12,
                    alignItems: "center",
                  }}
                >
                  <div>
                    <div style={{ fontWeight: 900, fontSize: 16 }}>{h.name}</div>
                    <div style={{ opacity: 0.7, fontSize: 13 }}>ID: {h.id}</div>
                  </div>

                  <div style={{ fontWeight: 900, fontSize: 13, opacity: 0.8 }}>
                    {isActive ? "Seleccionado" : "Entrar"}
                  </div>
                </button>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}
