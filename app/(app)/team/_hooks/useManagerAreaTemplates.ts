"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import type { AuditTemplate } from "@/app/(app)/areas/[areaId]/_lib/areaTypes";

const HOTEL_KEY = "sc_hotel_id";

export function useManagerAreaTemplates({
  areaId,
  profileRole,
}: {
  areaId: string;
  profileRole: string | null | undefined;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [starting, setStarting] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [templates, setTemplates] = useState<AuditTemplate[]>([]);
  const [areaHotelId, setAreaHotelId] = useState<string | null>(null);

  useEffect(() => {
    if (!areaId) return;

    let cancelled = false;

    (async () => {
      setLoading(true);
      setError(null);

      try {
        const [areaRes, templatesRes] = await Promise.all([
          supabase.from("areas").select("id,hotel_id").eq("id", areaId).single(),
          supabase
            .from("audit_templates")
            .select("id,name,active,area_id")
            .eq("area_id", areaId)
            .order("name", { ascending: true }),
        ]);

        if (areaRes.error || !areaRes.data) {
          throw areaRes.error ?? new Error("Área no encontrada.");
        }
        if (templatesRes.error) throw templatesRes.error;

        if (cancelled) return;

        setAreaHotelId(areaRes.data.hotel_id ?? null);
        setTemplates(
          ((templatesRes.data ?? []) as AuditTemplate[]).filter((t: any) => t.active !== false)
        );
        setLoading(false);
      } catch (e: any) {
        if (cancelled) return;
        setLoading(false);
        setError(e?.message ?? "No se pudieron cargar las auditorías del área.");
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [areaId]);

  async function handleStart(templateId: string) {
    if (!areaId) return;

    setStarting(templateId);
    setError(null);

    try {
      const {
        data: { user },
        error: userErr,
      } = await supabase.auth.getUser();

      if (userErr || !user) throw userErr ?? new Error("No hay sesión activa.");

      const nowIso = new Date().toISOString();
      const hotelIdFromLocalStorage =
        typeof window !== "undefined" ? localStorage.getItem(HOTEL_KEY) : null;

      const hotelIdToUse = areaHotelId ?? hotelIdFromLocalStorage;
      if (!hotelIdToUse) throw new Error("No se pudo determinar el hotel_id para crear la auditoría.");

      const channel: "quality" | "internal" =
        profileRole === "quality" ? "quality" : "internal";

      const { data, error } = await supabase
        .from("audit_runs")
        .insert({
          hotel_id: hotelIdToUse,
          area_id: areaId,
          audit_template_id: templateId,
          status: "draft",
          score: null,
          notes: null,
          executed_at: nowIso,
          executed_by: user.id,
          audit_channel: channel,
        })
        .select("id")
        .single();

      if (error || !data) throw error ?? new Error("No se pudo crear la auditoría.");

      router.push(`/audits/${data.id}`);
    } catch (e: any) {
      setError(e?.message ?? "No se pudo iniciar la auditoría.");
    } finally {
      setStarting(null);
    }
  }

  return {
    loading,
    starting,
    error,
    templates,
    handleStart,
  };
}
