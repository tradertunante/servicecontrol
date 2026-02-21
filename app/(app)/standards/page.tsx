// app/standards/page.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { requireRoleOrRedirect } from "@/lib/auth/RequireRole";
import HotelHeader from "@/app/components/HotelHeader";
import BackButton from "@/app/components/BackButton";

const HOTEL_KEY = "sc_hotel_id";

type Profile = {
  id: string;
  role: string;
  hotel_id: string | null;
};

type GlobalPack = {
  id: string;
  business_type: string;
  name: string;
  description: string | null;
  active: boolean;
  created_at?: string | null;
};

type Area = {
  id: string;
  name: string;
  type: string | null;
};

type HotelTemplate = {
  id: string;
  name: string;
  active: boolean | null;
  hotel_id: string | null;
  pack_id: string | null;
  area_id: string | null;
  source_template_id: string | null;
};

export default function StandardsPage() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [profile, setProfile] = useState<Profile | null>(null);
  const [hotelIdInUse, setHotelIdInUse] = useState<string | null>(null);

  const [globalPacks, setGlobalPacks] = useState<GlobalPack[]>([]);
  const [busyPackId, setBusyPackId] = useState<string | null>(null);

  const [areas, setAreas] = useState<Area[]>([]);
  const [hotelTemplates, setHotelTemplates] = useState<HotelTemplate[]>([]);
  const [savingTemplateId, setSavingTemplateId] = useState<string | null>(null);

  const card: React.CSSProperties = {
    borderRadius: 18,
    border: "1px solid rgba(0,0,0,0.08)",
    background: "rgba(255,255,255,0.85)",
    padding: 20,
    boxShadow: "0 10px 30px rgba(0,0,0,0.06)",
  };

  const row: React.CSSProperties = {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "12px 14px",
    background: "rgba(0,0,0,0.02)",
    borderRadius: 12,
    border: "1px solid rgba(0,0,0,0.06)",
    gap: 12,
    flexWrap: "wrap",
  };

  const btn: React.CSSProperties = {
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

  const subtitle: React.CSSProperties = {
    opacity: 0.75,
    fontSize: 13,
    marginTop: 6,
  };

  async function loadAll(hotelIdToUse: string) {
    // Packs globales
    const { data: packs, error: packErr } = await supabase
      .from("global_audit_packs")
      .select("id, business_type, name, description, active, created_at")
      .eq("active", true)
      .eq("business_type", "hotel")
      .order("created_at", { ascending: false });

    if (packErr) throw packErr;
    setGlobalPacks((packs ?? []) as GlobalPack[]);

    // Áreas del hotel
    const { data: aData, error: aErr } = await supabase
      .from("areas")
      .select("id, name, type")
      .eq("hotel_id", hotelIdToUse)
      .order("name", { ascending: true });

    if (aErr) throw aErr;
    setAreas((aData ?? []) as Area[]);

    // Templates del hotel que vienen de packs (lo importado)
    const { data: tData, error: tErr } = await supabase
      .from("audit_templates")
      .select("id, name, active, hotel_id, pack_id, area_id, source_template_id")
      .eq("hotel_id", hotelIdToUse)
      .not("pack_id", "is", null)
      .order("name", { ascending: true });

    if (tErr) throw tErr;
    setHotelTemplates((tData ?? []) as HotelTemplate[]);
  }

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

        await loadAll(hotelIdToUse);

        setLoading(false);
      } catch (e: any) {
        setError(e?.message ?? "Error al cargar la biblioteca.");
        setLoading(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, [router]);

  const hotelBadge = useMemo(() => {
    if (!profile || profile.role !== "superadmin") return null;
    if (!hotelIdInUse) return null;

    return (
      <div style={{ marginBottom: 16, display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
        <span
          style={{
            padding: "6px 10px",
            borderRadius: 999,
            border: "1px solid rgba(0,0,0,0.12)",
            background: "rgba(0,0,0,0.04)",
            fontWeight: 900,
            fontSize: 12,
          }}
        >
          Hotel en uso: <strong>{localStorage.getItem(HOTEL_KEY) ? "Seleccionado" : "—"}</strong>
        </span>

        <span style={{ fontSize: 12, opacity: 0.7 }}>ID: {hotelIdInUse}</span>

        <button
          style={{
            padding: "8px 10px",
            borderRadius: 10,
            border: "1px solid rgba(0,0,0,0.15)",
            background: "#fff",
            fontWeight: 900,
            cursor: "pointer",
            fontSize: 12,
          }}
          onClick={() => {
            localStorage.removeItem(HOTEL_KEY);
            router.replace("/superadmin/hotels");
          }}
        >
          Cambiar hotel
        </button>
      </div>
    );
  }, [profile, hotelIdInUse, router]);

  const duplicatePackToHotel = async (packId: string) => {
    if (!hotelIdInUse) return alert("No hay hotel seleccionado.");

    setBusyPackId(packId);
    try {
      const { error } = await supabase.rpc("clone_global_audit_pack_to_hotel", {
        p_pack_id: packId,
        p_target_hotel_id: hotelIdInUse,
      });
      if (error) throw error;

      alert("Pack duplicado correctamente en el hotel.");
      await loadAll(hotelIdInUse);
    } catch (e: any) {
      alert(e?.message ?? "No se pudo duplicar el pack.");
    } finally {
      setBusyPackId(null);
    }
  };

  const setTemplateArea = async (templateId: string, areaId: string | null) => {
    if (!hotelIdInUse) return;

    setSavingTemplateId(templateId);
    try {
      const { error } = await supabase
        .from("audit_templates")
        .update({ area_id: areaId })
        .eq("id", templateId)
        .eq("hotel_id", hotelIdInUse);

      if (error) throw error;

      await loadAll(hotelIdInUse);
    } catch (e: any) {
      alert(e?.message ?? "No se pudo asignar el área.");
    } finally {
      setSavingTemplateId(null);
    }
  };

  const templatesByPack = useMemo(() => {
    const map = new Map<string, HotelTemplate[]>();
    for (const t of hotelTemplates) {
      const k = t.pack_id ?? "—";
      if (!map.has(k)) map.set(k, []);
      map.get(k)!.push(t);
    }
    return map;
  }, [hotelTemplates]);

  const areaName = useMemo(() => {
    const m = new Map<string, string>();
    for (const a of areas) m.set(a.id, a.name);
    return m;
  }, [areas]);

  if (loading) {
    return (
      <main style={{ padding: 24, paddingTop: 80 }}>
        <HotelHeader />
        <BackButton fallback="/builder" />
        <div style={{ opacity: 0.8 }}>Cargando…</div>
      </main>
    );
  }

  if (error) {
    return (
      <main style={{ padding: 24, paddingTop: 80 }}>
        <HotelHeader />
        <BackButton fallback="/builder" />
        <div style={{ color: "crimson", fontWeight: 900 }}>{error}</div>
      </main>
    );
  }

  return (
    <main style={{ padding: 24, paddingTop: 80 }}>
      <HotelHeader />
      <BackButton fallback="/builder" />

      <div style={{ marginBottom: 14 }}>
        <div style={{ fontSize: 30, fontWeight: 950, letterSpacing: -0.3 }}>📚 Biblioteca de Estándares</div>
        <div style={{ opacity: 0.75, marginTop: 6 }}>Importa packs globales y asigna cada auditoría a un área del hotel.</div>
      </div>

      {hotelBadge}

      <div style={{ display: "grid", gap: 16 }}>
        {/* Packs globales */}
        <div style={card}>
          <div style={{ fontSize: 18, fontWeight: 950, marginBottom: 12 }}>🌍 Packs Globales</div>

          {globalPacks.length === 0 ? (
            <div style={{ opacity: 0.7 }}>No hay packs globales activos para Hotel.</div>
          ) : (
            <div style={{ display: "grid", gap: 10 }}>
              {globalPacks.map((p) => (
                <div key={p.id} style={row}>
                  <div style={{ minWidth: 260 }}>
                    <div style={{ fontWeight: 950 }}>{p.name}</div>
                    <div style={subtitle}>
                      Tipo: {p.business_type} {p.description ? `· ${p.description}` : ""}
                    </div>
                    <div style={{ fontSize: 12, opacity: 0.65, marginTop: 6 }}>ID: {p.id}</div>
                  </div>

                  <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
                    <button style={btnWhite} onClick={() => router.push(`/superadmin/global-audits/${p.id}`)}>
                      Ver (admin)
                    </button>

                    <button
                      style={{ ...btn, opacity: busyPackId === p.id ? 0.7 : 1, cursor: busyPackId === p.id ? "not-allowed" : "pointer" }}
                      onClick={() => duplicatePackToHotel(p.id)}
                      disabled={busyPackId === p.id}
                    >
                      {busyPackId === p.id ? "Duplicando…" : "Duplicar pack a mi hotel"}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* En mi hotel */}
        <div style={card}>
          <div style={{ fontSize: 18, fontWeight: 950, marginBottom: 8 }}>🏨 En mi hotel</div>
          <div style={{ opacity: 0.75, fontSize: 13, marginBottom: 12 }}>
            Aquí ves lo importado. Asigna un área a cada auditoría para que aparezca en el Builder.
          </div>

          {hotelTemplates.length === 0 ? (
            <div style={{ opacity: 0.7 }}>Aún no hay auditorías importadas desde packs.</div>
          ) : (
            <div style={{ display: "grid", gap: 14 }}>
              {Array.from(templatesByPack.entries()).map(([packId, templates]) => {
                const packName = globalPacks.find((p) => p.id === packId)?.name ?? `Pack ${packId}`;
                return (
                  <div
                    key={packId}
                    style={{
                      padding: 14,
                      borderRadius: 14,
                      border: "1px solid rgba(0,0,0,0.08)",
                      background: "rgba(0,0,0,0.02)",
                    }}
                  >
                    <div style={{ fontWeight: 950, marginBottom: 10 }}>{packName}</div>

                    <div style={{ display: "grid", gap: 8 }}>
                      {templates.map((t) => (
                        <div key={t.id} style={row}>
                          <div style={{ minWidth: 260 }}>
                            <div style={{ fontWeight: 950 }}>{t.name}</div>
                            <div style={subtitle}>
                              Área: {t.area_id ? areaName.get(t.area_id) ?? "—" : "Sin asignar"}
                            </div>
                          </div>

                          <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
                            <select
                              value={t.area_id ?? ""}
                              onChange={(e) => setTemplateArea(t.id, e.target.value ? e.target.value : null)}
                              style={{
                                padding: "10px 12px",
                                borderRadius: 12,
                                border: "1px solid rgba(0,0,0,0.18)",
                                background: "#fff",
                                fontWeight: 900,
                                height: 42,
                                minWidth: 220,
                              }}
                              disabled={savingTemplateId === t.id}
                            >
                              <option value="">(Sin área)</option>
                              {areas.map((a) => (
                                <option key={a.id} value={a.id}>
                                  {a.name}
                                </option>
                              ))}
                            </select>

                            <button style={btnWhite} onClick={() => router.push(`/builder/${t.id}`)}>
                              Editar
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </main>
  );
}