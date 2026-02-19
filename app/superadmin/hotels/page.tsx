"use client";

import { useEffect, useMemo, useState } from "react";
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

  // ✅ Crear hotel (modal)
  const [showCreate, setShowCreate] = useState(false);
  const [newHotelName, setNewHotelName] = useState("");
  const [newHotelActive, setNewHotelActive] = useState(true);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string>("");

  const canCreate = useMemo(() => profile?.role === "superadmin", [profile?.role]);

  const loadHotels = async () => {
    const { data, error: hotelsErr } = await supabase
      .from("hotels")
      .select("id, name, active, created_at")
      .order("created_at", { ascending: true });

    if (hotelsErr) throw hotelsErr;
    setHotels((data ?? []) as Hotel[]);
  };

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

        await loadHotels();

        // ✅ Preferimos localStorage; si no existe, usamos profile.hotel_id (si viniera)
        const saved = localStorage.getItem("sc_hotel_id");
        const fallback = (p as any)?.hotel_id ?? null;
        setActiveHotelId(saved || fallback);
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

  // ✅ FIX: al elegir hotel, también guardamos en profiles.hotel_id
  const pickHotel = async (hotelId: string) => {
    try {
      // 1) Persistencia local inmediata
      localStorage.setItem("sc_hotel_id", hotelId);
      setActiveHotelId(hotelId);

      // 2) Persistencia en DB para que el dashboard (si lee profile.hotel_id) no vuelva al Demo
      if (profile?.id) {
        const { error: updErr } = await supabase
          .from("profiles")
          .update({ hotel_id: hotelId })
          .eq("id", profile.id);

        // Si falla por RLS, igualmente seguimos: el localStorage ya está bien
        if (updErr) {
          console.warn("No se pudo actualizar profiles.hotel_id:", updErr.message);
        }
      }

      // 3) Ir al dashboard
      router.replace("/dashboard");
    } catch (e: any) {
      // fallback seguro
      router.replace("/dashboard");
    }
  };

  const logout = async () => {
    await supabase.auth.signOut();
    localStorage.removeItem("sc_hotel_id");
    router.replace("/login");
  };

  const openCreate = () => {
    setCreateError("");
    setNewHotelName("");
    setNewHotelActive(true);
    setShowCreate(true);
  };

  const createHotel = async () => {
    if (!newHotelName.trim()) {
      setCreateError("Pon un nombre para el hotel.");
      return;
    }

    setCreating(true);
    setCreateError("");

    try {
      const { error: insErr } = await supabase.from("hotels").insert({
        name: newHotelName.trim(),
        active: newHotelActive,
      });

      if (insErr) throw insErr;

      setShowCreate(false);
      await loadHotels();
    } catch (e: any) {
      setCreateError(e?.message ?? "No se pudo crear el hotel.");
    } finally {
      setCreating(false);
    }
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
          <div style={{ fontSize: 28, fontWeight: 900 }}>Elegir hotel</div>
          <div style={{ opacity: 0.7, marginTop: 6 }}>
            {profile?.full_name ?? "Superadmin"} · Superadmin
          </div>
        </div>

        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          {canCreate && (
            <button
              onClick={openCreate}
              style={{
                padding: "10px 14px",
                borderRadius: 12,
                border: "1px solid rgba(0,0,0,0.12)",
                background: "#ffffff",
                color: "#111",
                fontWeight: 800,
                cursor: "pointer",
              }}
            >
              + Nuevo hotel
            </button>
          )}

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
                    border: isActive ? "2px solid #000" : "1px solid #ddd",
                    background: "#ffffff",
                    color: "#111111",
                    cursor: "pointer",
                    display: "flex",
                    justifyContent: "space-between",
                    gap: 12,
                    alignItems: "center",
                  }}
                >
                  <div>
                    <div style={{ fontWeight: 800, fontSize: 16, marginBottom: 4 }}>
                      {h.name}
                      {h.active === false ? (
                        <span style={{ marginLeft: 10, fontSize: 12, opacity: 0.6 }}>
                          (inactivo)
                        </span>
                      ) : null}
                    </div>
                    <div style={{ fontSize: 13, opacity: 0.6 }}>ID: {h.id}</div>
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

      {/* Modal Crear Hotel */}
      {showCreate && (
        <div
          onClick={() => setShowCreate(false)}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.35)",
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            padding: 16,
            zIndex: 50,
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: "min(520px, 100%)",
              background: "#fff",
              borderRadius: 16,
              border: "1px solid rgba(0,0,0,0.12)",
              padding: 16,
              color: "#111",
            }}
          >
            <div style={{ fontSize: 18, fontWeight: 900 }}>Crear nuevo hotel</div>
            <div style={{ marginTop: 6, opacity: 0.7, fontSize: 13 }}>
              Se añadirá a la lista para seleccionar y operar.
            </div>

            <div style={{ marginTop: 14 }}>
              <div style={{ fontSize: 13, fontWeight: 800, marginBottom: 6 }}>Nombre</div>
              <input
                value={newHotelName}
                onChange={(e) => setNewHotelName(e.target.value)}
                placeholder="Ej: Paradisus Los Cabos"
                autoFocus
                style={{
                  width: "100%",
                  padding: "10px 12px",
                  borderRadius: 12,
                  border: "1px solid rgba(0,0,0,0.2)",
                  outline: "none",
                }}
              />
            </div>

            <label
              style={{
                display: "flex",
                gap: 10,
                alignItems: "center",
                marginTop: 12,
                fontSize: 14,
                userSelect: "none",
              }}
            >
              <input
                type="checkbox"
                checked={newHotelActive}
                onChange={(e) => setNewHotelActive(e.target.checked)}
              />
              Hotel activo
            </label>

            {!!createError && (
              <div
                style={{
                  marginTop: 12,
                  padding: 10,
                  borderRadius: 12,
                  background: "#2a0000",
                  border: "1px solid #550000",
                  color: "#ffaaaa",
                  fontSize: 13,
                }}
              >
                {createError}
              </div>
            )}

            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 14 }}>
              <button
                onClick={() => setShowCreate(false)}
                disabled={creating}
                style={{
                  padding: "10px 14px",
                  borderRadius: 12,
                  border: "1px solid rgba(0,0,0,0.15)",
                  background: "#fff",
                  color: "#111",
                  fontWeight: 800,
                  cursor: creating ? "not-allowed" : "pointer",
                  opacity: creating ? 0.6 : 1,
                }}
              >
                Cancelar
              </button>

              <button
                onClick={createHotel}
                disabled={creating}
                style={{
                  padding: "10px 14px",
                  borderRadius: 12,
                  border: "1px solid rgba(0,0,0,0.15)",
                  background: "#111",
                  color: "#fff",
                  fontWeight: 900,
                  cursor: creating ? "not-allowed" : "pointer",
                  opacity: creating ? 0.75 : 1,
                }}
              >
                {creating ? "Creando…" : "Crear"}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
