// app/(app)/admin/page.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import HotelHeader from "@/app/components/HotelHeader";
import { requireRoleOrRedirect, type Profile } from "@/lib/auth/RequireRole";

type QuickLink = {
  title: string;
  description: string;
  href: string;
};

export default function AdminPage() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [error, setError] = useState<string>("");

  const links: QuickLink[] = useMemo(
    () => [
      {
        title: "Gestionar áreas",
        description: "Crea, edita, ordena y administra las áreas del hotel.",
        href: "/admin/areas",
      },
      {
        title: "Crear usuario",
        description: "Da de alta usuarios y asígnales rol y hotel.",
        href: "/admin/create-user",
      },
      {
        title: "Administrar usuarios",
        description: "Gestiona usuarios: desactivar accesos, revisar roles y permisos.",
        href: "/admin/admin-user",
      },
      // Nota: /admin/user-area-access ahora mismo es API (route.ts). Cuando tengas UI, lo activamos.
    ],
    []
  );

  useEffect(() => {
    let mounted = true;

    (async () => {
      setLoading(true);
      setError("");

      const prof = await requireRoleOrRedirect(router, ["admin", "superadmin"], "/login");
      if (!mounted) return;

      setProfile(prof);
      setLoading(false);
    })().catch((e) => {
      console.error(e);
      if (!mounted) return;
      setError("No se pudo cargar el panel de administración.");
      setLoading(false);
    });

    return () => {
      mounted = false;
    };
  }, [router]);

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg)", color: "var(--text)" }}>
      <HotelHeader />

      <div style={{ padding: 24 }}>
        {/* Card principal */}
        <div
          style={{
            background: "var(--card-bg)",
            border: "1px solid var(--border)",
            borderRadius: 16,
            boxShadow: "var(--shadow-sm)",
            padding: 20,
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "flex-start",
              justifyContent: "space-between",
              gap: 12,
              flexWrap: "wrap",
            }}
          >
            <div>
              <div style={{ fontSize: 13, color: "var(--muted)", fontWeight: 700 }}>Panel · Administración</div>

              <h1 style={{ margin: "6px 0 4px", fontSize: 22, fontWeight: 900 }}>Admin del Hotel</h1>

              <p style={{ margin: 0, fontSize: 14, color: "var(--muted)" }}>
                Gestiona usuarios, accesos y configuración del hotel seleccionado.
              </p>
            </div>

            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              <button
                onClick={() => router.push("/dashboard")}
                style={{
                  padding: "10px 14px",
                  borderRadius: 12,
                  border: "1px solid var(--border)",
                  background: "var(--card-bg)",
                  boxShadow: "var(--shadow-sm)",
                  cursor: "pointer",
                  fontWeight: 900,
                }}
              >
                Dashboard
              </button>

              <button
                onClick={() => router.push("/audit")}
                style={{
                  padding: "10px 14px",
                  borderRadius: 12,
                  border: "1px solid var(--border)",
                  background: "var(--card-bg)",
                  boxShadow: "var(--shadow-sm)",
                  cursor: "pointer",
                  fontWeight: 900,
                }}
              >
                Auditar
              </button>

              {/* ✅ acceso directo a áreas admin */}
              <button
                onClick={() => router.push("/admin/areas")}
                style={{
                  padding: "10px 14px",
                  borderRadius: 12,
                  border: "1px solid var(--border)",
                  background: "var(--card-bg)",
                  boxShadow: "var(--shadow-sm)",
                  cursor: "pointer",
                  fontWeight: 900,
                }}
              >
                Áreas
              </button>
            </div>
          </div>

          {/* Estado */}
          <div style={{ marginTop: 14 }}>
            {loading ? (
              <div
                style={{
                  background: "var(--row-bg)",
                  border: "1px solid var(--border)",
                  borderRadius: 12,
                  padding: 12,
                  color: "var(--muted)",
                  fontWeight: 800,
                  fontSize: 13,
                }}
              >
                Cargando perfil…
              </div>
            ) : error ? (
              <div
                style={{
                  background: "rgba(198,40,40,0.08)",
                  border: "1px solid rgba(198,40,40,0.25)",
                  borderRadius: 12,
                  padding: 12,
                  color: "var(--text)",
                  fontWeight: 800,
                  fontSize: 13,
                }}
              >
                {error}
              </div>
            ) : (
              <div
                style={{
                  background: "var(--row-bg)",
                  border: "1px solid var(--border)",
                  borderRadius: 12,
                  padding: 12,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 12,
                  flexWrap: "wrap",
                }}
              >
                <div style={{ fontSize: 14 }}>
                  <span style={{ color: "var(--muted)", fontWeight: 800 }}>Sesión:</span>{" "}
                  <span style={{ fontWeight: 900 }}>{profile?.full_name ? profile.full_name : "Usuario"}</span>{" "}
                  <span style={{ color: "var(--muted)" }}>· rol</span>{" "}
                  <span style={{ fontWeight: 900 }}>{profile?.role}</span>
                </div>

                <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                  <span
                    style={{
                      padding: "6px 10px",
                      borderRadius: 999,
                      border: "1px solid var(--border)",
                      background: "var(--card-bg)",
                      fontSize: 12,
                      fontWeight: 900,
                      color: "var(--muted)",
                    }}
                  >
                    Hotel: Seleccionado
                  </span>

                  <span
                    style={{
                      padding: "6px 10px",
                      borderRadius: 999,
                      border: "1px solid var(--border)",
                      background: "var(--card-bg)",
                      fontSize: 12,
                      fontWeight: 900,
                      color: "var(--muted)",
                    }}
                  >
                    Módulo: Admin
                  </span>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Accesos rápidos */}
        <div style={{ marginTop: 18 }}>
          <div style={{ fontWeight: 900, marginBottom: 10 }}>Accesos rápidos</div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 16 }}>
            {links.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                style={{
                  textDecoration: "none",
                  background: "var(--card-bg)",
                  border: "1px solid var(--border)",
                  borderRadius: 16,
                  boxShadow: "var(--shadow-sm)",
                  padding: 16,
                  display: "block",
                }}
              >
                <div style={{ fontWeight: 900, fontSize: 15 }}>{l.title}</div>
                <div style={{ marginTop: 6, color: "var(--muted)", fontSize: 13, lineHeight: 1.35 }}>
                  {l.description}
                </div>
                <div style={{ marginTop: 10, fontWeight: 900, fontSize: 13 }}>
                  Abrir <span style={{ opacity: 0.7 }}>→</span>
                </div>
              </Link>
            ))}
          </div>
        </div>

        {/* Recomendaciones */}
        <div
          style={{
            marginTop: 16,
            background: "var(--card-bg)",
            border: "1px solid var(--border)",
            borderRadius: 16,
            boxShadow: "var(--shadow-sm)",
            padding: 16,
          }}
        >
          <div style={{ fontWeight: 900, marginBottom: 8 }}>Recomendaciones</div>
          <ul style={{ margin: 0, paddingLeft: 18, color: "var(--muted)", lineHeight: 1.6 }}>
            <li>Evita cuentas compartidas: cada auditor debe tener su usuario.</li>
            <li>Si alguien cambia de área, revisa accesos y permisos.</li>
            <li>Si desactivas un usuario, valida que no tenga auditorías en curso.</li>
          </ul>
        </div>
      </div>
    </div>
  );
}