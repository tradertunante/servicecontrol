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
      const canSeeHotelAreas =
        profile?.role === "superadmin" ||
        profile?.role === "admin" ||
        profile?.role === "general_manager" ||
        profile?.role === "quality";

      if (profile?.role !== "manager" && !canSeeHotelAreas) {
        setManagerAreaOptions([]);
        setManagerAreasError(null);
        setManagerAreasLoading(false);
        return;
      }

      try {
        setManagerAreasLoading(true);
        setManagerAreasError(null);

        const areaQuery = supabase
          .from("areas")
          .select("id,name,type")
          .eq("hotel_id", initialHotelId)
          .eq("active", true)
          .order("name", { ascending: true });

        const { data: areaData, error: areaError } =
          profile?.role === "manager"
            ? await (async () => {
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
                  return { data: [] as ManagerAreaOption[], error: null };
                }

                return areaQuery.in("id", areaIds);
              })()
            : areaQuery;

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
