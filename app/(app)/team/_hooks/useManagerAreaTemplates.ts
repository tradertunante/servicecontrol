"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import type { AuditTemplate } from "@/app/(app)/areas/[areaId]/_lib/areaTypes";

export function useManagerAreaTemplates({
  areaId,
  profileRole,
  initialHotelId,
}: {
  areaId: string;
  profileRole: string | null | undefined;
  initialHotelId: string;
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
          ((templatesRes.data ?? []) as AuditTemplate[]).filter((t) => t.active !== false)
        );
        setLoading(false);
      } catch (e: unknown) {
        if (cancelled) return;
        setLoading(false);
        setError(e instanceof Error ? e.message : "No se pudieron cargar las auditorías del área.");
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

      const hotelIdToUse = areaHotelId ?? initialHotelId;
      if (!hotelIdToUse) throw new Error("No se pudo determinar el hotel_id para crear la auditoría.");
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData?.session?.access_token;
      if (!accessToken) throw new Error("Sesión inválida.");

      const response = await fetch("/api/audits/start", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          area_id: areaId,
          audit_template_id: templateId,
        }),
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok || !payload?.run_id) {
        throw new Error(payload?.error ?? "No se pudo crear la auditoría.");
      }

      router.push(`/audits/${payload.run_id}`);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "No se pudo iniciar la auditoría.");
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
