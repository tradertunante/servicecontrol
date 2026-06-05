// FILE: app/(app)/admin/_components/AdminShell.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import type { CSSProperties } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import DepartmentsModule from "../_modules/departments/DepartmentsModule";
import HotelInfoModule from "../_modules/hotel/HotelInfoModule";
import AuditTargetsModule from "../_modules/audit-targets/AuditTargetsModule";
import BuilderModule from "../_modules/builder/BuilderModule";
import NotificationsModule from "../_modules/notifications/NotificationsModule";
import MysteryShoppersModule from "../_modules/mystery-shoppers/MysteryShoppersModule";

type ViewMode =
  | "hotel-info"
  | "departments"
  | "audit-targets"
  | "builder"
  | "notifications"
  | "mystery-shoppers";

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
    minHeight: 44,
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
  const router = useRouter();
  const searchParams = useSearchParams();
  const [activeHotelId] = useState<string | null>(initialHotelId);
  const [viewMode, setViewMode] = useState<ViewMode>(initialViewMode);
  const [isNarrow, setIsNarrow] = useState(false);

  function navigate(tab: ViewMode) {
    setViewMode(tab);
    const next = new URLSearchParams(searchParams.toString());
    next.set("tab", tab);
    router.replace(`/admin?${next.toString()}`);
  }

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
        { key: "hotel-info" as const, label: "Hotel", onboarding: "admin-hotel", icon: (
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9.5L12 3l9 6.5V20a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9.5z"/><path d="M9 21V12h6v9"/></svg>
        )},
        { key: "departments" as const, label: "Departamentos", onboarding: "admin-departments", icon: (
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2"/><line x1="12" y1="12" x2="12" y2="16"/><line x1="10" y1="14" x2="14" y2="14"/></svg>
        )},
        { key: "builder" as const, label: "Biblioteca de estándares", onboarding: "admin-builder", icon: (
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>
        )},
        { key: "audit-targets" as const, label: "Objetivos", onboarding: "admin-targets", icon: (
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/></svg>
        )},
        { key: "notifications" as const, label: "Notificaciones", onboarding: "admin-notifications", icon: (
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>
        )},
        { key: "mystery-shoppers" as const, label: "Mystery Shoppers", onboarding: "admin-mystery-shoppers", icon: (
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/><path d="M9 8h.01M15 8h.01"/></svg>
        )},
      ] as const,
    []
  );

  // Dynamic: depends on isNarrow state
  const layoutStyle: CSSProperties = isNarrow
    ? { display: "grid", gridTemplateColumns: "1fr", gap: 14, alignItems: "start", width: "100%" }
    : { display: "grid", gridTemplateColumns: "260px 1fr", gap: 14, alignItems: "start", width: "100%" };

  return (
    <div className="w-full p-[18px] overflow-x-hidden">
      <div style={layoutStyle}>
        <aside style={sidebar} data-onboarding="admin-sidebar">
          <div className="mb-3">
            <div className="text-[18px] font-black tracking-[0.2px]">Administración</div>
            <div className="mt-[3px] text-[13px] opacity-[0.85]">Gestiona hotel, usuarios, accesos, auditorías y objetivos.</div>
          </div>

          <div className="grid gap-2 mt-[6px] grid-cols-1">
            {navItems.map((it) => {
              const active = viewMode === it.key;
              return (
                <button
                  key={it.key}
                  data-onboarding={it.onboarding}
                  style={buildNavItemStyle(active)}
                  onClick={() => navigate(it.key)}
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
                  <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    {it.icon}
                    {it.label}
                  </span>
                </button>
              );
            })}
          </div>

          <a
            href="/users"
            data-onboarding="admin-users"
            style={buildNavItemStyle(false)}
            className="block no-underline"
          >
            <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
              Usuarios ↗
            </span>
          </a>

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
          ) : viewMode === "builder" ? (
            <BuilderModule hotelId={activeHotelId} />
          ) : viewMode === "audit-targets" ? (
            <AuditTargetsModule hotelId={activeHotelId} />
          ) : viewMode === "notifications" ? (
            <NotificationsModule hotelId={activeHotelId} />
          ) : (
            <MysteryShoppersModule hotelId={activeHotelId} />
          )}
        </main>
      </div>
    </div>
  );
}
