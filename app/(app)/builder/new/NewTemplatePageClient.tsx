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

  const disabled = saving || !templateName.trim() || !selectedAreaId || !selectedAreaExists;

  if (loading) {
    return (
      <main className="p-6 pt-20">
        <HotelHeader />
        <BackButton fallback="/builder" />
        <div className="opacity-80">Cargando...</div>
      </main>
    );
  }

  if (error && !areas.length) {
    return (
      <main className="p-6 pt-20">
        <HotelHeader />
        <BackButton fallback="/builder" />
        <div className="text-[crimson] font-[900]">{error}</div>
      </main>
    );
  }

  return (
    <main className="p-6 pt-20">
      <HotelHeader />
      <BackButton fallback="/builder" />
      <div className="mb-5">
        <div className="opacity-70 text-sm">
          Crea una nueva plantilla de auditoria para {initialProfile.full_name ?? "tu hotel"}
        </div>
      </div>
      {error ? <div className="mb-3 text-[crimson] font-[950]">{error}</div> : null}
      {success ? <div className="mb-3 text-green-600 font-[950]">{success}</div> : null}
      <div className="rounded-[18px] border border-black/[0.08] bg-white/85 p-5 shadow-[0_10px_30px_rgba(0,0,0,0.06)]">
        <div className="text-xl font-[950] mb-4">Nueva Auditoria</div>
        <div className="grid gap-4">
          <div>
            <label className="font-[900] mb-2 block">
              Nombre de la auditoria
            </label>
            <input
              type="text"
              value={templateName}
              onChange={(e) => setTemplateName(e.target.value)}
              placeholder="Ej: Auditoria Diaria Housekeeping"
              className="w-full px-[14px] py-3 rounded-[14px] border border-black/[0.18] outline-none font-[900] text-base"
            />
          </div>
          <div>
            <label className="font-[900] mb-2 block">Area</label>
            <select
              value={selectedAreaId}
              onChange={(e) => setSelectedAreaId(e.target.value)}
              className="w-full px-[14px] py-3 rounded-[14px] border border-black/[0.18] outline-none font-[900] text-base cursor-pointer"
            >
              {areas.map((area) => (
                <option key={area.id} value={area.id}>
                  {area.name}
                </option>
              ))}
            </select>
          </div>
          <div className="mt-2">
            <button
              onClick={handleCreate}
              disabled={disabled}
              className="px-4 py-3 rounded-xl border border-black/20 bg-black text-white font-[900] text-sm"
              style={{
                opacity: disabled ? 0.5 : 1,
                cursor: disabled ? "not-allowed" : "pointer",
              }}
            >
              {saving ? "Creando..." : "Crear Auditoria"}
            </button>
          </div>
        </div>
      </div>
    </main>
  );
}
