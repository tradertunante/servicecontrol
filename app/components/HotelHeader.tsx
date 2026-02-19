"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

type Profile = {
  role: string;
  hotel_id: string;
};

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

  return "";
}

const HOTEL_KEY = "sc_hotel_id";

export default function HotelHeader() {
  const router = useRouter();
  const pathname = usePathname();

  const [hotelName, setHotelName] = useState<string | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [isHoveringHotel, setIsHoveringHotel] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();

        if (!user) {
          setLoading(false);
          return;
        }

        const { data: profileData } = await supabase
          .from("profiles")
          .select("hotel_id, role")
          .eq("id", user.id)
          .single();

        if (!profileData?.hotel_id) {
          setLoading(false);
          return;
        }

        setProfile({
          role: profileData.role,
          hotel_id: profileData.hotel_id,
        });

        // ✅ superadmin: usar hotel guardado
        let hotelIdToUse = profileData.hotel_id;
        if (profileData.role === "superadmin") {
          const stored = localStorage.getItem(HOTEL_KEY);
          if (stored) hotelIdToUse = stored;
        }

        const { data: hotel } = await supabase
          .from("hotels")
          .select("name")
          .eq("id", hotelIdToUse)
          .single();

        if (hotel) setHotelName(hotel.name);

        setLoading(false);
      } catch (e) {
        console.error("Error loading header:", e);
        setLoading(false);
      }
    })();
  }, []);

  if (loading || !hotelName) return null;

  const isAdmin = profile?.role === "admin" || profile?.role === "superadmin";
  const pageTitle = getPageTitle(pathname);

  // ✅ Theme variables
  const fg = "var(--text)";
  const pageBg = "var(--bg)"; // fondo de la página (para hover invertido)
  const inputBg = "var(--input-bg)";
  const inputBorder = "var(--input-border)";

  // ✅ Header specific (nuevo en globals.css)
  const headerBg = "var(--header-bg, rgba(255,255,255,0.75))";
  const headerBorder = "var(--header-border, rgba(0,0,0,0.08))";

  return (
    <div
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        padding: "12px 24px",
        background: headerBg,
        borderBottom: `1px solid ${headerBorder}`,
        boxShadow: "0 2px 10px rgba(0,0,0,0.06)",
        zIndex: 1000,
        gap: 16,
        color: fg,
        backdropFilter: "blur(10px)",
      }}
    >
      {/* Hotel + título */}
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <button
          onClick={() => router.push("/dashboard")}
          onMouseEnter={() => setIsHoveringHotel(true)}
          onMouseLeave={() => setIsHoveringHotel(false)}
          style={{
            fontSize: 14,
            fontWeight: 950,
            opacity: isHoveringHotel ? 1 : 0.85,
            letterSpacing: "0.3px",
            whiteSpace: "nowrap",
            background: "none",
            border: "none",
            cursor: "pointer",
            padding: "4px 8px",
            borderRadius: 8,
            transition: "all 0.2s ease",
            color: fg,
            textDecoration: isHoveringHotel ? "underline" : "none",
          }}
        >
          {hotelName}
        </button>

        {pageTitle && (
          <>
            <div style={{ opacity: 0.3, fontWeight: 900 }}>·</div>
            <div style={{ fontSize: 13, fontWeight: 900, opacity: 0.6, whiteSpace: "nowrap" }}>
              {pageTitle}
            </div>
          </>
        )}
      </div>

      {/* Botones */}
      <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
        {isAdmin && (
          <button
            onClick={() => router.push("/admin")}
            style={{
              padding: "8px 14px",
              borderRadius: 10,
              border: `1px solid ${inputBorder}`,
              background: inputBg,
              color: fg,
              fontWeight: 900,
              cursor: "pointer",
              fontSize: 13,
              whiteSpace: "nowrap",
              transition: "all 0.2s",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = fg;
              e.currentTarget.style.color = pageBg;
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = inputBg;
              e.currentTarget.style.color = fg;
            }}
          >
            Admin
          </button>
        )}

        <button
          onClick={() => router.push("/areas")}
          style={{
            padding: "8px 14px",
            borderRadius: 10,
            border: `1px solid ${inputBorder}`,
            background: inputBg,
            color: fg,
            fontWeight: 900,
            cursor: "pointer",
            fontSize: 13,
            whiteSpace: "nowrap",
            transition: "all 0.2s",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = fg;
            e.currentTarget.style.color = pageBg;
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = inputBg;
            e.currentTarget.style.color = fg;
          }}
        >
          Auditar
        </button>

        <button
          onClick={() => router.push("/profile")}
          style={{
            padding: "8px 14px",
            borderRadius: 10,
            border: `1px solid ${inputBorder}`,
            background: inputBg,
            color: fg,
            fontWeight: 900,
            cursor: "pointer",
            fontSize: 13,
            whiteSpace: "nowrap",
            transition: "all 0.2s",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = fg;
            e.currentTarget.style.color = pageBg;
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = inputBg;
            e.currentTarget.style.color = fg;
          }}
        >
          Perfil
        </button>
      </div>
    </div>
  );
}
