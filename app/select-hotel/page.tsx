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

type HotelRow = {
  id: string;
  name: string;
  created_at?: string | null;
};

export default function SelectHotelPage() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [profile, setProfile] = useState<Profile | null>(null);
  const [hotels, setHotels] = useState<HotelRow[]>([]);

  useEffect(() => {
    let alive = true;

    (async () => {
      setLoading(true);
      setError(null);

      try {
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

        if (profErr || !prof) throw new Error("No se pudo cargar el perfil.");
        if (prof.active === false) throw new Error("Tu usuario está inactivo.");

        const role = normalizeRole(prof.role);

        const p: Profile = {
          id: prof.id,
          full_name: prof.full_name ?? null,
          role,
          hotel_id: prof.hotel_id ?? null,
          active: prof.active ?? null,
        };

        setProfile(p);

        // Solo superadmin puede estar aquí
        if (p.role !== "superadmin") {
          router.replace("/dashboard");
          return;
        }

        // Lista de hoteles
        const { data: hotelsData, error: hotelsErr } = await supabase
          .from("hotels")
          .select("id,name,created_at")
          .order("created_at", { ascending: false });

        if (hotelsErr) throw hotelsErr;

        setHotels((hotelsData ?? []) as HotelRow[]);
        setLoading(false);
      } catch (e: any) {
        setError(e?.message ?? "Error cargando hoteles.");
        setLoading(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, [router]);

  const card: React.CSSProperties = {
    borderRadius: 18,
    border: "1px solid rgba(0,0,0,0.08)",
    background: "rgba(255,255,255,0.92)",
    padding: 18,
    boxShadow: "0 10px 30px rgba(0,0,0,0.06)",
  };

  if (loading) {
    return (
      <main style={{ padding: 24 }}>
        <h1 style={{ fontSize: 28, fontWeight: 950 }}>Selecciona un hotel</h1>
        <div style={{ marginTop: 10, opacity: 0.7 }}>Cargando…</div>
      </main>
    );
  }

  if (error) {
    return (
      <main style={{ padding: 24 }}>
        <h1 style={{ fontSize: 28, fontWeight: 950 }}>Selecciona un hotel</h1>
        <div style={{ marginTop: 10, color: "crimson", fontWeight: 900 }}>{error}</div>
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
      <div style={{ marginBottom: 14, display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
        <div>
          <h1 style={{ fontSize: 28, fontWeight: 950, margin: 0 }}>Selecciona un hotel</h1>
          <div style={{ marginTop: 6, opacity: 0.75 }}>
            Hola{profile?.full_name ? `, ${profile.full_name}` : ""}. Rol: <strong>{profile?.role}</strong>
          </div>
        </div>

        <button
          onClick={async () => {
            await supabase.auth.signOut();
            router.replace("/login");
          }}
          style={{
            padding: "10px 14px",
            borderRadius: 12,
            border: "1px solid rgba(0,0,0,0.15)",
            background: "#fff",
            fontWeight: 900,
            cursor: "pointer",
            whiteSpace: "nowrap",
          }}
        >
          Cerrar sesión
        </button>
      </div>

      <div style={{ display: "grid", gap: 12 }}>
        {hotels.map((h) => (
          <button
            key={h.id}
            onClick={() => {
              // guardamos el hotel seleccionado
              localStorage.setItem("sc_selected_hotel_id", h.id);
              localStorage.setItem("sc_selected_hotel_name", h.name);

              // Entramos al dashboard del hotel seleccionado
              router.replace(`/dashboard?hotel=${h.id}`);
            }}
            style={{
              ...card,
              cursor: "pointer",
              textAlign: "left",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              gap: 12,
            }}
          >
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 18, fontWeight: 950, overflow: "hidden", textOverflow: "ellipsis" }}>{h.name}</div>
              <div style={{ marginTop: 6, opacity: 0.65, fontSize: 13 }}>ID: {h.id}</div>
            </div>

            <div style={{ fontWeight: 950 }}>Entrar →</div>
          </button>
        ))}
        {hotels.length === 0 && <div style={{ opacity: 0.75 }}>No hay hoteles creados todavía.</div>}
      </div>
    </main>
  );
}
