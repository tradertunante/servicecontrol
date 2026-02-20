// app/builder/page.tsx
"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { requireRoleOrRedirect } from "@/lib/auth/RequireRole";
import HotelHeader from "@/app/components/HotelHeader";

const HOTEL_KEY = "sc_hotel_id";

type Profile = {
  id: string;
  full_name?: string | null;
  role: string;
  hotel_id: string | null;
};

type Area = {
  id: string;
  name: string;
  type: string | null;
};

type AuditTemplate = {
  id: string;
  name: string;
  active: boolean;
  area_id: string;
};

type AreaWithTemplates = {
  area: Area;
  templates: AuditTemplate[];
};

export default function BuilderPage() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [hotelIdInUse, setHotelIdInUse] = useState<string | null>(null);

  const [areas, setAreas] = useState<Area[]>([]);
  const [areaTemplates, setAreaTemplates] = useState<AreaWithTemplates[]>([]);

  useEffect(() => {
    let alive = true;

    (async () => {
      setLoading(true);
      setError(null);

      try {
        const p = (await requireRoleOrRedirect(router, ["admin", "superadmin"], "/dashboard")) as Profile | null;
        if (!alive || !p) return;

        setProfile(p);

        let hotelIdToUse: string | null = null;

        if (p.role === "superadmin") {
          hotelIdToUse = typeof window !== "undefined" ? localStorage.getItem(HOTEL_KEY) : null;

          if (!hotelIdToUse) {
            router.replace("/superadmin/hotels");
            return;
          }
        } else {
          hotelIdToUse = p.hotel_id;

          if (!hotelIdToUse) {
            setError("No tienes un hotel asignado.");
            setLoading(false);
            return;
          }
        }

        setHotelIdInUse(hotelIdToUse);

        const { data: areasData, error: areasErr } = await supabase
          .from("areas")
          .select("id, name, type")
          .eq("hotel_id", hotelIdToUse)
          .order("name", { ascending: true });

        if (areasErr) throw areasErr;

        const areasList = (areasData ?? []) as Area[];
        setAreas(areasList);

        if (areasList.length > 0) {
          const areaIds = areasList.map((a) => a.id);

          const { data: templatesData, error: templatesErr } = await supabase
            .from("audit_templates")
            .select("id, name, active, area_id")
            .in("area_id", areaIds)
            .order("name", { ascending: true });

          if (templatesErr) throw templatesErr;

          const templates = (templatesData ?? []) as AuditTemplate[];

          const grouped = areasList.map((area) => ({
            area,
            templates: templates.filter((t) => t.area_id === area.id),
          }));

          setAreaTemplates(grouped);
        } else {
          setAreaTemplates([]);
        }

        setLoading(false);
      } catch (e: any) {
        setError(e?.message ?? "Error al cargar el builder.");
        setLoading(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, [router]);

  const pageWrap: React.CSSProperties = { padding: 24, paddingTop: 96 };

  const card: React.CSSProperties = {
    borderRadius: 18,
    border: "1px solid rgba(0,0,0,0.08)",
    background: "rgba(255,255,255,0.85)",
    padding: 20,
    boxShadow: "0 10px 30px rgba(0,0,0,0.06)",
  };

  const btnDark: React.CSSProperties = {
    padding: "10px 14px",
    borderRadius: 12,
    border: "1px solid rgba(0,0,0,0.2)",
    background: "#000",
    color: "#fff",
    fontWeight: 900,
    cursor: "pointer",
    fontSize: 14,
  };

  const btnWhite: React.CSSProperties = {
    padding: "10px 14px",
    borderRadius: 12,
    border: "1px solid rgba(0,0,0,0.2)",
    background: "#fff",
    color: "#000",
    fontWeight: 900,
    cursor: "pointer",
    fontSize: 14,
  };

  const pill: React.CSSProperties = {
    padding: "6px 10px",
    borderRadius: 999,
    border: "1px solid rgba(0,0,0,0.12)",
    background: "rgba(0,0,0,0.04)",
    fontWeight: 900,
    fontSize: 12,
  };

  if (loading) {
    return (
      <main style={pageWrap}>
        <HotelHeader />
        <div style={{ opacity: 0.8 }}>Cargando…</div>
      </main>
    );
  }

  if (error) {
    return (
      <main style={pageWrap}>
        <HotelHeader />
        <div style={{ color: "crimson", fontWeight: 900 }}>{error}</div>
      </main>
    );
  }

  return (
    <main style={pageWrap}>
      <HotelHeader />

      {/* ✅ TOP BAR como /areas (título izq + botones der) */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          gap: 16,
          flexWrap: "wrap",
          marginBottom: 14,
        }}
      >
        <div>
          <div style={{ fontSize: 34, fontWeight: 950, letterSpacing: -0.6 }}>Builder</div>
          <div style={{ opacity: 0.7, fontSize: 14, marginTop: 6 }}>
            Hola{profile?.full_name ? `, ${profile.full_name}` : ""}. Configura áreas y auditorías del hotel.
          </div>

          {profile?.role === "superadmin" && hotelIdInUse && (
            <div style={{ marginTop: 10, display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
              <span style={pill}>
                Hotel en uso: <strong>{localStorage.getItem(HOTEL_KEY) ? "Seleccionado" : "—"}</strong>
              </span>
              <span style={{ fontSize: 12, opacity: 0.7 }}>ID: {hotelIdInUse}</span>
              <button
                style={{ ...btnWhite, padding: "8px 10px", fontSize: 12 }}
                onClick={() => {
                  localStorage.removeItem(HOTEL_KEY);
                  router.replace("/superadmin/hotels");
                }}
              >
                Cambiar hotel
              </button>
            </div>
          )}
        </div>

        <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
          <button style={btnWhite} onClick={() => router.push("/dashboard")}>
            ← Atrás
          </button>
        </div>
      </div>

      {/* ✅ SECCIÓN 0: BIBLIOTECA DE ESTÁNDARES */}
      <div style={card}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
          <div>
            <div style={{ fontSize: 20, fontWeight: 950 }}>📚 Biblioteca de Estándares</div>
            <div style={{ opacity: 0.7, fontSize: 13, marginTop: 4 }}>
              Duplica estándares globales a tu hotel y crea auditorías importando plantillas.
            </div>
          </div>

          <button onClick={() => router.push("/standards")} style={btnDark}>
            Abrir biblioteca
          </button>
        </div>
      </div>

      {/* SECCIÓN 1: CREAR ÁREAS */}
      <div style={{ ...card, marginTop: 16 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12, marginBottom: 16 }}>
          <div>
            <div style={{ fontSize: 20, fontWeight: 950 }}>🏢 Gestión de Áreas</div>
            <div style={{ opacity: 0.7, fontSize: 13, marginTop: 4 }}>
              Crea y administra las áreas del hotel (Housekeeping, Restaurantes, etc.)
            </div>
          </div>

          <button onClick={() => router.push("/areas")} style={btnDark}>
            + Nueva Área
          </button>
        </div>

        {areas.length === 0 ? (
          <div style={{ padding: 20, background: "rgba(0,0,0,0.02)", borderRadius: 12, textAlign: "center", opacity: 0.7 }}>
            No hay áreas creadas. Crea tu primera área para empezar.
          </div>
        ) : (
          <div style={{ display: "grid", gap: 10 }}>
            {areas.map((area) => (
              <div
                key={area.id}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  padding: "12px 16px",
                  background: "rgba(0,0,0,0.02)",
                  borderRadius: 12,
                  border: "1px solid rgba(0,0,0,0.06)",
                }}
              >
                <div>
                  <div style={{ fontWeight: 950, fontSize: 15 }}>{area.name}</div>
                  {area.type && <div style={{ opacity: 0.6, fontSize: 12, marginTop: 2 }}>Tipo: {area.type}</div>}
                </div>

                <button onClick={() => router.push(`/areas/${area.id}`)} style={btnWhite}>
                  Editar
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* SECCIÓN 2: CREAR AUDITORÍAS (POR ÁREA) */}
      <div style={{ ...card, marginTop: 16 }}>
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 20, fontWeight: 950 }}>📋 Gestión de Auditorías</div>
          <div style={{ opacity: 0.7, fontSize: 13, marginTop: 4 }}>
            Crea y edita plantillas de auditoría organizadas por área
          </div>
        </div>

        {areaTemplates.length === 0 ? (
          <div style={{ padding: 20, background: "rgba(0,0,0,0.02)", borderRadius: 12, textAlign: "center", opacity: 0.7 }}>
            Primero crea áreas para poder crear auditorías.
          </div>
        ) : (
          <div style={{ display: "grid", gap: 16 }}>
            {areaTemplates.map(({ area, templates }) => (
              <div
                key={area.id}
                style={{
                  padding: 16,
                  background: "rgba(0,0,0,0.02)",
                  borderRadius: 14,
                  border: "1px solid rgba(0,0,0,0.08)",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10, marginBottom: 12 }}>
                  <div style={{ fontSize: 16, fontWeight: 950, opacity: 0.9 }}>{area.name}</div>

                  <button
                    onClick={() => router.push(`/builder/new?area_id=${area.id}`)}
                    style={{ ...btnDark, fontSize: 13, padding: "8px 12px" }}
                  >
                    + Nueva Auditoría
                  </button>
                </div>

                {templates.length === 0 ? (
                  <div style={{ padding: 12, background: "rgba(255,255,255,0.5)", borderRadius: 10, opacity: 0.6, fontSize: 13 }}>
                    No hay auditorías en esta área
                  </div>
                ) : (
                  <div style={{ display: "grid", gap: 8 }}>
                    {templates.map((template) => (
                      <div
                        key={template.id}
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                          padding: "10px 12px",
                          background: "#fff",
                          borderRadius: 10,
                          border: "1px solid rgba(0,0,0,0.06)",
                        }}
                      >
                        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                          <div
                            style={{
                              width: 8,
                              height: 8,
                              borderRadius: "50%",
                              background: template.active ? "#2e7d32" : "#999",
                            }}
                          />
                          <div style={{ fontWeight: 900, fontSize: 14 }}>{template.name}</div>
                          {!template.active && (
                            <span style={{ fontSize: 11, padding: "2px 8px", background: "rgba(0,0,0,0.1)", borderRadius: 6, opacity: 0.7 }}>
                              Inactiva
                            </span>
                          )}
                        </div>

                        <button onClick={() => router.push(`/builder/${template.id}`)} style={btnWhite}>
                          Editar
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}