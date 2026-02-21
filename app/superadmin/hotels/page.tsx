// FILE: app/superadmin/hotels/page.tsx
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

const HOTEL_KEY = "sc_hotel_id";

export default function SuperadminHotelsPage() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string>("");
  const [profile, setProfile] = useState<LoadedProfile | null>(null);
  const [hotels, setHotels] = useState<Hotel[]>([]);
  const [activeHotelId, setActiveHotelId] = useState<string | null>(null);

  const fg = "var(--text)";
  const bg = "var(--bg)";
  const cardBg = "var(--card-bg)";
  const border = "var(--border)";
  const shadowSm = "var(--shadow-sm)";
  const inputBg = "var(--input-bg)";
  const inputBorder = "var(--input-border)";

  const pill = (on: boolean) =>
    ({
      display: "inline-flex",
      alignItems: "center",
      gap: 8,
      padding: "6px 10px",
      borderRadius: 999,
      border: `1px solid ${border}`,
      background: on ? "rgba(15, 118, 110, 0.10)" : "rgba(198, 40, 40, 0.10)",
      color: on ? "var(--ok, #0f766e)" : "var(--danger, #c62828)",
      fontWeight: 950,
      fontSize: 12,
      whiteSpace: "nowrap",
    } as React.CSSProperties);

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

        const list = (data ?? []) as Hotel[];
        setHotels(list);

        const saved = localStorage.getItem(HOTEL_KEY);
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
    localStorage.setItem(HOTEL_KEY, hotelId);
    setActiveHotelId(hotelId);
    router.replace("/dashboard");
  };

  const logout = async () => {
    await supabase.auth.signOut();
    localStorage.removeItem(HOTEL_KEY);
    router.replace("/login");
  };

  const createHotel = async () => {
    const name = window.prompt("Nombre del hotel (ej: Eurostar Gran Central)");
    if (!name?.trim()) return;

    setLoading(true);
    setError("");

    try {
      const { data, error: insErr } = await supabase
        .from("hotels")
        .insert([{ name: name.trim(), active: true }])
        .select("id, name, active, created_at");

      if (insErr) throw insErr;

      const created = (data ?? []) as Hotel[];
      setHotels((prev) => [...prev, ...created]);
      setLoading(false);
    } catch (e: any) {
      setError(e?.message ?? "No se pudo crear el hotel.");
      setLoading(false);
    }
  };

  const toggleHotelActive = async (hotelId: string, nextActive: boolean) => {
    setBusyId(hotelId);
    setError("");

    try {
      const { data, error: updErr } = await supabase
        .from("hotels")
        .update({ active: nextActive })
        .eq("id", hotelId)
        .select("id, name, active, created_at")
        .single();

      if (updErr) throw updErr;

      setHotels((prev) =>
        prev.map((h) => (h.id === hotelId ? ({ ...h, ...(data as Hotel) } as Hotel) : h))
      );

      if (!nextActive && activeHotelId === hotelId) {
        localStorage.removeItem(HOTEL_KEY);
        setActiveHotelId(null);
      }
    } catch (e: any) {
      setError(e?.message ?? "No se pudo actualizar el estado del hotel.");
    } finally {
      setBusyId(null);
    }
  };

  return (
    <main style={{ padding: 24, background: bg, color: fg, minHeight: "100vh" }}>
      {/* Header */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          gap: 12,
          alignItems: "center",
          flexWrap: "wrap",
        }}
      >
        <div>
          <div style={{ fontSize: 28, fontWeight: 950 }}>Hoteles</div>
          <div style={{ opacity: 0.7, marginTop: 6 }}>
            {profile?.full_name ?? "Superadmin"} · Superadmin
          </div>
        </div>

        <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
          <button
            onClick={() => router.push("/superadmin")}
            style={{
              padding: "10px 14px",
              borderRadius: 12,
              border: `1px solid ${inputBorder}`,
              background: inputBg,
              color: fg,
              fontWeight: 950,
              cursor: "pointer",
              boxShadow: shadowSm,
              whiteSpace: "nowrap",
            }}
          >
            ← Atrás
          </button>

          <button
            onClick={createHotel}
            style={{
              padding: "10px 14px",
              borderRadius: 12,
              border: `1px solid ${inputBorder}`,
              background: inputBg,
              color: fg,
              fontWeight: 950,
              cursor: "pointer",
              boxShadow: shadowSm,
              whiteSpace: "nowrap",
            }}
          >
            + Nuevo hotel
          </button>

          <button
            onClick={logout}
            style={{
              padding: "10px 14px",
              borderRadius: 12,
              border: `1px solid ${inputBorder}`,
              background: fg,
              color: bg,
              fontWeight: 950,
              cursor: "pointer",
              boxShadow: shadowSm,
              whiteSpace: "nowrap",
            }}
          >
            Cerrar sesión
          </button>
        </div>
      </div>

      {loading && <p style={{ marginTop: 20, opacity: 0.8 }}>Cargando…</p>}

      {!!error && (
        <div
          style={{
            marginTop: 20,
            padding: 12,
            borderRadius: 12,
            background: "rgba(198,40,40,0.10)",
            border: "1px solid var(--danger, #c62828)",
            color: "var(--danger, #c62828)",
            fontWeight: 900,
          }}
        >
          {error}
        </div>
      )}

      {!loading && !error && (
        <div style={{ marginTop: 24, display: "grid", gap: 16 }}>
          {hotels.map((h) => {
            const isSelected = activeHotelId === h.id;
            const isActive = h.active !== false;
            const isBusy = busyId === h.id;

            return (
              <div
                key={h.id}
                style={{
                  padding: 16,
                  borderRadius: 16,
                  border: isSelected ? "2px solid #000" : `1px solid ${border}`,
                  background: cardBg,
                  boxShadow: shadowSm,
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  gap: 12,
                  flexWrap: "wrap",
                }}
              >
                <div>
                  <div style={{ fontWeight: 950, fontSize: 16, marginBottom: 6 }}>{h.name}</div>
                  <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                    <span style={{ fontSize: 13, opacity: 0.75 }}>ID: {h.id}</span>
                    <span style={pill(isActive)}>{isActive ? "Activo" : "Inactivo"}</span>
                  </div>
                </div>

                <div style={{ display: "flex", gap: 10 }}>
                  <button
                    disabled={isBusy}
                    onClick={() => toggleHotelActive(h.id, !isActive)}
                    style={{
                      padding: "10px 12px",
                      borderRadius: 12,
                      border: `1px solid ${inputBorder}`,
                      background: inputBg,
                      fontWeight: 950,
                      cursor: isBusy ? "not-allowed" : "pointer",
                    }}
                  >
                    {isActive ? "Desactivar" : "Activar"}
                  </button>

                  <button
                    disabled={!isActive}
                    onClick={() => pickHotel(h.id)}
                    style={{
                      padding: "10px 12px",
                      borderRadius: 12,
                      border: `1px solid ${inputBorder}`,
                      background: isActive ? fg : "rgba(0,0,0,0.20)",
                      color: isActive ? bg : "#fff",
                      fontWeight: 950,
                      cursor: isActive ? "pointer" : "not-allowed",
                    }}
                  >
                    {isSelected ? "Seleccionado" : "Entrar"}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </main>
  );
}