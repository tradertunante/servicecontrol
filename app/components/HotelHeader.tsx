// app/components/HotelHeader.tsx
"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

type Hotel = {
  id: string;
  name: string;
};

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

export default function HotelHeader() {
  const router = useRouter();
  const pathname = usePathname();
  const [hotelName, setHotelName] = useState<string | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  // Debug: ver qué pathname se está detectando
  useEffect(() => {
    console.log("Current pathname:", pathname);
    console.log("Page title:", getPageTitle(pathname));
  }, [pathname]);

  useEffect(() => {
    (async () => {
      try {
        const {
          data: { user },
          error: userErr,
        } = await supabase.auth.getUser();

        if (userErr || !user) {
          setLoading(false);
          return;
        }

        const { data: profileData, error: profileErr } = await supabase
          .from("profiles")
          .select("hotel_id, role")
          .eq("id", user.id)
          .single();

        if (profileErr || !profileData?.hotel_id) {
          setLoading(false);
          return;
        }

        setProfile({
          role: profileData.role,
          hotel_id: profileData.hotel_id,
        });

        const { data: hotel, error: hotelErr } = await supabase
          .from("hotels")
          .select("name")
          .eq("id", profileData.hotel_id)
          .single();

        if (hotelErr || !hotel) {
          setLoading(false);
          return;
        }

        setHotelName(hotel.name);
        setLoading(false);
      } catch (e) {
        console.error("Error loading header:", e);
        setLoading(false);
      }
    })();
  }, []);

  if (loading || !hotelName) return null;

  const isAdmin = profile?.role === "admin";
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
        background: "rgba(255, 255, 255, 0.95)",
        borderBottom: "1px solid rgba(0, 0, 0, 0.08)",
        boxShadow: "0 2px 8px rgba(0, 0, 0, 0.05)",
        zIndex: 1000,
        backdropFilter: "blur(8px)",
        gap: 16,
      }}
    >
      {/* Nombre del hotel + página actual */}
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <div
          style={{
            fontSize: 14,
            fontWeight: 950,
            opacity: 0.8,
            letterSpacing: "0.3px",
            whiteSpace: "nowrap",
          }}
        >
          {hotelName}
        </div>

        {pageTitle && (
          <>
            <div style={{ opacity: 0.3, fontWeight: 900 }}>·</div>
            <div
              style={{
                fontSize: 13,
                fontWeight: 900,
                opacity: 0.6,
                whiteSpace: "nowrap",
              }}
            >
              {pageTitle}
            </div>
          </>
        )}
      </div>

      {/* Botones de navegación */}
      <div
        style={{
          display: "flex",
          gap: 10,
          alignItems: "center",
        }}
      >
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