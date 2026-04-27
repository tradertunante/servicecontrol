// FILE: app/(app)/admin/_components/AdminShell.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import type { CSSProperties } from "react";

import DepartmentsModule from "../_modules/departments/DepartmentsModule";
import UsersModule from "../_modules/users/UsersModule";
import HotelInfoModule from "../_modules/hotel/HotelInfoModule";
import AuditTargetsModule from "../_modules/audit-targets/AuditTargetsModule";
import BuilderModule from "../_modules/builder/BuilderModule";
import NotificationsModule from "../_modules/notifications/NotificationsModule";

type ViewMode =
  | "hotel-info"
  | "departments"
  | "users"
  | "audit-targets"
  | "builder"
  | "notifications";

function v(name: string, fallback: string) {
  return `var(${name}, ${fallback})`;
}

function buildCardStyle(): CSSProperties {
  return {
    border: `1px solid ${v("--sc-border", "rgba(255,255,255,0.10)")}`,
    borderRadius: 16,
    padding: 16,
    background: v("--sc-card-bg", "rgba(255,255,255,0.04)"),
    boxShadow: v("--sc-shadow", "0 6px 18px rgba(0,0,0,0.20)"),
    width: "100%",
  };
}

function buildSidebarStyle(): CSSProperties {
  return {
    border: `1px solid ${v("--sc-border", "rgba(255,255,255,0.10)")}`,
    borderRadius: 16,
    padding: 12,
    background: v("--sc-panel-bg", "rgba(255,255,255,0.03)"),
    boxShadow: v("--sc-shadow-soft", "0 6px 18px rgba(0,0,0,0.16)"),
    height: "fit-content",
    position: "sticky",
    top: 12,
  };
}

function buildNavItemStyle(active: boolean): CSSProperties {
  return {
    width: "100%",
    textAlign: "left",
    border: `1px solid ${
      active
        ? v("--sc-border-strong", "rgba(255,255,255,0.22)")
        : v("--sc-border", "rgba(255,255,255,0.10)")
    }`,
    borderRadius: 12,
    padding: "10px 12px",
    background: active
      ? v("--sc-row-bg", "rgba(255,255,255,0.08)")
      : v("--sc-row-bg-soft", "rgba(255,255,255,0.03)"),
    cursor: "pointer",
    fontWeight: active ? 800 : 650,
    opacity: active ? 1 : 0.92,
    transition: "transform 120ms ease, background 120ms ease, border-color 120ms ease, opacity 120ms ease",
  };
}


export default function AdminShell({
  initialHotelId,
  initialViewMode = "hotel-info",
}: {
  initialHotelId: string;
  initialViewMode?: ViewMode;
}) {
  const [activeHotelId] = useState<string | null>(initialHotelId);
  const [viewMode, setViewMode] = useState<ViewMode>(initialViewMode);
  const [isNarrow, setIsNarrow] = useState(false);

  useEffect(() => {
    const onResize = () => setIsNarrow(window.innerWidth < 900);
    onResize();
    window.addEventListener("resize", onResize);

    return () => {
      window.removeEventListener("resize", onResize);
    };
  }, []);

  const card = useMemo(() => buildCardStyle(), []);
  const sidebar = useMemo(
    () => ({
      ...buildSidebarStyle(),
      // En móvil (1 columna) la sidebar va arriba del contenido:
      // sticky causaría overlap al hacer scroll → la dejamos estática
      ...(isNarrow ? { position: "static" as const } : {}),
    }),
    [isNarrow]
  );

  const navItems = useMemo(
    () =>
      [
        { key: "hotel-info" as const, label: "Hotel", onboarding: "admin-hotel" },
        { key: "departments" as const, label: "Departamentos", onboarding: "admin-departments" },
        { key: "builder" as const, label: "Biblioteca de estándares", onboarding: "admin-builder" },
        { key: "users" as const, label: "Usuarios", onboarding: "admin-users" },
        { key: "audit-targets" as const, label: "Objetivos", onboarding: "admin-targets" },
        { key: "notifications" as const, label: "Notificaciones", onboarding: "admin-notifications" },
      ] as const,
    []
  );

  // Dynamic: depends on isNarrow state
  const layoutStyle: CSSProperties = isNarrow
    ? { display: "grid", gridTemplateColumns: "1fr", gap: 14, alignItems: "start", width: "100%" }
    : { display: "grid", gridTemplateColumns: "260px 1fr", gap: 14, alignItems: "start", width: "100%" };

  return (
    <div className="w-full p-[18px]">
      <div style={layoutStyle}>
        <aside style={sidebar} data-onboarding="admin-sidebar">
          <div className="mb-3">
            <div className="text-[18px] font-black tracking-[0.2px]">Administración</div>
            <div className="mt-[3px] text-[13px] opacity-[0.85]">Gestiona hotel, usuarios, accesos, auditorías y objetivos.</div>
          </div>

          <div className={`grid gap-2 mt-[6px] ${isNarrow ? "grid-cols-2" : "grid-cols-1"}`}>
            {navItems.map((it) => {
              const active = viewMode === it.key;
              return (
                <button
                  key={it.key}
                  data-onboarding={it.onboarding}
                  style={buildNavItemStyle(active)}
                  onClick={() => setViewMode(it.key)}
                  onMouseDown={(e) => {
                    (e.currentTarget as HTMLButtonElement).style.transform = "scale(0.99)";
                  }}
                  onMouseUp={(e) => {
                    (e.currentTarget as HTMLButtonElement).style.transform = "scale(1)";
                  }}
                  onMouseLeave={(e) => {
                    (e.currentTarget as HTMLButtonElement).style.transform = "scale(1)";
                  }}
                >
                  {it.label}
                </button>
              );
            })}
          </div>

          {!activeHotelId ? (
            <div className="mt-3 text-[12px] opacity-[0.85] leading-[1.35]">
              Selecciona un hotel (HotelPicker) para poder administrar módulos por hotel.
            </div>
          ) : null}
        </aside>

        <main className="w-full">
          {!activeHotelId ? (
            <div style={card}>
              <b>Selecciona un hotel</b> (HotelPicker) para poder administrar módulos por hotel.
            </div>
          ) : viewMode === "hotel-info" ? (
            <HotelInfoModule hotelId={activeHotelId} />
          ) : viewMode === "departments" ? (
            <DepartmentsModule hotelId={activeHotelId} />
          ) : viewMode === "users" ? (
            <UsersModule />
          ) : viewMode === "builder" ? (
            <BuilderModule hotelId={activeHotelId} />
          ) : viewMode === "audit-targets" ? (
            <AuditTargetsModule card={card} hotelId={activeHotelId} />
          ) : (
            <NotificationsModule hotelId={activeHotelId} />
          )}
        </main>
      </div>
    </div>
  );
}
