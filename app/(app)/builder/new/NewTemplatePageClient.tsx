"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import BackButton from "@/app/components/BackButton";
import HotelHeader from "@/app/components/HotelHeader";
import { supabase } from "@/lib/supabaseClient";
import type { Profile } from "@/lib/types";

type Area = { id: string; name: string };

export default function NewTemplatePageClient({
  initialProfile,
  hotelId,
  initialAreaId,
}: {
  initialProfile: Profile;
  hotelId: string;
  initialAreaId: string | null;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [areas, setAreas] = useState<Area[]>([]);
  const [templateName, setTemplateName] = useState("");
  const [selectedAreaId, setSelectedAreaId] = useState<string>("");

  const selectedAreaExists = useMemo(
    () => !!selectedAreaId && areas.some((area) => area.id === selectedAreaId),
    [areas, selectedAreaId]
  );

  useEffect(() => {
    (async () => {
      setLoading(true);
      setError(null);

      try {
        const { data: areasData, error: areasErr } = await supabase
          .from("areas")
          .select("id, name")
          .eq("hotel_id", hotelId)
          .order("name", { ascending: true });

        if (areasErr) throw areasErr;

        const areasList = (areasData ?? []) as Area[];
        setAreas(areasList);

        if (initialAreaId && areasList.some((area) => area.id === initialAreaId)) {
          setSelectedAreaId(initialAreaId);
        } else if (areasList.length > 0) {
          setSelectedAreaId(areasList[0].id);
        } else {
          setSelectedAreaId("");
        }
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : "Error al cargar datos.");
      } finally {
        setLoading(false);
      }
    })();
  }, [hotelId, initialAreaId]);

  async function handleCreate() {
    setError(null);
    setSuccess(null);

    if (!selectedAreaId) {
      setError("Selecciona un area.");
      return;
    }

    if (!areas.some((area) => area.id === selectedAreaId)) {
      setError("Area no valida para tu hotel.");
      return;
    }

    if (!templateName.trim()) {
      setError("El nombre de la auditoria no puede estar vacio.");
      return;
    }

    setSaving(true);

    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData?.session?.access_token;
      if (!accessToken) throw new Error("Sesion invalida.");

      const response = await fetch("/api/templates", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          name: templateName.trim(),
          area_id: selectedAreaId,
        }),
      });

      const payload = await response.json().catch(() => null);
      if (!response.ok) throw new Error(payload?.error ?? "No se pudo crear la auditoria.");

      setSuccess("Auditoria creada. Redirigiendo al editor...");
      setTimeout(() => router.push(`/builder/${payload.template_id}`), 700);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "No se pudo crear la auditoria.");
      setSaving(false);
    }
  }

  const card: React.CSSProperties = {
    borderRadius: 18,
    border: "1px solid rgba(0,0,0,0.08)",
    background: "rgba(255,255,255,0.85)",
    padding: 20,
    boxShadow: "0 10px 30px rgba(0,0,0,0.06)",
  };
  const btn: React.CSSProperties = {
    padding: "12px 16px",
    borderRadius: 12,
    border: "1px solid rgba(0,0,0,0.2)",
    background: "#000",
    color: "#fff",
    fontWeight: 900,
    cursor: "pointer",
    fontSize: 14,
  };
  const disabled = saving || !templateName.trim() || !selectedAreaId || !selectedAreaExists;

  if (loading) {
    return (
      <main style={{ padding: 24, paddingTop: 80 }}>
        <HotelHeader />
        <BackButton fallback="/builder" />
        <div style={{ opacity: 0.8 }}>Cargando...</div>
      </main>
    );
  }

  if (error && !areas.length) {
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
      <div style={{ marginBottom: 20 }}>
        <div style={{ opacity: 0.7, fontSize: 14 }}>
          Crea una nueva plantilla de auditoria para {initialProfile.full_name ?? "tu hotel"}
        </div>
      </div>
      {error ? <div style={{ marginBottom: 12, color: "crimson", fontWeight: 950 }}>{error}</div> : null}
      {success ? <div style={{ marginBottom: 12, color: "green", fontWeight: 950 }}>{success}</div> : null}
      <div style={card}>
        <div style={{ fontSize: 20, fontWeight: 950, marginBottom: 16 }}>Nueva Auditoria</div>
        <div style={{ display: "grid", gap: 16 }}>
          <div>
            <label style={{ fontWeight: 900, marginBottom: 8, display: "block" }}>
              Nombre de la auditoria
            </label>
            <input
              type="text"
              value={templateName}
              onChange={(e) => setTemplateName(e.target.value)}
              placeholder="Ej: Auditoria Diaria Housekeeping"
              style={{
                width: "100%",
                padding: "12px 14px",
                borderRadius: 14,
                border: "1px solid rgba(0,0,0,0.18)",
                outline: "none",
                fontWeight: 900,
                fontSize: 16,
              }}
            />
          </div>
          <div>
            <label style={{ fontWeight: 900, marginBottom: 8, display: "block" }}>Area</label>
            <select
              value={selectedAreaId}
              onChange={(e) => setSelectedAreaId(e.target.value)}
              style={{
                width: "100%",
                padding: "12px 14px",
                borderRadius: 14,
                border: "1px solid rgba(0,0,0,0.18)",
                outline: "none",
                fontWeight: 900,
                fontSize: 16,
                cursor: "pointer",
              }}
            >
              {areas.map((area) => (
                <option key={area.id} value={area.id}>
                  {area.name}
                </option>
              ))}
            </select>
          </div>
          <div style={{ marginTop: 8 }}>
            <button
              onClick={handleCreate}
              disabled={disabled}
              style={{ ...btn, opacity: disabled ? 0.5 : 1, cursor: disabled ? "not-allowed" : "pointer" }}
            >
              {saving ? "Creando..." : "Crear Auditoria"}
            </button>
          </div>
        </div>
      </div>
    </main>
  );
}
