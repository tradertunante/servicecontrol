// app/components/HotelHeader.tsx
"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useToast } from "@/app/providers/ToastProvider";
import { useQuery } from "@tanstack/react-query";
import { fetchActiveHotel } from "@/lib/auth/activeHotelClient";
import { supabase } from "@/lib/supabaseClient";
import type { Profile, Role } from "@/lib/types";
import { goBackOrFallback } from "@/lib/navigation/clientBack";

function getPageTitle(pathname: string | null): string {
  if (!pathname) return "";
  if (pathname === "/dashboard") return "Dashboard";
  if (pathname === "/admin") return "Admin";
  if (pathname.startsWith("/admin/hotel")) return "Info del Hotel";
  if (pathname === "/areas") return "Áreas";
  if (pathname.startsWith("/areas/")) return "Área";
  if (pathname === "/builder") return "Builder";
  if (pathname.startsWith("/builder/")) return "Editor";
  if (pathname.startsWith("/audits/")) {
    if (pathname.includes("/view")) return "Resultado";
    return "Auditoría";
  }
  if (pathname === "/users") return "Usuarios";
  if (pathname === "/profile") return "Perfil";
  if (pathname.startsWith("/superadmin/hotels")) return "Elegir hotel";
  return "";
}

function getBackTarget(pathname: string | null): string | null {
  if (!pathname) return null;
  const roots = new Set(["/dashboard", "/admin", "/areas", "/builder", "/profile", "/users", "/superadmin", "/superadmin/hotels", "/team"]);
  if (roots.has(pathname)) return null;
  if (pathname.startsWith("/areas/")) return "/areas";
  if (pathname.startsWith("/builder/")) return "/builder";
  if (pathname.startsWith("/admin/hotel")) return "/admin";
  if (pathname.startsWith("/audits/")) return "/areas";
  return "/dashboard";
}

async function resolveAuditTarget(hotelId?: string | null) {
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    throw new Error("No se pudo identificar tu usuario para abrir el área de auditoría.");
  }

  const { data, error } = await supabase
    .from("user_area_access")
    .select("area_id")
    .eq("user_id", user.id)
    .eq("hotel_id", hotelId ?? "");

  if (error) throw error;

  const areaIds = Array.from(
    new Set(
      (data ?? [])
        .map((row: { area_id: string | null }) => row.area_id)
        .filter((areaId): areaId is string => !!areaId)
    )
  );

  if (areaIds.length === 0) return null;
  if (areaIds.length === 1) return `/areas/${areaIds[0]}?tab=dashboard`;
  return "/areas";
}

