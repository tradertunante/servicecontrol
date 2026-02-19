// app/components/HotelHeader.tsx
"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

type Hotel = { id: string; name: string };

type Profile = {
  role: string;
  hotel_id: string | null;
};

const HOTEL_KEY = "sc_hotel_id";

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

export default function HotelHeader() {
  const router = useRouter();
  const pathname = usePathname();

  const [hotelName, setHotelName] = useState<string | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [isHoveringHotel, setIsHoveringHotel] = useState(false);

  // Relee hotel seleccionado cuando cambias HOTEL_KEY en otra página
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === HOTEL_KEY) {
        // forzamos recarga de header (re-fetch) cambiando estado loading
        setLoading(true);
      }
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  useEffect(() => {
    let alive = true;

    (async () => {
      try {
        setLoading(true);

        const { data: userData, error: userErr } = await supabase.auth.getUser();
        if (!alive) return;

        if (userErr || !userData?.user) {
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
          setLoading(false);
          return;
        }

        const role = String(profileData.role ?? "");
        const prof: Profile = {
          role,
          hotel_id: profileData.hotel_id ?? null,
        };
        setProfile(prof);

        // ✅ HOTEL A MOSTRAR:
        // - superadmin => localStorage sc_hotel_id
        // - resto => profile.hotel_id
        let hotelIdToUse: string | null = null;

        if (role === "superadmin") {
          hotelIdToUse = typeof window !== "undefined" ? localStorage.getItem(HOTEL_KEY) : null;
        } else {
          hotelIdToUse = prof.hotel_id;
        }

        if (!hotelIdToUse) {
          // superadmin aún no seleccionó hotel -> no mostramos header
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
  }, [pathname, loading]); // loading se pone true cuando cambia storage (superadmin)

  if (loading || !hotelName) return null;

  const isAdmin = profile?.role === "admin" || profile?.role === "superadmin";
  const pageTitle = getPageTitle(pathname);

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
        background: "var(--header-bg, rgba(255, 255, 255, 0.92))",
        borderBottom: "1px solid var(--header-border, rgba(0, 0, 0, 0.08))",
        boxShadow: "0 2px 8px rgba(0, 0, 0, 0.05)",
        zIndex: 1000,
        backdropFilter: "blur(8px)",
        gap: 16,
      }}
    >
      {/* Hotel + página */}
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <button
          onClick={() => router.push("/dashboard")}
          onMouseEnter={() => setIsHoveringHotel(true)}
          onMouseLeave={() => setIsHoveringHotel(false)}
          style={{
            fontSize: 14,
            fontWeight: 950,
            opacity: isHoveringHotel ? 1 : 0.8,
            letterSpacing: "0.3px",
            whiteSpace: "nowrap",
            background: "none",
            border: "none",
            cursor: "pointer",
            padding: "4px 8px",
            borderRadius: 8,
            transition: "all 0.2s ease",
            color: isHoveringHotel ? "#000" : "inherit",
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
              border: "1px solid rgba(0, 0, 0, 0.15)",
              background: "#fff",
              color: "#000",
              fontWeight: 900,
              cursor: "pointer",
              fontSize: 13,
              whiteSpace: "nowrap",
              transition: "all 0.2s",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = "#000";
              e.currentTarget.style.color = "#fff";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = "#fff";
              e.currentTarget.style.color = "#000";
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
            border: "1px solid rgba(0, 0, 0, 0.15)",
            background: "#fff",
            color: "#000",
            fontWeight: 900,
            cursor: "pointer",
            fontSize: 13,
            whiteSpace: "nowrap",
            transition: "all 0.2s",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = "#000";
            e.currentTarget.style.color = "#fff";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = "#fff";
            e.currentTarget.style.color = "#000";
          }}
        >
          Auditar
        </button>

        <button
          onClick={() => router.push("/profile")}
          style={{
            padding: "8px 14px",
            borderRadius: 10,
            border: "1px solid rgba(0, 0, 0, 0.15)",
            background: "#fff",
            color: "#000",
            fontWeight: 900,
            cursor: "pointer",
            fontSize: 13,
            whiteSpace: "nowrap",
            transition: "all 0.2s",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = "#000";
            e.currentTarget.style.color = "#fff";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = "#fff";
            e.currentTarget.style.color = "#000";
          }}
        >
          Perfil
        </button>
      </div>
    </div>
  );
}
