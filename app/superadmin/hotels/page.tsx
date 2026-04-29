// FILE: app/superadmin/hotels/page.tsx
"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { signOutAndRedirect } from "@/lib/auth";
import { getClientProfile } from "@/lib/auth/clientProfile";
import { supabase } from "@/lib/supabaseClient";
import { fetchActiveHotel, setActiveHotel } from "@/lib/auth/activeHotelClient";
import { getDefaultHotelRouteByRole } from "@/lib/auth/permissions";
import type { Profile as LoadedProfile } from "@/lib/types";
import { fetchJsonOrThrow } from "@/lib/superadmin/clientApi";

const PACKS = [
  { code: "pack1", label: "Pack 1", desc: "Analítica" },
  { code: "pack2", label: "Pack 2", desc: "Recuperación / Reauditorías" },
  { code: "pack_it", label: "Pack 2.1", desc: "IT" },
  { code: "pack_engineering", label: "Pack 2.2", desc: "Engineering / Mantenimiento" },
  { code: "pack3", label: "Pack 3", desc: "Formaciones" },
] as const;

type PackCode = "base" | "pack1" | "pack_it" | "pack_engineering" | "pack2" | "pack3";

type Hotel = {
  id: string;
  name: string;
  active?: boolean | null;
  created_at?: string | null;
  enabled_packs?: string[] | null;
};
export default function SuperadminHotelsPage() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string>("");
  const [profile, setProfile] = useState<LoadedProfile | null>(null);
  const [hotels, setHotels] = useState<Hotel[]>([]);
  const [activeHotelId, setActiveHotelId] = useState<string | null>(null);
  const [expandedPacksId, setExpandedPacksId] = useState<string | null>(null);
  const [packsBusy, setPacksBusy] = useState<string | null>(null);

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

        const p = await getClientProfile();
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

        const activeHotel = await fetchActiveHotel();
        setActiveHotelId(activeHotel.hotel_id ?? null);
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
  }, []);

  const pickHotel = (hotelId: string) => {
    void (async () => {
      await setActiveHotel(hotelId);
      setActiveHotelId(hotelId);
      router.replace(getDefaultHotelRouteByRole(profile?.role));
    })();
  };

  const logout = async () => {
    await signOutAndRedirect(router);
  };

  const createHotel = async () => {
    const name = window.prompt("Nombre del hotel (ej: Eurostar Gran Central)");
    if (!name?.trim()) return;

    setLoading(true);
    setError("");

    try {
      const result = await fetchJsonOrThrow<{ hotels: Hotel[] }>("/api/superadmin/hotels", {
        method: "POST",
        body: JSON.stringify({ name: name.trim() }),
      });

      const created = result.hotels;
      setHotels((prev) => [...prev, ...created]);
      setLoading(false);
    } catch (e: any) {
      setError(e?.message ?? "No se pudo crear el hotel.");
      setLoading(false);
    }
  };

  const loadHotelPacks = async (hotelId: string) => {
    if (expandedPacksId === hotelId) {
      setExpandedPacksId(null);
      return;
    }
    setExpandedPacksId(hotelId);
    // Si el hotel ya tiene packs cargados, no re-fetch
    if (hotels.find((h) => h.id === hotelId)?.enabled_packs != null) return;

    try {
      const result = await fetchJsonOrThrow<{ hotel: Hotel }>(`/api/superadmin/hotels/${hotelId}`, {
        method: "GET",
      });
      setHotels((prev) =>
        prev.map((h) => (h.id === hotelId ? { ...h, enabled_packs: result.hotel.enabled_packs ?? ["base"] } : h))
      );
    } catch {
      // falla silenciosamente, mostramos base como default
      setHotels((prev) =>
        prev.map((h) => (h.id === hotelId && h.enabled_packs == null ? { ...h, enabled_packs: ["base"] } : h))
      );
    }
  };

  const togglePack = async (hotelId: string, pack: PackCode, currentPacks: string[]) => {
    const isActive = currentPacks.includes(pack);
    const nextPacks = isActive
      ? currentPacks.filter((p) => p !== pack)
      : [...currentPacks, pack];

    // Optimistic update
    setHotels((prev) =>
      prev.map((h) => (h.id === hotelId ? { ...h, enabled_packs: nextPacks } : h))
    );
    setPacksBusy(pack);

    try {
      await fetchJsonOrThrow(`/api/superadmin/hotels/${hotelId}`, {
        method: "PATCH",
        body: JSON.stringify({ enabled_packs: nextPacks }),
      });
    } catch (e: any) {
      // Revertir en caso de error
      setHotels((prev) =>
        prev.map((h) => (h.id === hotelId ? { ...h, enabled_packs: currentPacks } : h))
      );
      setError(e?.message ?? "No se pudo actualizar el pack.");
    } finally {
      setPacksBusy(null);
    }
  };

  const toggleHotelActive = async (hotelId: string, nextActive: boolean) => {
    setBusyId(hotelId);
    setError("");

    try {
      const result = await fetchJsonOrThrow<{ hotel: Hotel }>(`/api/superadmin/hotels/${hotelId}`, {
        method: "PATCH",
        body: JSON.stringify({ active: nextActive }),
      });

      setHotels((prev) =>
        prev.map((h) => (h.id === hotelId ? ({ ...h, ...result.hotel } as Hotel) : h))
      );

      if (!nextActive && activeHotelId === hotelId) {
        await setActiveHotel(null);
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
                  flexDirection: "column",
                  gap: 0,
                }}
              >
                {/* Fila principal: info + botones */}
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
                  <div>
                    <div style={{ fontWeight: 950, fontSize: 16, marginBottom: 6 }}>{h.name}</div>
                    <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                      <span style={pill(isActive)}>{isActive ? "Activo" : "Inactivo"}</span>
                    </div>
                  </div>

                  <div style={{ display: "flex", gap: 10 }}>
                    <button
                      onClick={() => loadHotelPacks(h.id)}
                      style={{
                        padding: "10px 12px",
                        borderRadius: 12,
                        border: `1px solid ${inputBorder}`,
                        background: expandedPacksId === h.id ? fg : inputBg,
                        color: expandedPacksId === h.id ? bg : fg,
                        fontWeight: 950,
                        cursor: "pointer",
                      }}
                    >
                      Packs
                    </button>

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

                {/* Panel de packs expandible */}
                {expandedPacksId === h.id && (
                  <div
                    style={{
                      marginTop: 14,
                      paddingTop: 14,
                      borderTop: `1px solid ${border}`,
                      display: "flex",
                      flexDirection: "column",
                      gap: 10,
                    }}
                  >
                    <div style={{ fontSize: 13, fontWeight: 950, opacity: 0.7 }}>
                      Módulos contratados
                    </div>

                    {/* Base siempre activo */}
                    <div style={{ display: "flex", alignItems: "center", gap: 10, opacity: 0.5 }}>
                      <div
                        style={{
                          width: 16,
                          height: 16,
                          borderRadius: 4,
                          background: "var(--ok, #0f766e)",
                          flexShrink: 0,
                        }}
                      />
                      <span style={{ fontWeight: 950, fontSize: 14 }}>Pack Base</span>
                      <span style={{ fontSize: 12, opacity: 0.8 }}>General, Progreso, Historial, Members</span>
                      <span style={{ fontSize: 11, marginLeft: "auto" }}>siempre incluido</span>
                    </div>

                    {PACKS.map((pack) => {
                      const currentPacks = h.enabled_packs ?? ["base"];
                      const isEnabled = currentPacks.includes(pack.code);
                      const isBusyPack = packsBusy === pack.code;

                      return (
                        <label
                          key={pack.code}
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 10,
                            cursor: isBusyPack ? "not-allowed" : "pointer",
                            opacity: isBusyPack ? 0.6 : 1,
                          }}
                        >
                          <input
                            type="checkbox"
                            checked={isEnabled}
                            disabled={isBusyPack}
                            onChange={() => togglePack(h.id, pack.code as PackCode, currentPacks)}
                            style={{ width: 16, height: 16, cursor: "pointer", accentColor: "var(--ok, #0f766e)" }}
                          />
                          <span style={{ fontWeight: 950, fontSize: 14 }}>{pack.label}</span>
                          <span style={{ fontSize: 12, opacity: 0.8 }}>{pack.desc}</span>
                        </label>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </main>
  );
}