export default function HotelHeader() {
  const router = useRouter();
  const toast = useToast();
  const pathname = usePathname();
  const headerRef = useRef<HTMLDivElement | null>(null);

  const [isHoveringHotel, setIsHoveringHotel] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    const onPointerDown = (e: PointerEvent) => {
      const el = headerRef.current;
      if (!el) return;
      if (!el.contains(e.target as Node)) setMobileMenuOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown, true);
    return () => { document.removeEventListener("pointerdown", onPointerDown, true); };
  }, []);

  useEffect(() => { setMobileMenuOpen(false); }, [pathname]);

  const pageTitle = useMemo(() => getPageTitle(pathname), [pathname]);

  const { data: headerData, isLoading: loading } = useQuery({
    queryKey: ["header-context"],
    queryFn: async () => {
      const [{ data: userData, error: userErr }, hotelContext] = await Promise.all([
        supabase.auth.getUser(),
        fetchActiveHotel().catch(() => null),
      ]);

      if (userErr || !userData?.user) return null;

      const uid = userData.user.id;
      const hotelIdToUse = hotelContext?.hotel_id ?? null;

      const [{ data: profileData, error: profileErr }, hotelResult] = await Promise.all([
        supabase.from("profiles").select("id, hotel_id, role").eq("id", uid).single(),
        hotelIdToUse
          ? supabase.from("hotels").select("name").eq("id", hotelIdToUse).single()
          : Promise.resolve({ data: null, error: null }),
      ]);

      if (profileErr || !profileData) return null;

      const role = String(profileData.role ?? "") as Role;
      const profile: Profile = { id: uid, role, hotel_id: profileData.hotel_id ?? null };

      return {
        profile,
        activeHotelId: hotelIdToUse,
        hotelName: hotelResult.data?.name ?? null,
      };
    },
    staleTime: 5 * 60 * 1000,
  });

  const profile = headerData?.profile ?? null;
  const activeHotelId = headerData?.activeHotelId ?? null;
  const hotelName = headerData?.hotelName ?? null;

  const isAdmin = profile?.role === "admin" || profile?.role === "superadmin";
  const displayHotel = hotelName ?? (loading ? "Cargando…" : "Selecciona hotel");
  const backTarget = getBackTarget(pathname);
  const showBack = Boolean(backTarget);
  const navTo = (path: string) => { router.push(path); };
  const hotelHomeTarget = profile?.role === "manager" ? "/team/general" : "/home";
  const openAuditArea = async () => {
    try {
      if (profile?.role === "manager") {
        router.push("/team/templates");
        return;
      }

      const target = await resolveAuditTarget(activeHotelId);
      if (!target) {
        toast.warn("No tienes ningún área asignada para auditar.");
        return;
      }
      router.push(target);
    } catch (error) {
      console.error("Error resolving audit area access:", error);
      toast.error("No se pudo abrir el área de auditoría.");
    }
  };

  return (
    <>
      <div ref={headerRef} className="scHeader">
        <div className="left">
          {showBack && (
            <button
              className="iconBtn"
              onClick={() => goBackOrFallback(router, backTarget!)}
              aria-label="Atrás"
              title="Atrás"
              disabled={loading}
            >
              ←
            </button>
          )}
          <div className="titleBlock">
            <button onClick={() => navTo(hotelHomeTarget)} onMouseEnter={() => setIsHoveringHotel(true)} onMouseLeave={() => setIsHoveringHotel(false)} className="hotelBtn" title={displayHotel} aria-label="Ir al inicio del hotel" disabled={loading}>
              {displayHotel}
            </button>
            {pageTitle && <div className="pageTitle">{pageTitle}</div>}
          </div>
        </div>

        <div className="right">
          <div className="actionsDesktop">
            {isAdmin && <button className="pillBtn" onClick={() => navTo("/admin")} disabled={loading}>Admin</button>}
            <button className="pillBtn" onClick={() => void openAuditArea()} disabled={loading}>Auditar</button>
            <button className="pillBtn" onClick={() => navTo("/profile")} disabled={loading}>Perfil</button>
          </div>
          <div className="actionsMobile">
            <button className="iconBtn" onClick={() => setMobileMenuOpen((v) => !v)} aria-label="Menú" title="Menú" disabled={loading}>☰</button>
            {mobileMenuOpen && (
              <div className="dropdown" role="menu" aria-label="Menú de navegación">
                {isAdmin && <button className="dropItem" onClick={() => navTo("/admin")} disabled={loading}>Admin</button>}
                <button className="dropItem" onClick={() => void openAuditArea()} disabled={loading}>Auditar</button>
                <button className="dropItem" onClick={() => navTo("/profile")} disabled={loading}>Perfil</button>
              </div>
            )}
          </div>
        </div>
      </div>

      <style jsx>{`
        .scHeader { position: fixed; top: 0; left: 0; right: 0; display: flex; justify-content: space-between; align-items: center; padding: 10px 14px; background: var(--header-bg, rgba(255,255,255,0.92)); border-bottom: 1px solid var(--header-border, rgba(0,0,0,0.08)); box-shadow: 0 2px 8px rgba(0,0,0,0.05); z-index: 1000; backdrop-filter: blur(8px); gap: 10px; }
        .left { display: flex; align-items: center; gap: 10px; min-width: 0; flex: 1; }
        .titleBlock { display: flex; flex-direction: column; min-width: 0; gap: 2px; }
        .hotelBtn { font-size: 14px; font-weight: 950; letter-spacing: 0.2px; background: none; border: none; cursor: pointer; padding: 2px 4px; border-radius: 8px; opacity: ${loading ? 0.6 : isHoveringHotel ? 1 : 0.85}; transition: all 0.2s ease; color: ${isHoveringHotel ? "#000" : "inherit"}; text-decoration: ${isHoveringHotel ? "underline" : "none"}; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; min-width: 0; max-width: min(52vw, 360px); }
        .pageTitle { font-size: 11px; font-weight: 900; opacity: 0.6; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; min-width: 0; max-width: min(52vw, 360px); }
        .right { display: flex; align-items: center; gap: 10px; flex-shrink: 0; position: relative; }
        .actionsDesktop { display: flex; gap: 10px; align-items: center; }
        .actionsMobile { display: none; position: relative; }
        .pillBtn { padding: 7px 12px; border-radius: 10px; border: 1px solid rgba(0,0,0,0.15); background: #fff; color: #000; font-weight: 900; cursor: pointer; font-size: 13px; white-space: nowrap; transition: all 0.2s; opacity: ${loading ? 0.6 : 1}; }
        .pillBtn:hover:not(:disabled) { background: #000; color: #fff; }
        .iconBtn { height: 38px; min-width: 38px; padding: 0 10px; border-radius: 12px; border: 1px solid rgba(0,0,0,0.15); background: #fff; color: #000; font-weight: 900; cursor: pointer; font-size: 15px; display: inline-flex; align-items: center; justify-content: center; transition: all 0.2s; }
        .iconBtn:hover:not(:disabled) { background: #000; color: #fff; }
        .dropdown { position: absolute; top: 44px; right: 0; min-width: 170px; background: #fff; border: 1px solid rgba(0,0,0,0.12); border-radius: 12px; box-shadow: 0 14px 40px rgba(0,0,0,0.12); padding: 6px; overflow: hidden; z-index: 2000; }
        .dropItem { width: 100%; text-align: left; padding: 10px 12px; border-radius: 10px; border: none; background: transparent; cursor: pointer; font-weight: 900; font-size: 13px; color: #000; opacity: ${loading ? 0.6 : 1}; }
        .dropItem:hover:not(:disabled) { background: rgba(0,0,0,0.06); }
        @media (max-width: 720px) { .scHeader { padding: 8px 10px; gap: 8px; } .left { gap: 8px; } .hotelBtn { font-size: 13px; max-width: 44vw; } .pageTitle { font-size: 10px; max-width: 44vw; } .actionsDesktop { display: none; } .actionsMobile { display: block; } .iconBtn { height: 36px; min-width: 36px; border-radius: 10px; } }
      `}</style>
    </>
  );
}
