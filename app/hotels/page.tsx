"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { requireRoleOrRedirect, type Profile } from "@/lib/auth/RequireRole";

type HotelRow = { id: string; name: string; created_at: string | null };

const STORAGE_KEY = "sc_selected_hotel_id";

export default function HotelsSelectPage() {
  const router = useRouter();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [hotels, setHotels] = useState<HotelRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      setLoading(true);
      setError(null);

      try {
        const p = await requireRoleOrRedirect(router, ["superadmin"], "/login");
        if (!p) return;
        setProfile(p);

        const { data, error: hErr } = await supabase
          .from("hotels")
          .select("id,name,created_at")
          .order("created_at", { ascending: false });

        if (hErr) throw hErr;
        setHotels((data ?? []) as HotelRow[]);
        setLoading(false);
      } catch (e: any) {
        setError(e?.message ?? "No se pudo cargar hoteles.");
        setLoading(false);
      }
    })();
  }, [router]);

  const pickHotel = (hotelId: string) => {
    localStorage.setItem(STORAGE_KEY, hotelId);
    router.replace("/dashboard");
  };

  if (loading) {
    return <main style={{ padding: 24, paddingTop: 80 }}>Cargando…</main>;
  }

  if (error) {
    return (
      <main style={{ padding: 24, paddingTop: 80 }}>
        <div style={{ color: "crimson", fontWeight: 900 }}>{error}</div>
      </main>
    );
  }

  return (
    <main style={{ padding: 24, paddingTop: 80 }}>
      <div style={{ fontSize: 28, fontWeight: 950 }}>Elegir hotel</div>
      <div style={{ opacity: 0.7, marginTop: 6 }}>
        {profile?.full_name ?? profile?.email} · Superadmin
      </div>

      <div style={{ marginTop: 18, display: "grid", gap: 12 }}>
        {hotels.map((h) => (
          <button
            key={h.id}
            onClick={() => pickHotel(h.id)}
            style={{
              textAlign: "left",
              padding: 16,
              borderRadius: 14,
              border: "1px solid rgba(0,0,0,0.12)",
              background: "#fff",
              cursor: "pointer",
              boxShadow: "0 4px 16px rgba(0,0,0,0.06)",
            }}
          >
            <div style={{ fontSize: 16, fontWeight: 900 }}>{h.name}</div>
            <div style={{ opacity: 0.65, marginTop: 4, fontSize: 12 }}>{h.id}</div>
          </button>
        ))}
      </div>
    </main>
  );
}
