// app/builder/new/page.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { requireRoleOrRedirect } from "@/lib/auth/RequireRole";
import HotelHeader from "@/app/components/HotelHeader";
import BackButton from "@/app/components/BackButton";
import type { Profile } from "@/lib/types";

type Area = { id: string; name: string };
const HOTEL_KEY = "sc_hotel_id";

export default function NewTemplatePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [areas, setAreas] = useState<Area[]>([]);
  const [templateName, setTemplateName] = useState("");
  const [selectedAreaId, setSelectedAreaId] = useState<string>("");

  const selectedAreaExists = useMemo(() => !!selectedAreaId && areas.some((a) => a.id === selectedAreaId), [areas, selectedAreaId]);

  useEffect(() => {
    (async () => {
      setLoading(true); setError(null);
      try {
        const p = await requireRoleOrRedirect(router, ["admin", "superadmin"], "/dashboard");
        if (!p) return;
        setProfile(p);
        const hotelId =
          p.role === "superadmin"
            ? typeof window !== "undefined"
              ? window.localStorage.getItem(HOTEL_KEY)
              : null
            : p.hotel_id;
        if (!hotelId) { setAreas([]); setError("Selecciona un hotel antes de crear plantillas."); setLoading(false); return; }

        const { data: areasData, error: areasErr } = await supabase.from("areas").select("id, name").eq("hotel_id", hotelId).order("name", { ascending: true });
        if (areasErr) throw areasErr;

        const areasList = (areasData ?? []) as Area[];
        setAreas(areasList);

        const areaIdParam = searchParams?.get("area_id");
        if (areaIdParam && areasList.some((a) => a.id === areaIdParam)) {
          setSelectedAreaId(areaIdParam);
        } else if (areasList.length > 0) {
          setSelectedAreaId(areasList[0].id);
        } else {
          setSelectedAreaId("");
        }
        setLoading(false);
      } catch (e: any) {
        setError(e?.message ?? "Error al cargar datos.");
        setLoading(false);
      }
    })();
  }, [router, searchParams]);

  async function handleCreate() {
    setError(null); setSuccess(null);
    const hotelId =
      profile?.role === "superadmin"
        ? typeof window !== "undefined"
          ? window.localStorage.getItem(HOTEL_KEY)
          : null
        : profile?.hotel_id ?? null;
    if (!hotelId) { setError("Selecciona un hotel antes de crear plantillas."); return; }
    if (!selectedAreaId) { setError("Selecciona un área."); return; }
    if (!areas.some((a) => a.id === selectedAreaId)) { setError("Área no válida para tu hotel."); return; }
    if (!templateName.trim()) { setError("El nombre de la auditoría no puede estar vacío."); return; }
    setSaving(true);
    try {
      const { data: newTemplate, error: createErr } = await supabase
        .from("audit_templates")
        .insert({ name: templateName.trim(), area_id: selectedAreaId, hotel_id: hotelId, active: true })
        .select("id").single();
      if (createErr) throw createErr;
      setSuccess("¡Auditoría creada! Redirigiendo al editor...");
      setTimeout(() => router.push(`/builder/${newTemplate.id}`), 700);
    } catch (e: any) {
      setError(e?.message ?? "No se pudo crear la auditoría.");
      setSaving(false);
    }
  }

  const card: React.CSSProperties = { borderRadius: 18, border: "1px solid rgba(0,0,0,0.08)", background: "rgba(255,255,255,0.85)", padding: 20, boxShadow: "0 10px 30px rgba(0,0,0,0.06)" };
  const btn: React.CSSProperties = { padding: "12px 16px", borderRadius: 12, border: "1px solid rgba(0,0,0,0.2)", background: "#000", color: "#fff", fontWeight: 900, cursor: "pointer", fontSize: 14 };
  const disabled = saving || !templateName.trim() || !selectedAreaId || !selectedAreaExists;

  if (loading) return <main style={{ padding: 24, paddingTop: 80 }}><HotelHeader /><BackButton fallback="/builder" /><div style={{ opacity: 0.8 }}>Cargando…</div></main>;
  if (error && !areas.length) return <main style={{ padding: 24, paddingTop: 80 }}><HotelHeader /><BackButton fallback="/builder" /><div style={{ color: "crimson", fontWeight: 900 }}>{error}</div></main>;

  return (
    <main style={{ padding: 24, paddingTop: 80 }}>
      <HotelHeader />
      <BackButton fallback="/builder" />
      <div style={{ marginBottom: 20 }}>
        <div style={{ opacity: 0.7, fontSize: 14 }}>Crea una nueva plantilla de auditoría</div>
      </div>
      {error && <div style={{ marginBottom: 12, color: "crimson", fontWeight: 950 }}>{error}</div>}
      {success && <div style={{ marginBottom: 12, color: "green", fontWeight: 950 }}>{success}</div>}
      <div style={card}>
        <div style={{ fontSize: 20, fontWeight: 950, marginBottom: 16 }}>Nueva Auditoría</div>
        <div style={{ display: "grid", gap: 16 }}>
          <div>
            <label style={{ fontWeight: 900, marginBottom: 8, display: "block" }}>Nombre de la auditoría</label>
            <input type="text" value={templateName} onChange={(e) => setTemplateName(e.target.value)} placeholder="Ej: Auditoría Diaria Housekeeping" style={{ width: "100%", padding: "12px 14px", borderRadius: 14, border: "1px solid rgba(0,0,0,0.18)", outline: "none", fontWeight: 900, fontSize: 16 }} />
          </div>
          <div>
            <label style={{ fontWeight: 900, marginBottom: 8, display: "block" }}>Área</label>
            <select value={selectedAreaId} onChange={(e) => setSelectedAreaId(e.target.value)} style={{ width: "100%", padding: "12px 14px", borderRadius: 14, border: "1px solid rgba(0,0,0,0.18)", outline: "none", fontWeight: 900, fontSize: 16, cursor: "pointer" }}>
              {areas.map((area) => <option key={area.id} value={area.id}>{area.name}</option>)}
            </select>
          </div>
          <div style={{ marginTop: 8 }}>
            <button onClick={handleCreate} disabled={disabled} style={{ ...btn, opacity: disabled ? 0.5 : 1, cursor: disabled ? "not-allowed" : "pointer" }}>
              {saving ? "Creando..." : "Crear Auditoría"}
            </button>
          </div>
        </div>
      </div>
      <div style={{ ...card, marginTop: 14, background: "rgba(255, 243, 205, 0.5)" }}>
        <div style={{ fontWeight: 950, fontSize: 14, marginBottom: 8 }}>💡 Siguiente paso</div>
        <div style={{ opacity: 0.85, fontSize: 13, lineHeight: 1.6 }}>Después de crear la auditoría, serás redirigido al editor donde podrás agregar las preguntas y configurar los requisitos de foto, comentarios y firma.</div>
      </div>
    </main>
  );
}
