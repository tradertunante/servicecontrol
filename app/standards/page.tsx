// app/standards/page.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { requireRoleOrRedirect } from "@/lib/auth/RequireRole";
import HotelHeader from "@/app/components/HotelHeader";
import BackButton from "@/app/components/BackButton";

const HOTEL_KEY = "sc_hotel_id";

type Profile = {
  id: string;
  role: string;
  hotel_id: string | null;
};

type Library = {
  id: string;
  name: string;
  category: string | null;
  scope: "global" | "hotel";
  hotel_id: string | null;
  active: boolean | null;
};

export default function StandardsPage() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [profile, setProfile] = useState<Profile | null>(null);
  const [hotelIdInUse, setHotelIdInUse] = useState<string | null>(null);

  const [globalLibraries, setGlobalLibraries] = useState<Library[]>([]);
  const [hotelLibraries, setHotelLibraries] = useState<Library[]>([]);

  const card: React.CSSProperties = {
    borderRadius: 18,
    border: "1px solid rgba(0,0,0,0.08)",
    background: "rgba(255,255,255,0.85)",
    padding: 20,
    boxShadow: "0 10px 30px rgba(0,0,0,0.06)",
  };

  const row: React.CSSProperties = {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "12px 14px",
    background: "rgba(0,0,0,0.02)",
    borderRadius: 12,
    border: "1px solid rgba(0,0,0,0.06)",
    gap: 12,
    flexWrap: "wrap",
  };

  const btn: React.CSSProperties = {
    padding: "10px 14px",
    borderRadius: 12,
    border: "1px solid rgba(0,0,0,0.2)",
    background: "#000",
    color: "#fff",
    fontWeight: 900,
    cursor: "pointer",
    fontSize: 14,
    whiteSpace: "nowrap",
  };

  const btnWhite: React.CSSProperties = {
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

  const subtitle: React.CSSProperties = {
    opacity: 0.75,
    fontSize: 13,
    marginTop: 6,
  };

  useEffect(() => {
    let alive = true;

    (async () => {
      setLoading(true);
      setError(null);

      try {
        // admin o superadmin
        const p = (await requireRoleOrRedirect(router, ["admin", "superadmin"], "/dashboard")) as Profile | null;
        if (!alive || !p) return;

        setProfile(p);

        // hotel en uso
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

        // cargar librerías globales y del hotel
        const { data, error: libErr } = await supabase
          .from("standard_libraries")
          .select("id, name, category, scope, hotel_id, active")
          .in("scope", ["global", "hotel"])
          .order("name", { ascending: true });

        if (libErr) throw libErr;

        const libs = (data ?? []) as Library[];

        setGlobalLibraries(libs.filter((l) => l.scope === "global" && (l.active ?? true)));
        setHotelLibraries(libs.filter((l) => l.scope === "hotel" && l.hotel_id === hotelIdToUse && (l.active ?? true)));

        setLoading(false);
      } catch (e: any) {
        setError(e?.message ?? "Error al cargar la biblioteca de estándares.");
        setLoading(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, [router]);

  const hotelBadge = useMemo(() => {
    if (!profile || profile.role !== "superadmin") return null;
    if (!hotelIdInUse) return null;

    return (
      <div style={{ marginBottom: 16, display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
        <span
          style={{
            padding: "6px 10px",
            borderRadius: 999,
            border: "1px solid rgba(0,0,0,0.12)",
            background: "rgba(0,0,0,0.04)",
            fontWeight: 900,
            fontSize: 12,
          }}
        >
          Hotel en uso: <strong>{localStorage.getItem(HOTEL_KEY) ? "Seleccionado" : "—"}</strong>
        </span>

        <span style={{ fontSize: 12, opacity: 0.7 }}>ID: {hotelIdInUse}</span>

        <button
          style={{
            padding: "8px 10px",
            borderRadius: 10,
            border: "1px solid rgba(0,0,0,0.15)",
            background: "#fff",
            fontWeight: 900,
            cursor: "pointer",
            fontSize: 12,
          }}
          onClick={() => {
            localStorage.removeItem(HOTEL_KEY);
            router.replace("/superadmin/hotels");
          }}
        >
          Cambiar hotel
        </button>
      </div>
    );
  }, [profile, hotelIdInUse, router]);

  const duplicateToHotel = async (libraryId: string) => {
    if (!hotelIdInUse) {
      alert("No hay hotel seleccionado.");
      return;
    }

    try {
      // RPC que ya creaste: clone_standard_library_to_hotel(p_library_id, p_target_hotel_id)
      const { data, error } = await supabase.rpc("clone_standard_library_to_hotel", {
        p_library_id: libraryId,
        p_target_hotel_id: hotelIdInUse,
      });

      if (error) throw error;

      alert("Duplicado correctamente.");
      // refrescar lista
      router.refresh();
      // o recargar libs:
      window.location.reload();
    } catch (e: any) {
      alert(e?.message ?? "No se pudo duplicar la biblioteca.");
    }
  };

  if (loading) {
    return (
      <main style={{ padding: 24, paddingTop: 80 }}>
        <HotelHeader />
        <BackButton fallback="/builder" />
        <div style={{ opacity: 0.8 }}>Cargando…</div>
      </main>
    );
  }

  if (error) {
    return (
      <main style={{ padding: 24, paddingTop: 80 }}>
        <HotelHeader />
        <BackButton fallback="/builder" />
        <div style={{ color: "crimson", fontWeight: 900 }}>{error}</div>
      </main>
    );
  }

  return (
    <main style={{ padding: 24, paddingTop: 80 }}>
      <HotelHeader />
      <BackButton fallback="/builder" />

      <div style={{ marginBottom: 14 }}>
        <div style={{ fontSize: 30, fontWeight: 950, letterSpacing: -0.3 }}>📚 Biblioteca de Estándares</div>
        <div style={{ opacity: 0.75, marginTop: 6 }}>Duplica estándares globales y crea auditorías importando plantillas.</div>
      </div>

      {hotelBadge}

      <div style={{ display: "grid", gap: 16 }}>
        {/* GLOBAL */}
        <div style={card}>
          <div style={{ fontSize: 18, fontWeight: 950, marginBottom: 12 }}>🌍 Estándares Globales</div>

          {globalLibraries.length === 0 ? (
            <div style={{ opacity: 0.7 }}>No hay estándares globales.</div>
          ) : (
            <div style={{ display: "grid", gap: 10 }}>
              {globalLibraries.map((lib) => (
                <div key={lib.id} style={row}>
                  <div style={{ minWidth: 260 }}>
                    <div style={{ fontWeight: 950 }}>{lib.name}</div>
                    <div style={subtitle}>Categoría: {lib.category ?? "—"}</div>
                  </div>

                  <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
                    <button style={btnWhite} onClick={() => router.push(`/standards/${lib.id}`)}>
                      Ver
                    </button>
                    <button style={btn} onClick={() => duplicateToHotel(lib.id)}>
                      Duplicar a mi hotel
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* HOTEL */}
        <div style={card}>
          <div style={{ fontSize: 18, fontWeight: 950, marginBottom: 12 }}>🏨 Estándares de Mi Hotel</div>

          {hotelLibraries.length === 0 ? (
            <div style={{ opacity: 0.7 }}>No hay estándares personalizados todavía.</div>
          ) : (
            <div style={{ display: "grid", gap: 10 }}>
              {hotelLibraries.map((lib) => (
                <div key={lib.id} style={row}>
                  <div style={{ minWidth: 260 }}>
                    <div style={{ fontWeight: 950 }}>{lib.name}</div>
                    <div style={subtitle}>Categoría: {lib.category ?? "—"}</div>
                  </div>

                  <button style={btnWhite} onClick={() => router.push(`/standards/${lib.id}`)}>
                    Ver
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
