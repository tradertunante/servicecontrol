// app/(app)/admin/_components/AdminShell.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import type { CSSProperties } from "react";
import { supabase } from "@/lib/supabaseClient";

import DepartmentsModule from "../_modules/departments/DepartmentsModule";
import UsersModule from "../_modules/users/UsersModule";
import HotelInfoModule from "../_modules/hotel/HotelInfoModule";
import AccessByAreaModule from "../_modules/access-by-area/AccessByAreaModule";
import AreaAuditsModule from "../_modules/area-audits/AreaAuditsModule";

type AreaRow = {
  id: string;
  name: string;
  type: string | null;
  hotel_id: string | null;
  active: boolean | null;
  sort_order: number | null;
};

type ViewMode = "hotel-info" | "departments" | "users" | "access-by-area" | "area-audits";

const HOTEL_KEY = "sc_hotel_id";
const HOTEL_CHANGED_EVENT = "sc-hotel-changed";

export default function AdminShell() {
  const [activeHotelId, setActiveHotelId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>("hotel-info");

  // Áreas (departamentos) list
  const [areas, setAreas] = useState<AreaRow[]>([]);
  const [areasLoading, setAreasLoading] = useState(false);
  const [areasError, setAreasError] = useState("");
  const [areaQuery, setAreaQuery] = useState("");
  const [selectedAreaId, setSelectedAreaId] = useState<string | null>(null);

  const selectedArea = useMemo(() => areas.find((a) => a.id === selectedAreaId) ?? null, [areas, selectedAreaId]);

  useEffect(() => {
    const readHotel = () => {
      try {
        setActiveHotelId(localStorage.getItem(HOTEL_KEY));
      } catch {
        setActiveHotelId(null);
      }
    };

    readHotel();
    window.addEventListener(HOTEL_CHANGED_EVENT, readHotel);
    window.addEventListener("storage", readHotel);

    return () => {
      window.removeEventListener(HOTEL_CHANGED_EVENT, readHotel);
      window.removeEventListener("storage", readHotel);
    };
  }, []);

  async function loadAreas(hotelIdOverride?: string | null) {
    const hotelId = hotelIdOverride ?? activeHotelId;

    setAreasError("");

    if (!hotelId) {
      setAreas([]);
      return;
    }

    setAreasLoading(true);
    try {
      const { data, error } = await supabase
        .from("areas")
        .select("id, name, type, hotel_id, active, sort_order")
        .eq("hotel_id", hotelId)
        .order("sort_order", { ascending: true })
        .order("name", { ascending: true });

      if (error) throw error;
      setAreas((data ?? []) as any);
    } catch (e: any) {
      setAreas([]);
      setAreasError(e?.message || "Error cargando áreas.");
    } finally {
      setAreasLoading(false);
    }
  }

  useEffect(() => {
    // reset UI al cambiar de hotel
    setSelectedAreaId(null);
    setViewMode("hotel-info");
    setAreaQuery("");
    loadAreas(activeHotelId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeHotelId]);

  const filteredAreas = useMemo(() => {
    const needle = areaQuery.trim().toLowerCase();
    if (!needle) return areas;
    return areas.filter((a) => `${a.name ?? ""} ${a.type ?? ""} ${a.id ?? ""}`.toLowerCase().includes(needle));
  }, [areas, areaQuery]);

  function openAreaAudits(areaId: string) {
    setSelectedAreaId(areaId);
    setViewMode("area-audits");
  }

  return (
    <div style={{ padding: 18 }}>
      <div style={{ display: "grid", gridTemplateColumns: "360px 1fr", gap: 18, alignItems: "start" }}>
        {/* LEFT */}
        <aside style={leftCard}>
          <div style={{ padding: 16, borderBottom: "1px solid rgba(0,0,0,0.08)" }}>
            <div style={{ fontSize: 34, fontWeight: 950 }}>Panel de control</div>
            <div style={{ marginTop: 8, fontSize: 13, fontWeight: 900, opacity: 0.8 }}>Hotel: {activeHotelId ?? "—"}</div>
          </div>

          <div style={{ padding: 12 }}>
            {/* 4 módulos principales */}
            <NavTile title="Info del hotel" active={viewMode === "hotel-info"} onClick={() => setViewMode("hotel-info")} />
            <NavTile title="Departamentos" active={viewMode === "departments"} onClick={() => setViewMode("departments")} />
            <NavTile title="Usuarios" active={viewMode === "users"} onClick={() => setViewMode("users")} />
            <NavTile title="Acceso por área" active={viewMode === "access-by-area"} onClick={() => setViewMode("access-by-area")} />

            {/* lista de áreas */}
            <div style={{ marginTop: 14, paddingTop: 14, borderTop: "1px solid rgba(0,0,0,0.10)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center" }}>
                <div style={{ fontWeight: 950, fontSize: 13, opacity: 0.8 }}>Áreas (departamentos) existentes</div>
                <button style={ghostBtnSmall} onClick={() => loadAreas()} disabled={areasLoading}>
                  {areasLoading ? "…" : "Recargar"}
                </button>
              </div>

              <div style={{ marginTop: 10 }}>
                <input value={areaQuery} onChange={(e) => setAreaQuery(e.target.value)} placeholder="Buscar área…" style={inputSmall} />
              </div>

              {areasError ? <ErrorBox text={areasError} /> : null}

              <div style={{ marginTop: 10 }}>
                {!activeHotelId ? (
                  <div style={{ padding: 10, fontWeight: 900, opacity: 0.75 }}>Selecciona un hotel.</div>
                ) : areasLoading ? (
                  <div style={{ padding: 10, fontWeight: 900, opacity: 0.75 }}>Cargando…</div>
                ) : filteredAreas.length === 0 ? (
                  <div style={{ padding: 10, fontWeight: 900, opacity: 0.75 }}>No hay áreas.</div>
                ) : (
                  filteredAreas.map((a) => {
                    const isActive = (a.active ?? true) === true;
                    const isSel = selectedAreaId === a.id && viewMode === "area-audits";

                    return (
                      <button
                        key={a.id}
                        onClick={() => openAreaAudits(a.id)}
                        style={{
                          width: "100%",
                          textAlign: "left",
                          padding: 12,
                          borderRadius: 12,
                          background: isSel ? "rgba(0,120,255,0.12)" : "rgba(255,255,255,0.72)",
                          border: "1px solid rgba(0,0,0,0.08)",
                          marginTop: 10,
                          cursor: "pointer",
                        }}
                        title="Ver auditorías (plantillas) de esta área"
                      >
                        <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center" }}>
                          <div style={{ fontWeight: 950 }}>
                            {a.name}
                            {a.type ? <span style={{ marginLeft: 8, fontWeight: 900, opacity: 0.55 }}>· {a.type}</span> : null}
                          </div>

                          <span
                            style={{
                              fontSize: 12,
                              fontWeight: 950,
                              padding: "4px 8px",
                              borderRadius: 999,
                              border: "1px solid rgba(0,0,0,0.10)",
                              background: isActive ? "rgba(0,200,0,0.10)" : "rgba(0,0,0,0.05)",
                              color: isActive ? "green" : "rgba(0,0,0,0.55)",
                              whiteSpace: "nowrap",
                            }}
                          >
                            {isActive ? "activo" : "inactivo"}
                          </span>
                        </div>
                      </button>
                    );
                  })
                )}
              </div>
            </div>
          </div>
        </aside>

        {/* RIGHT */}
        <main style={rightCard}>
          {!activeHotelId ? (
            <div style={{ padding: 16, fontWeight: 900, opacity: 0.8 }}>Selecciona un hotel para continuar.</div>
          ) : viewMode === "hotel-info" ? (
            <HotelInfoModule />
          ) : viewMode === "departments" ? (
            <DepartmentsModule />
          ) : viewMode === "users" ? (
            <UsersModule />
          ) : viewMode === "access-by-area" ? (
            <AccessByAreaModule />
          ) : (
            <div style={{ padding: 16 }}>
              {/* ✅ Minimalista: el módulo SOLO lista auditorías del área seleccionada */}
              <AreaAuditsModule hotelId={activeHotelId} areaId={selectedAreaId} areaName={selectedArea?.name ?? null} />
            </div>
          )}
        </main>
      </div>
    </div>
  );
}

/* ---------------- UI helpers ---------------- */

function NavTile({ title, active, onClick }: { title: string; active?: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      style={{
        width: "100%",
        textAlign: "left",
        padding: 14,
        borderRadius: 14,
        background: active ? "rgba(0,120,255,0.12)" : "rgba(255,255,255,0.75)",
        border: "1px solid rgba(0,0,0,0.10)",
        marginBottom: 10,
        cursor: "pointer",
        fontWeight: 950,
      }}
    >
      <div style={{ fontSize: 16, fontWeight: 950 }}>{title}</div>
    </button>
  );
}

function ErrorBox({ text }: { text: string }) {
  return (
    <div
      style={{
        marginTop: 12,
        padding: 12,
        borderRadius: 12,
        border: "1px solid rgba(220,0,0,0.35)",
        background: "rgba(220,0,0,0.06)",
        color: "crimson",
        fontWeight: 900,
      }}
    >
      {text}
    </div>
  );
}

/* ---------------- styles ---------------- */

const leftCard: CSSProperties = {
  background: "rgba(255,255,255,0.85)",
  borderRadius: 16,
  border: "1px solid rgba(0,0,0,0.08)",
  boxShadow: "0 6px 20px rgba(0,0,0,0.06)",
  overflow: "hidden",
};

const rightCard: CSSProperties = {
  background: "white",
  borderRadius: 16,
  border: "1px solid rgba(0,0,0,0.10)",
  boxShadow: "0 6px 20px rgba(0,0,0,0.06)",
  overflow: "hidden",
  minHeight: 520,
};

const inputSmall: CSSProperties = {
  width: "100%",
  padding: "10px 12px",
  borderRadius: 12,
  border: "1px solid rgba(0,0,0,0.14)",
  background: "white",
  fontWeight: 800,
};

const ghostBtnSmall: CSSProperties = {
  padding: "10px 12px",
  borderRadius: 12,
  border: "1px solid rgba(0,0,0,0.18)",
  background: "white",
  fontWeight: 950,
  cursor: "pointer",
};