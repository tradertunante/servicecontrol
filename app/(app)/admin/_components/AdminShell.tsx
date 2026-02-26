"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import dynamic from "next/dynamic";
import HotelHeader from "@/app/components/HotelHeader";
import { requireRoleOrRedirect, type Profile } from "@/lib/auth/RequireRole";
import AdminNav from "./AdminNav";

type TabKey = "hotel" | "areas" | "users" | "access";

// Lazy-load: no cargas Users/Areas/etc hasta que toque
const UsersModule = dynamic(() => import("../_modules/users/UsersModule"), { ssr: false });
const AreasModule = dynamic(() => import("../_modules/areas/AreasModule"), { ssr: false });
const HotelModule = dynamic(() => import("../_modules/hotel/HotelModule"), { ssr: false });
const AccessModule = dynamic(() => import("../_modules/access/UserAreaAccessModule"), { ssr: false });

export default function AdminShell() {
  const router = useRouter();
  const sp = useSearchParams();
  const tab = (sp.get("tab") as TabKey) || "users";

  const [booting, setBooting] = useState(true);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [error, setError] = useState("");

  // Gate permisos (UNA sola vez)
  useEffect(() => {
    let mounted = true;
    (async () => {
      setBooting(true);
      setError("");
      const prof = await requireRoleOrRedirect(router, ["admin", "superadmin"], "/login");
      if (!mounted) return;
      setProfile(prof);
      setBooting(false);
    })().catch((e) => {
      console.error(e);
      if (!mounted) return;
      setError("No se pudo cargar permisos del panel Admin.");
      setBooting(false);
    });

    return () => {
      mounted = false;
    };
  }, [router]);

  const title = useMemo(() => {
    if (tab === "hotel") return "Info del hotel";
    if (tab === "areas") return "Departamentos";
    if (tab === "users") return "Usuarios";
    if (tab === "access") return "Accesos por área";
    return "Admin";
  }, [tab]);

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg)", color: "var(--text)" }}>
      <HotelHeader />

      <div style={{ padding: 24 }}>
        {/* Shell layout: sidebar + main */}
        <div style={{ display: "flex", gap: 18, alignItems: "flex-start", flexWrap: "wrap" }}>
          {/* Sidebar */}
          <div
            style={{
              width: 320,
              flexShrink: 0,
              background: "var(--card-bg)",
              border: "1px solid var(--border)",
              borderRadius: 16,
              boxShadow: "var(--shadow-sm)",
              padding: 16,
            }}
          >
            <div style={{ fontSize: 28, fontWeight: 900, lineHeight: 1.05 }}>Panel de control</div>
            <div style={{ marginTop: 6, fontSize: 13, color: "var(--muted)", fontWeight: 800 }}>
              {booting ? (
                "Cargando permisos…"
              ) : error ? (
                error
              ) : (
                <>
                  Sesión: <span style={{ fontWeight: 900 }}>{profile?.full_name ?? "Usuario"}</span>{" "}
                  · rol <span style={{ fontWeight: 900 }}>{profile?.role}</span>
                </>
              )}
            </div>

            <div style={{ marginTop: 14 }}>
              <AdminNav activeTab={tab} />
            </div>
          </div>

          {/* Main */}
          <div style={{ flex: 1, minWidth: 360 }}>
            <div
              style={{
                background: "var(--card-bg)",
                border: "1px solid var(--border)",
                borderRadius: 16,
                boxShadow: "var(--shadow-sm)",
                padding: 18,
              }}
            >
              <div style={{ fontSize: 13, color: "var(--muted)", fontWeight: 800 }}>Panel · Administración</div>
              <h1 style={{ margin: "6px 0 0", fontSize: 32, fontWeight: 900 }}>{title}</h1>
              <div style={{ marginTop: 8, color: "var(--muted)", fontSize: 13 }}>
                Todo se gestiona en esta misma ventana. Cada bloque es un módulo independiente.
              </div>

              <div style={{ marginTop: 16 }}>
                {booting ? (
                  <div style={{ fontWeight: 900 }}>Cargando…</div>
                ) : error ? (
                  <div
                    style={{
                      padding: 12,
                      borderRadius: 12,
                      border: "1px solid rgba(220,0,0,0.35)",
                      background: "rgba(220,0,0,0.06)",
                      color: "crimson",
                      fontWeight: 900,
                    }}
                  >
                    {error}
                  </div>
                ) : (
                  <>
                    {tab === "users" && <UsersModule />}
                    {tab === "areas" && <AreasModule />}
                    {tab === "hotel" && <HotelModule />}
                    {tab === "access" && <AccessModule />}
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}