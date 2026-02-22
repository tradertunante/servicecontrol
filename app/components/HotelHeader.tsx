// app/components/HotelHeader.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

type Profile = {
  role: string;
  hotel_id: string | null;
};

const HOTEL_KEY = "sc_hotel_id";
const HOTEL_CHANGED_EVENT = "sc-hotel-changed";

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

// Decide si mostrar back y a dónde ir (no router.back)
function getBackTarget(pathname: string | null): string | null {
  if (!pathname) return null;

  // Raíces: no back
  const roots = new Set([
    "/dashboard",
    "/admin",
    "/areas",
    "/builder",
    "/profile",
    "/users",
    "/superadmin",
    "/superadmin/hotels",
  ]);
  if (roots.has(pathname)) return null;

  // Jerarquía típica
  if (pathname.startsWith("/areas/")) return "/areas";
  if (pathname.startsWith("/builder/")) return "/builder";
  if (pathname.startsWith("/admin/hotel")) return "/admin";
  if (pathname.startsWith("/audits/")) return "/areas"; // o "/dashboard" si prefieres

  // Default seguro
  return "/dashboard";
}

export default function HotelHeader() {
  const router = useRouter();
  const pathname = usePathname();

  const [hotelName, setHotelName] = useState<string | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [isHoveringHotel, setIsHoveringHotel] = useState(false);

  const [lsHotelId, setLsHotelId] = useState<string | null>(null);

  // Menú móvil
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    const onDocClick = () => setMobileMenuOpen(false);
    document.addEventListener("click", onDocClick);
    return () => document.removeEventListener("click", onDocClick);
  }, []);

  useEffect(() => {
    setMobileMenuOpen(false); // cambia ruta => cierra menú
  }, [pathname]);

  // Inicializa y detecta cambios de hotel
  useEffect(() => {
    const read = () => {
      try {
        const v = localStorage.getItem(HOTEL_KEY);
        setLsHotelId(v || null);
      } catch {
        setLsHotelId(null);
      }
    };

    read();

    const onStorage = (e: StorageEvent) => {
      if (e.key === HOTEL_KEY) read();
    };
    const onCustom = () => read();

    window.addEventListener("storage", onStorage);
    window.addEventListener(HOTEL_CHANGED_EVENT, onCustom as EventListener);

    const t = window.setInterval(() => {
      try {
        const v = localStorage.getItem(HOTEL_KEY);
        const next = v || null;
        setLsHotelId((prev) => (prev === next ? prev : next));
      } catch {}
    }, 800);

    return () => {
      window.removeEventListener("storage", onStorage);
      window.removeEventListener(HOTEL_CHANGED_EVENT, onCustom as EventListener);
      window.clearInterval(t);
    };
  }, []);

  const pageTitle = useMemo(() => getPageTitle(pathname), [pathname]);

  useEffect(() => {
    let alive = true;

    (async () => {
      try {
        setLoading(true);

        const { data: userData, error: userErr } = await supabase.auth.getUser();
        if (!alive) return;

        if (userErr || !userData?.user) {
          setProfile(null);
          setHotelName(null);
          setLoading(false);
          return;
        }

        const uid = userData.user.id;

        const { data: profileData, error: profileErr } = await supabase
          .from("profiles")
          .select("hotel_id, role")
          .eq("id", uid)
          .single();

        if (!alive) return;

        if (profileErr || !profileData) {
          setProfile(null);
          setHotelName(null);
          setLoading(false);
          return;
        }

        const role = String(profileData.role ?? "");
        const prof: Profile = {
          role,
          hotel_id: profileData.hotel_id ?? null,
        };
        setProfile(prof);

        const hotelIdToUse =
          role === "superadmin" ? (lsHotelId ?? null) : (prof.hotel_id ?? null);

        if (!hotelIdToUse) {
          setHotelName(null);
          setLoading(false);
          return;
        }

        const { data: hotel, error: hotelErr } = await supabase
          .from("hotels")
          .select("name")
          .eq("id", hotelIdToUse)
          .single();

        if (!alive) return;

        if (hotelErr || !hotel) {
          setHotelName(null);
          setLoading(false);
          return;
        }

        setHotelName(hotel.name);
        setLoading(false);
      } catch (e) {
        if (!alive) return;
        console.error("Error loading header:", e);
        setLoading(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, [pathname, lsHotelId]);

  const isAdmin = profile?.role === "admin" || profile?.role === "superadmin";
  const displayHotel = hotelName ?? (loading ? "Cargando…" : "Selecciona hotel");

  const backTarget = getBackTarget(pathname);
  const showBack = Boolean(backTarget);

  const navTo = (path: string) => {
    router.push(path);
  };

  return (
    <>
      <div className="scHeader">
        <div className="left">
          {showBack && (
            <button
              className="iconBtn"
              onClick={(e) => {
                e.stopPropagation();
                navTo(backTarget!);
              }}
              aria-label="Atrás"
              title="Atrás"
            >
              ←
            </button>
          )}

          <div className="titleBlock">
            <button
              onClick={() => navTo("/dashboard")}
              onMouseEnter={() => setIsHoveringHotel(true)}
              onMouseLeave={() => setIsHoveringHotel(false)}
              className="hotelBtn"
              title={displayHotel}
              aria-label="Ir a dashboard"
            >
              {displayHotel}
            </button>

            {pageTitle && <div className="pageTitle">{pageTitle}</div>}
          </div>
        </div>

        <div className="right">
          {/* Desktop actions */}
          <div className="actionsDesktop">
            {isAdmin && (
              <button className="pillBtn" onClick={() => navTo("/admin")} disabled={loading}>
                Admin
              </button>
            )}
            <button className="pillBtn" onClick={() => navTo("/areas")} disabled={loading}>
              Auditar
            </button>
            <button className="pillBtn" onClick={() => navTo("/profile")} disabled={loading}>
              Perfil
            </button>
          </div>

          {/* Mobile menu */}
          <div className="actionsMobile">
            <button
              className="iconBtn"
              onClick={(e) => {
                e.stopPropagation();
                setMobileMenuOpen((v) => !v);
              }}
              aria-label="Menú"
              title="Menú"
            >
              ☰
            </button>

            {mobileMenuOpen && (
              <div
                className="dropdown"
                onClick={(e) => e.stopPropagation()}
                role="menu"
                aria-label="Menú de navegación"
              >
                {isAdmin && (
                  <button className="dropItem" onClick={() => navTo("/admin")} disabled={loading}>
                    Admin
                  </button>
                )}
                <button className="dropItem" onClick={() => navTo("/areas")} disabled={loading}>
                  Auditar
                </button>
                <button className="dropItem" onClick={() => navTo("/profile")} disabled={loading}>
                  Perfil
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Estilos responsive (sin maxWidth que estreche pantalla) */}
      <style jsx>{`
        .scHeader {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          z-index: 1000;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          padding: 12px 16px;
          background: var(--header-bg, rgba(255, 255, 255, 0.92));
          border-bottom: 1px solid var(--header-border, rgba(0, 0, 0, 0.08));
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05);
          backdrop-filter: blur(8px);
        }

        .left {
          display: flex;
          align-items: center;
          gap: 10px;
          min-width: 0;
          flex: 1;
        }

        .titleBlock {
          display: flex;
          flex-direction: column;
          min-width: 0;
          gap: 2px;
        }

        .hotelBtn {
          font-size: 14px;
          font-weight: 950;
          letter-spacing: 0.3px;
          background: none;
          border: none;
          cursor: pointer;
          padding: 4px 6px;
          border-radius: 8px;
          opacity: ${loading ? 0.6 : isHoveringHotel ? 1 : 0.85};
          text-decoration: ${isHoveringHotel ? "underline" : "none"};
          color: ${isHoveringHotel ? "#000" : "inherit"};
          transition: all 0.2s ease;

          /* Elipsis sin maxWidth fijo */
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          min-width: 0;
        }

        .pageTitle {
          font-size: 12px;
          font-weight: 900;
          opacity: 0.6;

          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          min-width: 0;
        }

        .right {
          display: flex;
          align-items: center;
          gap: 10px;
          flex-shrink: 0;
          position: relative;
        }

        .actionsDesktop {
          display: flex;
          align-items: center;
          gap: 10px;
        }

        .actionsMobile {
          display: none;
          position: relative;
        }

        .pillBtn {
          padding: 8px 14px;
          border-radius: 10px;
          border: 1px solid rgba(0, 0, 0, 0.15);
          background: #fff;
          color: #000;
          font-weight: 900;
          cursor: pointer;
          font-size: 13px;
          white-space: nowrap;
          transition: all 0.2s;
          opacity: ${loading ? 0.6 : 1};
        }

        .pillBtn:hover:not(:disabled) {
          background: #000;
          color: #fff;
        }

        .iconBtn {
          height: 40px;
          min-width: 40px;
          padding: 0 10px;
          border-radius: 10px;
          border: 1px solid rgba(0, 0, 0, 0.15);
          background: #fff;
          color: #000;
          font-weight: 900;
          cursor: pointer;
          font-size: 16px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          transition: all 0.2s;
        }

        .iconBtn:hover {
          background: #000;
          color: #fff;
        }

        .dropdown {
          position: absolute;
          top: 46px;
          right: 0;
          min-width: 180px;
          background: #fff;
          border: 1px solid rgba(0, 0, 0, 0.12);
          border-radius: 12px;
          box-shadow: 0 14px 40px rgba(0, 0, 0, 0.12);
          padding: 6px;
          overflow: hidden;
        }

        .dropItem {
          width: 100%;
          text-align: left;
          padding: 10px 12px;
          border-radius: 10px;
          border: none;
          background: transparent;
          cursor: pointer;
          font-weight: 900;
          font-size: 13px;
          color: #000;
          opacity: ${loading ? 0.6 : 1};
        }

        .dropItem:hover:not(:disabled) {
          background: rgba(0, 0, 0, 0.06);
        }

        /* Breakpoint móvil */
        @media (max-width: 720px) {
          .scHeader {
            padding: 10px 12px;
          }
          .actionsDesktop {
            display: none;
          }
          .actionsMobile {
            display: block;
          }
          .hotelBtn {
            padding: 4px 4px;
          }
        }
      `}</style>
    </>
  );
}