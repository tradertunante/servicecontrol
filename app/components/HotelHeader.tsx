// app/components/HotelHeader.tsx
"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { useToast } from "@/app/providers/ToastProvider";
import { goBackOrFallback } from "@/lib/navigation/clientBack";
import { useProfile } from "@/hooks/useProfile";
import NotificationBell from "./NotificationBell";
import SupportButton from "./SupportButton";
import AppLocaleSwitcher from "./AppLocaleSwitcher";
import { useHotelId } from "@/hooks/useHotelId";
import { ServiceControlIcon } from "./ServiceControlLogo";

function usePageTitle(pathname: string | null): string {
  const t = useTranslations("app.header.pages");
  if (!pathname) return "";
  if (pathname === "/dashboard") return t("dashboard");
  if (pathname === "/admin") return t("admin");
  if (pathname.startsWith("/admin/hotel")) return t("hotelInfo");
  if (pathname === "/areas") return t("areas");
  if (pathname.startsWith("/areas/")) return t("area");
  if (pathname === "/builder") return t("builder");
  if (pathname.startsWith("/builder/")) return t("editor");
  if (pathname.startsWith("/audits/")) {
    if (pathname.includes("/view")) return t("result");
    return t("audit");
  }
  if (pathname === "/users") return t("users");
  if (pathname === "/profile") return t("profile");
  if (pathname.startsWith("/superadmin/hotels")) return t("selectHotel");
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

async function resolveAuditTarget() {
  const res = await fetch("/api/my/area-access");
  const payload = await res.json().catch(() => null);
  if (!res.ok) throw new Error(payload?.error ?? "Error de red.");

  const areaIds: string[] = payload?.areaIds ?? [];

  if (areaIds.length === 0) return null;
  if (areaIds.length === 1) return `/areas/${areaIds[0]}?tab=templates`;
  return "/areas";
}

export default function HotelHeader() {
  const router = useRouter();
  const toast = useToast();
  const pathname = usePathname();
  const headerRef = useRef<HTMLDivElement | null>(null);
  const t = useTranslations("app.header");

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

  const pageTitle = usePageTitle(pathname);

  const { data: sessionData, isLoading: sessionLoading } = useHotelId();
  const role = sessionData?.role ?? null;
  const hotelName = sessionData?.hotelName ?? null;

  const { data: profile } = useProfile();

  const loading = sessionLoading;

  const isAdmin = (role === "admin" || role === "superadmin") || (profile?.role === "admin" || profile?.role === "superadmin");
  const displayHotel = hotelName ?? (loading ? t("loadingHotel") : t("selectHotel"));
  const backTarget = getBackTarget(pathname);
  const showBack = Boolean(backTarget);
  const navTo = (path: string) => { router.push(path); };
  const hotelHomeTarget = role === "manager" ? "/team/general" : "/home";

  const openAuditArea = async () => {
    try {
      if (role === "manager") { router.push("/team/templates"); return; }
      const fullAccessRoles = ["admin", "general_manager", "superadmin", "quality"];
      if (fullAccessRoles.includes(role ?? "")) { router.push("/team/templates"); return; }
      const target = await resolveAuditTarget();
      if (!target) { toast.warn("No tienes ningún área asignada para auditar."); return; }
      router.push(target);
    } catch {
      toast.error("No se pudo abrir el área de auditoría.");
    }
  };

  return (
    <header
      ref={headerRef}
      data-onboarding="header"
      className="fixed top-0 left-0 right-0 z-[1000] bg-[#0C1F44] border-b border-white/10"
      style={{ height: 56 }}
    >
      <div className="h-full flex items-center justify-between gap-4 max-w-[1400px] mx-auto px-5 max-[720px]:px-3">

        {/* Left — logo · hotel · breadcrumb */}
        <div className="flex items-center gap-3 min-w-0 flex-1">

          {/* Back button */}
          {showBack && (
            <button
              onClick={() => goBackOrFallback(router, backTarget!)}
              disabled={loading}
              aria-label={t("back")}
              className="flex-shrink-0 w-8 h-8 flex items-center justify-center rounded-lg text-white/60 hover:text-white hover:bg-white/10 transition-colors disabled:opacity-40"
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M10 12L6 8l4-4" />
              </svg>
            </button>
          )}

          {/* Wordmark */}
          <button
            onClick={() => navTo(hotelHomeTarget)}
            disabled={loading}
            aria-label={t("home")}
            className="flex-shrink-0 flex items-center justify-center w-7 h-7 rounded-md disabled:opacity-40"
          >
            <ServiceControlIcon variant="light" size={28} />
          </button>

          {/* Divider */}
          <span className="flex-shrink-0 w-px h-4 bg-white/20" aria-hidden />

          {/* Hotel name + page */}
          <div className="flex items-baseline gap-2 min-w-0">
            <button
              onClick={() => navTo(hotelHomeTarget)}
              disabled={loading}
              title={displayHotel}
              className="text-[13.5px] font-semibold text-white hover:text-white/80 bg-transparent border-none cursor-pointer truncate max-w-[min(48vw,320px)] max-[720px]:max-w-[38vw] transition-colors disabled:opacity-50"
            >
              {displayHotel}
            </button>
            {pageTitle && (
              <>
                <span className="flex-shrink-0 text-white/30 text-[13px] select-none">/</span>
                <span className="text-[13px] text-white/50 font-medium truncate max-w-[120px]">
                  {pageTitle}
                </span>
              </>
            )}
          </div>
        </div>

        {/* Right — actions */}
        <div className="flex items-center gap-1.5 flex-shrink-0" data-onboarding="header-actions">
          <SupportButton />
          <NotificationBell />

          {/* Desktop */}
          <nav className="hidden md:flex items-center gap-1 ml-1">
            <AppLocaleSwitcher />
            <a
              href="/help"
              className="px-3 h-8 rounded-lg text-[13px] font-medium text-white/70 hover:text-white hover:bg-white/10 transition-colors flex items-center"
            >
              Ayuda
            </a>
            {isAdmin && (
              <button
                onClick={() => navTo("/admin")}
                disabled={loading}
                className="px-3 h-8 rounded-lg text-[13px] font-medium text-white/70 hover:text-white hover:bg-white/10 transition-colors disabled:opacity-40"
              >
                {t("pages.admin")}
              </button>
            )}
            <button
              onClick={() => void openAuditArea()}
              disabled={loading}
              className="px-3 h-8 rounded-lg text-[13px] font-medium text-white/70 hover:text-white hover:bg-white/10 transition-colors disabled:opacity-40"
            >
              {t("audit")}
            </button>
            <button
              onClick={() => navTo("/profile")}
              disabled={loading}
              className="ml-0.5 px-3 h-8 rounded-[6px] text-[13px] font-medium text-white bg-[#185FA5] hover:bg-[#378ADD] transition-colors disabled:opacity-40"
            >
              {t("profile")}
            </button>
          </nav>

          {/* Mobile */}
          <div className="md:hidden relative">
            <button
              onClick={() => setMobileMenuOpen((v) => !v)}
              disabled={loading}
              aria-label={t("menu")}
              className="w-8 h-8 flex items-center justify-center rounded-lg text-white/60 hover:text-white hover:bg-white/10 transition-colors disabled:opacity-40"
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round">
                <path d="M2 4h12M2 8h12M2 12h12" />
              </svg>
            </button>

            {mobileMenuOpen && (
              <div
                role="menu"
                aria-label={t("navMenu")}
                className="absolute top-10 right-0 min-w-[160px] bg-white border border-[#D3D1C7] rounded-xl shadow-lg py-1 z-[2000]"
              >
                <div className="px-4 py-2">
                  <AppLocaleSwitcher />
                </div>
                <a
                  href="/help"
                  className="block w-full text-left px-4 py-2.5 text-[13px] font-medium text-[#0C1F44] hover:bg-[#F4F7FB] transition-colors"
                >
                  Ayuda
                </a>
                {isAdmin && (
                  <button
                    onClick={() => navTo("/admin")}
                    disabled={loading}
                    className="w-full text-left px-4 py-2.5 text-[13px] font-medium text-[#0C1F44] hover:bg-[#F4F7FB] transition-colors disabled:opacity-40"
                  >
                    {t("pages.admin")}
                  </button>
                )}
                <button
                  onClick={() => void openAuditArea()}
                  disabled={loading}
                  className="w-full text-left px-4 py-2.5 text-[13px] font-medium text-[#0C1F44] hover:bg-[#F4F7FB] transition-colors disabled:opacity-40"
                >
                  {t("audit")}
                </button>
                <button
                  onClick={() => navTo("/profile")}
                  disabled={loading}
                  className="w-full text-left px-4 py-2.5 text-[13px] font-medium text-[#0C1F44] hover:bg-[#F4F7FB] transition-colors disabled:opacity-40"
                >
                  {t("profile")}
                </button>
              </div>
            )}
          </div>
        </div>

      </div>
    </header>
  );
}
