"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import type { AreaRow, HotelRow, Profile } from "../_lib/analyticsTypes";
import { areaLabel, isAdminLike } from "../_lib/analyticsUtils";

export function useAnalyticsBoot({
  initialProfile,
  initialHotelId,
}: {
  initialProfile: Profile;
  initialHotelId: string | null;
}) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [profile] = useState<Profile>(initialProfile);
  const [hotelId] = useState<string | null>(initialHotelId);
  const [hotel, setHotel] = useState<HotelRow | null>(null);

  const [areas, setAreas] = useState<AreaRow[]>([]);
  const [selectedAreaId, setSelectedAreaId] = useState<string>("");

  const selectedArea = useMemo(
    () => areas.find((a) => a.id === selectedAreaId) ?? null,
    [areas, selectedAreaId]
  );

  const selectedAreaLabel = useMemo(
    () => areaLabel(selectedArea?.name ?? null, selectedArea?.type ?? null),
    [selectedArea]
  );

  useEffect(() => {
    let alive = true;

    (async () => {
      setLoading(true);
      setError(null);

      try {
        if (!hotelId) {
          setLoading(false);
          setError("No hay hotel activo. Como superadmin, primero selecciona un hotel.");
          return;
        }

        const { data: hData, error: hErr } = await supabase
          .from("hotels")
          .select("id,name")
          .eq("id", hotelId)
          .single();
        if (hErr) throw hErr;

        let areaRows: AreaRow[] = [];

        if (isAdminLike(profile.role)) {
          const { data: aData, error: aErr } = await supabase
            .from("areas")
            .select("id,name,type,hotel_id")
            .eq("hotel_id", hotelId)
            .order("name", { ascending: true });

          if (aErr) throw aErr;
          areaRows = (aData ?? []) as AreaRow[];
        } else {
          const { data: accessData, error: accessErr } = await supabase
            .from("user_area_access")
            .select("area_id")
            .eq("user_id", profile.id)
            .eq("hotel_id", hotelId);

          if (accessErr) throw accessErr;

          const allowedIds = (accessData ?? [])
            .map((r: any) => r.area_id)
            .filter(Boolean);

          if (allowedIds.length > 0) {
            const { data: aData, error: aErr } = await supabase
              .from("areas")
              .select("id,name,type,hotel_id")
              .eq("hotel_id", hotelId)
              .in("id", allowedIds)
              .order("name", { ascending: true });

            if (aErr) throw aErr;
            areaRows = (aData ?? []) as AreaRow[];
          } else {
            areaRows = [];
          }
        }

        if (!alive) return;
        setHotel((hData as any) ?? null);
        setAreas(areaRows);

        if (areaRows.length > 0) {
          setSelectedAreaId(areaRows[0].id);
        } else {
          setSelectedAreaId("");
          setError("No tienes áreas asignadas para ver analítica. Revisa user_area_access.");
        }

        setLoading(false);
      } catch (e: any) {
        if (!alive) return;
        setLoading(false);
        setError(e?.message ?? "Error cargando analítica.");
      }
    })();

    return () => {
      alive = false;
    };
  }, [hotelId, profile.id, profile.role]);

  return {
    loading,
    error,
    profile,
    hotelId,
    hotel,
    areas,
    selectedAreaId,
    setSelectedAreaId,
    selectedAreaLabel,
  };
}
