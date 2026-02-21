// FILE: app/builder/page.tsx
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
  area_id: string | null;
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

  // Busy states
  const [busyAreaId, setBusyAreaId] = useState<string | null>(null);
  const [busyTemplateId, setBusyTemplateId] = useState<string | null>(null);
  const [busyBulkAreaId, setBusyBulkAreaId] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setError(null);

    try {
      const p = (await requireRoleOrRedirect(router, ["admin", "superadmin"], "/dashboard")) as Profile | null;
      if (!p) {
        setLoading(false);
        return;
      }

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

      // ✅ Orden de áreas: sort_order primero (si existe), luego nombre
      const { data: areasData, error: areasErr } = await supabase
        .from("areas")
        .select("id, name, type, sort_order")
        .eq("hotel_id", hotelIdToUse)
        .order("sort_order", { ascending: true, nullsFirst: false })
        .order("name", { ascending: true });

      if (areasErr) throw areasErr;

      const areasList = (areasData ?? []) as Area[];
      setAreas(areasList);

      if (areasList.length > 0) {
        const areaIds = areasList.map((a) => a.id);

        // ✅ Importante: filtrar por hotel_id para no mezclar
        const { data: templatesData, error: templatesErr } = await supabase
          .from("audit_templates")
          .select("id, name, active, area_id")
          .eq("hotel_id", hotelIdToUse)
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
  }

  useEffect(() => {
    let alive = true;
    (async () => {
      if (!alive) return;
      await load();
    })();

    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router]);

  // ---------- Delete handlers ----------
  async function deleteAuditTemplate(templateId: string, templateName: string) {
    if (!hotelIdInUse) return alert("No hay hotel seleccionado.");

    const ok = confirm(
      `¿Seguro que quieres borrar la auditoría "${templateName}"?\n\nSe eliminarán también sus secciones y preguntas.`
    );
    if (!ok) return;

    setBusyTemplateId(templateId);
    try {
      const { error } = await supabase.rpc("delete_audit_template_cascade", {
        p_template_id: templateId,
        p_hotel_id: hotelIdInUse,
      });

      if (error) throw error;

      alert("Auditoría borrada correctamente.");
      await load();
    } catch (e: any) {
      alert(e?.message ?? "No se pudo borrar la auditoría.");
    } finally {
      setBusyTemplateId(null);
    }
  }

  async function deleteArea(areaId: string, areaName: string) {
    if (!hotelIdInUse) return alert("No hay hotel seleccionado.");

    const ok = confirm(
      `¿Seguro que quieres borrar el área "${areaName}"?\n\nSolo se podrá borrar si no tiene auditorías asociadas.`
    );
    if (!ok) return;

    setBusyAreaId(areaId);
    try {
      const { error } = await supabase.rpc("delete_area_safe", {
        p_area_id: areaId,
        p_hotel_id: hotelIdInUse,
      });

      if (error) throw error;

      alert("Área borrada correctamente.");
      await load();
    } catch (e: any) {
      alert(e?.message ?? "No se pudo borrar el área.");
    } finally {
      setBusyAreaId(null);
    }
  }

  // ✅ Borrar TODAS las auditorías de un área (sección)
  async function deleteAllAuditsInArea(areaId: string, areaName: string, count: number) {
    if (!hotelIdInUse) return alert("No hay hotel seleccionado.");

    if (count === 0) {
      alert("No hay auditorías que borrar en esta área.");
      return;
    }

    const ok1 = confirm(
      `Vas a borrar ${count} auditoría(s) del área "${areaName}".\n\nEsto eliminará también secciones y preguntas.\n\n¿Continuar?`
    );
    if (!ok1) return;

    const ok2 = confirm(`Última confirmación: ¿Borrar TODO en "${areaName}"?`);
    if (!ok2) return;

    setBusyBulkAreaId(areaId);
    try {
      const { error } = await supabase.rpc("delete_audit_templates_by_area_cascade", {
        p_area_id: areaId,
        p_hotel_id: hotelIdInUse,
      });

      if (error) throw error;

      alert("Se borraron todas las auditorías del área.");
      await load();
    } catch (e: any) {
      alert(e?.message ?? "No se pudieron borrar todas las auditorías del área.");
    } finally {
      setBusyBulkAreaId(null);
    }
  }

  // ---------- Styles ----------
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
    whiteSpace: "nowrap",
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
    whiteSpace: "nowrap",
  };

  const btnDanger: React.CSSProperties = {
    padding: "10px 14px",
    borderRadius: 12,
    border: "1px solid rgba(220,0,0,0.35)",
    background: "rgba(220,0,0,0.08)",
    color: "#b00020",
    fontWeight: 950,
    cursor: "pointer",
    fontSize: 14,
    whiteSpace: "nowrap",
  };

  const btnDangerSolid: React.CSSProperties = {
    padding: "10px 14px",
    borderRadius: 12,
    border: "1px solid rgba(220,0,0,0.45)",
    background: "rgba(220,0,0,0.14)",
    color: "#8a0018",
    fontWeight: 1000,
    cursor: "pointer",
    fontSize: 13,
    whiteSpace: "nowrap",
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

      {/* TOP BAR */}
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
          {/* ✅ BOTÓN PARA ORDENAR ÁREAS */}
          <button style={btnWhite} onClick={() => router.push("/areas/order")}>
            Ordenar áreas
          </button>

          <button style={btnWhite} onClick={() => router.push("/dashboard")}>
            ← Atrás
          </button>
        </div>
      </div>

      {/* SECCIÓN 0: BIBLIOTECA DE ESTÁNDARES */}
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

      {/* SECCIÓN 1: GESTIÓN DE ÁREAS */}
      <div style={{ ...card, marginTop: 16 }}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            flexWrap: "wrap",
            gap: 12,
            marginBottom: 16,
          }}
        >
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
                  gap: 12,
                  flexWrap: "wrap",
                }}
              >
                <div>
                  <div style={{ fontWeight: 950, fontSize: 15 }}>{area.name}</div>
                  {area.type && <div style={{ opacity: 0.6, fontSize: 12, marginTop: 2 }}>Tipo: {area.type}</div>}
                </div>

                <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
                  <button onClick={() => router.push(`/areas/${area.id}`)} style={btnWhite}>
                    Editar
                  </button>

                  <button
                    onClick={() => deleteArea(area.id, area.name)}
                    style={{
                      ...btnDanger,
                      opacity: busyAreaId === area.id ? 0.6 : 1,
                      cursor: busyAreaId === area.id ? "not-allowed" : "pointer",
                    }}
                    disabled={busyAreaId === area.id}
                    title="Borrar área (solo si no tiene auditorías)"
                  >
                    {busyAreaId === area.id ? "Borrando…" : "Borrar"}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* SECCIÓN 2: GESTIÓN DE AUDITORÍAS */}
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

                  <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
                    <button
                      onClick={() => router.push(`/builder/new?area_id=${area.id}`)}
                      style={{ ...btnDark, fontSize: 13, padding: "8px 12px" }}
                    >
                      + Nueva Auditoría
                    </button>

                    <button
                      onClick={() => deleteAllAuditsInArea(area.id, area.name, templates.length)}
                      style={{
                        ...btnDangerSolid,
                        opacity: busyBulkAreaId === area.id ? 0.6 : 1,
                        cursor: busyBulkAreaId === area.id ? "not-allowed" : "pointer",
                      }}
                      disabled={busyBulkAreaId === area.id}
                      title="Borra todas las auditorías de esta área (incluye secciones y preguntas)"
                    >
                      {busyBulkAreaId === area.id ? "Borrando todo…" : `Borrar todas (${templates.length})`}
                    </button>
                  </div>
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
                          gap: 12,
                          flexWrap: "wrap",
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
                            <span
                              style={{
                                fontSize: 11,
                                padding: "2px 8px",
                                background: "rgba(0,0,0,0.1)",
                                borderRadius: 6,
                                opacity: 0.7,
                              }}
                            >
                              Inactiva
                            </span>
                          )}
                        </div>

                        <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
                          <button onClick={() => router.push(`/builder/${template.id}`)} style={btnWhite}>
                            Editar
                          </button>

                          <button
                            onClick={() => deleteAuditTemplate(template.id, template.name)}
                            style={{
                              ...btnDanger,
                              opacity: busyTemplateId === template.id ? 0.6 : 1,
                              cursor: busyTemplateId === template.id ? "not-allowed" : "pointer",
                            }}
                            disabled={busyTemplateId === template.id}
                            title="Borrar auditoría (incluye secciones y preguntas)"
                          >
                            {busyTemplateId === template.id ? "Borrando…" : "Borrar"}
                          </button>
                        </div>
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