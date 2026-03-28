// app/components/HotelHeader.tsx
"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useToast } from "@/app/providers/ToastProvider";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabaseClient";
import { goBackOrFallback } from "@/lib/navigation/clientBack";
import { useProfile } from "@/hooks/useProfile";
import NotificationBell from "./NotificationBell";
import { useHotelId } from "@/hooks/useHotelId";

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

  const { data: profile, isLoading: profileLoading } = useProfile();
  const { data: activeHotelId, isLoading: hotelIdLoading } = useHotelId();

  const { data: hotelName, isLoading: hotelNameLoading } = useQuery({
    queryKey: ["hotel-name", activeHotelId],
    queryFn: async () => {
      const { data, error } = await supabase.from("hotels").select("name").eq("id", activeHotelId!).single();
      if (error || !data) return null;
      return data.name as string;
    },
    enabled: !!activeHotelId,
    staleTime: 10 * 60 * 1000,
  });

  const loading = profileLoading || hotelIdLoading || hotelNameLoading;

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

      // Roles with full area access go straight to the templates selector
      const fullAccessRoles = ["admin", "general_manager", "superadmin", "quality"];
      if (fullAccessRoles.includes(profile?.role ?? "")) {
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
    <div
      ref={headerRef}
      className="fixed top-0 left-0 right-0 bg-white/95 border-b border-black/[0.08] shadow-sm z-[1000] backdrop-blur-md py-2.5 max-[720px]:py-2 px-3.5 max-[720px]:px-2.5"
    >
      <div className="flex justify-between items-center gap-2.5 max-[720px]:gap-2 max-w-[1400px] mx-auto">
      {/* Left */}
      <div className="flex items-center gap-2.5 max-[720px]:gap-2 min-w-0 flex-1">
        {showBack && (
          <button
            className="h-[38px] max-[720px]:h-[36px] min-w-[38px] max-[720px]:min-w-[36px] px-2.5 rounded-xl max-[720px]:rounded-[10px] border border-black/15 bg-white text-black font-black cursor-pointer text-[15px] inline-flex items-center justify-center transition-all hover:bg-black hover:text-white disabled:opacity-60"
            onClick={() => goBackOrFallback(router, backTarget!)}
            aria-label="Atrás"
            title="Atrás"
            disabled={loading}
          >
            ←
          </button>
        )}
        <div className="flex flex-col min-w-0 gap-0.5">
          <button
            onClick={() => navTo(hotelHomeTarget)}
            onMouseEnter={() => setIsHoveringHotel(true)}
            onMouseLeave={() => setIsHoveringHotel(false)}
            className="text-sm max-[720px]:text-[13px] font-black tracking-wide bg-transparent border-none cursor-pointer px-1 py-0.5 rounded-lg transition-all whitespace-nowrap overflow-hidden text-ellipsis min-w-0 max-w-[min(52vw,360px)] max-[720px]:max-w-[44vw]"
            style={{
              opacity: loading ? 0.6 : isHoveringHotel ? 1 : 0.85,
              color: isHoveringHotel ? "#000" : "inherit",
              textDecoration: isHoveringHotel ? "underline" : "none",
            }}
            title={displayHotel}
            aria-label="Ir al inicio del hotel"
            disabled={loading}
          >
            {displayHotel}
          </button>
          {pageTitle && (
            <div className="text-[11px] max-[720px]:text-[10px] font-black opacity-60 whitespace-nowrap overflow-hidden text-ellipsis min-w-0 max-w-[min(52vw,360px)] max-[720px]:max-w-[44vw]">
              {pageTitle}
            </div>
          )}
        </div>
      </div>

      {/* Right */}
      <div className="flex items-center gap-2.5 flex-shrink-0 relative">
        <NotificationBell />
        {/* Desktop actions */}
        <div className="hidden md:flex gap-2.5 items-center">
          {isAdmin && (
            <button
              className="px-3 py-[7px] rounded-[10px] border border-black/15 bg-white text-black font-black cursor-pointer text-[13px] whitespace-nowrap transition-all hover:bg-black hover:text-white disabled:opacity-60"
              onClick={() => navTo("/admin")}
              disabled={loading}
            >
              Admin
            </button>
          )}
          <button
            className="px-3 py-[7px] rounded-[10px] border border-black/15 bg-white text-black font-black cursor-pointer text-[13px] whitespace-nowrap transition-all hover:bg-black hover:text-white disabled:opacity-60"
            onClick={() => void openAuditArea()}
            disabled={loading}
          >
            Auditar
          </button>
          <button
            className="px-3 py-[7px] rounded-[10px] border border-black/15 bg-white text-black font-black cursor-pointer text-[13px] whitespace-nowrap transition-all hover:bg-black hover:text-white disabled:opacity-60"
            onClick={() => navTo("/profile")}
            disabled={loading}
          >
            Perfil
          </button>
        </div>

        {/* Mobile actions */}
        <div className="md:hidden flex relative">
          <button
            className="h-[36px] min-w-[36px] px-2.5 rounded-[10px] border border-black/15 bg-white text-black font-black cursor-pointer text-[15px] inline-flex items-center justify-center transition-all hover:bg-black hover:text-white disabled:opacity-60"
            onClick={() => setMobileMenuOpen((v) => !v)}
            aria-label="Menú"
            title="Menú"
            disabled={loading}
          >
            ☰
          </button>
          {mobileMenuOpen && (
            <div
              className="absolute top-11 right-0 min-w-[170px] bg-white border border-black/[0.12] rounded-xl shadow-xl p-1.5 overflow-hidden z-[2000]"
              role="menu"
              aria-label="Menú de navegación"
            >
              {isAdmin && (
                <button
                  className="w-full text-left px-3 py-2.5 rounded-[10px] border-none bg-transparent cursor-pointer font-black text-[13px] text-black hover:bg-black/[0.06] disabled:opacity-60"
                  onClick={() => navTo("/admin")}
                  disabled={loading}
                >
                  Admin
                </button>
              )}
              <button
                className="w-full text-left px-3 py-2.5 rounded-[10px] border-none bg-transparent cursor-pointer font-black text-[13px] text-black hover:bg-black/[0.06] disabled:opacity-60"
                onClick={() => void openAuditArea()}
                disabled={loading}
              >
                Auditar
              </button>
              <button
                className="w-full text-left px-3 py-2.5 rounded-[10px] border-none bg-transparent cursor-pointer font-black text-[13px] text-black hover:bg-black/[0.06] disabled:opacity-60"
                onClick={() => navTo("/profile")}
                disabled={loading}
              >
                Perfil
              </button>
            </div>
          )}
        </div>
      </div>
      </div>
    </div>
  );
}
