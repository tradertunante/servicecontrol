"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

import type { Profile, AuditRunRow } from "../_lib/dashboardTypes";
import type { HeatMode } from "../_lib/dashboardUtils";

type HotelRow = { id: string; name: string; active: boolean | null; status: string | null };
type AreaRow = { id: string; name: string; type: string | null; hotel_id: string | null; active?: boolean | null; sort_order?: number | null };
type TemplateRow = { id: string; name: string; hotel_id: string | null };
type DepartmentBacklogResponse = { rows?: unknown[] };

export type PendingTeamItem = {
  teamKey: "it" | "maintenance" | "otros";
  teamLabel: string;
  pendingCount: number;
};

const DEFAULT_PENDING: PendingTeamItem[] = [];

export function useDashboardFetch({
  profile,
  activeHotelId,
  setActiveHotelId,
  heatMode,
  selectedYear,
  hasPackIt = true,
  hasPackEngineering = true,
}: {
  profile: Profile | null;
  activeHotelId: string | null;
  setActiveHotelId: (s: string | null) => void;
  heatMode: HeatMode;
  selectedYear: number;
  hasPackIt?: boolean;
  hasPackEngineering?: boolean;
}) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [hotels, setHotels] = useState<HotelRow[]>([]);
  const [areas, setAreas] = useState<AreaRow[]>([]);
  const [templates, setTemplates] = useState<TemplateRow[]>([]);
  const [runs, setRuns] = useState<AuditRunRow[]>([]);
  const [pendingByTeam, setPendingByTeam] = useState<PendingTeamItem[]>(DEFAULT_PENDING);
  const [selectedHotelName, setSelectedHotelName] = useState("");

  const canChooseHotel = profile?.role === "superadmin";

  const resetForHotelChange = () => {
    setActiveHotelId(null);
    setAreas([]);
    setTemplates([]);
    setRuns([]);
    setPendingByTeam(DEFAULT_PENDING);
  };

  useEffect(() => {
    const controller = new AbortController();

    (async () => {
      if (!profile) return;
      if (!activeHotelId) { setLoading(false); return; }

      setLoading(true);
      setError(null);

      try {
        const hotelsPromise = canChooseHotel
          ? supabase.from("hotels").select("id,name,active,status").order("name")
          : Promise.resolve({ data: null, error: null });

        const selectedHotelPromise = canChooseHotel
          ? Promise.resolve({ data: null, error: null })
          : supabase.from("hotels").select("id,name").eq("id", activeHotelId).single();

        const areasPromise = supabase
          .from("areas")
          .select("id,name,type,hotel_id,active,sort_order")
          .eq("hotel_id", activeHotelId)
          .eq("active", true)
          .order("sort_order", { ascending: true, nullsFirst: false })
          .order("name");

        const templatesPromise = supabase
          .from("audit_templates")
          .select("id,name,hotel_id")
          .or(`hotel_id.eq.${activeHotelId},hotel_id.is.null`)
          .order("name");

        const cutoffDate = heatMode === "YEAR"
          ? `${selectedYear - 1}-01-01`
          : new Date(Date.now() - 13 * 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

        const runsPromise = supabase
          .from("audit_runs")
          .select("id,area_id,audit_template_id,executed_at,score,audit_channel")
          .eq("hotel_id", activeHotelId)
          .is("archived_at", null)
          .eq("status", "submitted")
          .not("executed_at", "is", null)
          .not("score", "is", null)
          .gte("executed_at", cutoffDate)
          .order("executed_at", { ascending: false })
          .limit(5000);

        const emptyBacklog: DepartmentBacklogResponse = { rows: [] };

        const backlogItPromise = hasPackIt
          ? fetch(`/api/departments/backlog?department=it&hotel_id=${activeHotelId}`, {
              method: "GET", credentials: "include", cache: "no-store", signal: controller.signal,
            }).then(async (response) => {
              const payload = (await response.json().catch(() => null)) as DepartmentBacklogResponse | null;
              if (!response.ok || !payload) return emptyBacklog;
              return payload;
            }).catch(() => emptyBacklog)
          : Promise.resolve(emptyBacklog);

        const backlogEngineeringPromise = hasPackEngineering
          ? fetch(`/api/departments/backlog?department=engineering&hotel_id=${activeHotelId}`, {
              method: "GET", credentials: "include", cache: "no-store", signal: controller.signal,
            }).then(async (response) => {
              const payload = (await response.json().catch(() => null)) as DepartmentBacklogResponse | null;
              if (!response.ok || !payload) return emptyBacklog;
              return payload;
            }).catch(() => emptyBacklog)
          : Promise.resolve(emptyBacklog);

        const backlogOtrosPromise = fetch(`/api/departments/backlog?department=otros&hotel_id=${activeHotelId}`, {
          method: "GET", credentials: "include", cache: "no-store", signal: controller.signal,
        }).then(async (response) => {
          const payload = (await response.json().catch(() => null)) as DepartmentBacklogResponse | null;
          if (!response.ok || !payload) return emptyBacklog;
          return payload;
        }).catch(() => emptyBacklog);

        const [hotelsRes, selectedHotelRes, areasRes, templatesRes, runsRes, backlogItRes, backlogEngineeringRes, backlogOtrosRes] = await Promise.all([
          hotelsPromise, selectedHotelPromise, areasPromise, templatesPromise, runsPromise, backlogItPromise, backlogEngineeringPromise, backlogOtrosPromise,
        ]);

        if (hotelsRes.error) throw hotelsRes.error;
        if (selectedHotelRes.error) throw selectedHotelRes.error;
        if (areasRes.error) throw areasRes.error;
        if (templatesRes.error) throw templatesRes.error;
        if (runsRes.error) throw runsRes.error;
        if (controller.signal.aborted) return;

        const hotelsData = (hotelsRes.data ?? []) as HotelRow[];
        const selectedHotelData = selectedHotelRes.data as { id: string; name: string } | null;

        setHotels(hotelsData);
        setSelectedHotelName(
          canChooseHotel
            ? hotelsData.find((hotel) => hotel.id === activeHotelId)?.name ?? ""
            : selectedHotelData?.name ?? ""
        );
        setAreas((areasRes.data ?? []) as AreaRow[]);
        setTemplates((templatesRes.data ?? []) as TemplateRow[]);
        setRuns((runsRes.data ?? []) as AuditRunRow[]);
        setPendingByTeam([
          ...(hasPackIt ? [{
            teamKey: "it" as const,
            teamLabel: "IT",
            pendingCount: Array.isArray(backlogItRes.rows) ? backlogItRes.rows.length : 0,
          }] : []),
          ...(hasPackEngineering ? [{
            teamKey: "maintenance" as const,
            teamLabel: "Mantenimiento",
            pendingCount: Array.isArray(backlogEngineeringRes.rows) ? backlogEngineeringRes.rows.length : 0,
          }] : []),
          {
            teamKey: "otros" as const,
            teamLabel: "Otros",
            pendingCount: Array.isArray(backlogOtrosRes.rows) ? backlogOtrosRes.rows.length : 0,
          },
        ]);
      } catch (e: unknown) {
        if (e instanceof DOMException && e.name === "AbortError") return;
        if (controller.signal.aborted) return;
        setError(e instanceof Error ? e.message : "No se pudo cargar el dashboard.");
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    })();

    return () => { controller.abort(); };
  }, [profile, activeHotelId, canChooseHotel, heatMode, selectedYear]);

  return {
    loading, error, hotels, areas, templates, runs,
    pendingByTeam, selectedHotelName, canChooseHotel, resetForHotelChange,
  };
}
