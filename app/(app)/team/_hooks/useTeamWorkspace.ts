"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import type { Profile } from "@/lib/types";
import type { ManagerAreaOption } from "../_components/ManagerAreaWorkspace";

export function useTeamWorkspace({
  initialProfile,
  initialHotelId,
}: {
  initialProfile: Profile;
  initialHotelId: string;
}) {
  const [profile] = useState<Profile | null>(initialProfile);
  const [hotelId] = useState(initialHotelId);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [managerAreasLoading, setManagerAreasLoading] = useState(false);
  const [managerAreasError, setManagerAreasError] = useState<string | null>(null);
  const [managerAreaOptions, setManagerAreaOptions] = useState<ManagerAreaOption[]>([]);

  useEffect(() => {
    let cancelled = false;

    async function loadManagerAreas() {
      if (profile?.role !== "manager") {
        setManagerAreaOptions([]);
        setManagerAreasError(null);
        setManagerAreasLoading(false);
        return;
      }

      try {
        setManagerAreasLoading(true);
        setManagerAreasError(null);

        const { data: accessData, error: accessError } = await supabase
          .from("user_area_access")
          .select("area_id")
          .eq("user_id", profile.id)
          .eq("hotel_id", initialHotelId);

        if (accessError) throw accessError;

        const areaIds = Array.from(
          new Set((accessData ?? []).map((row: { area_id: string | null }) => row.area_id).filter(Boolean))
        ) as string[];

        if (areaIds.length === 0) {
          if (cancelled) return;
          setManagerAreaOptions([]);
          setManagerAreasLoading(false);
          return;
        }

        const { data: areaData, error: areaError } = await supabase
          .from("areas")
          .select("id,name,type")
          .in("id", areaIds)
          .order("name", { ascending: true });

        if (areaError) throw areaError;
        if (!cancelled) setManagerAreaOptions((areaData ?? []) as ManagerAreaOption[]);
      } catch (error: any) {
        if (!cancelled) setManagerAreasError(error?.message ?? "No se pudieron cargar las áreas asignadas.");
      } finally {
        if (!cancelled) setManagerAreasLoading(false);
      }
    }

    void loadManagerAreas();

    return () => {
      cancelled = true;
    };
  }, [initialHotelId, profile]);

  return {
    profile,
    profileError,
    hotelId,
    managerAreasLoading,
    managerAreasError,
    managerAreaOptions,
  };
}
