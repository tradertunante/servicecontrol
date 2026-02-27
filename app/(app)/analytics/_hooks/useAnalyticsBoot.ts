"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import type { AreaRow, HotelRow, Profile } from "../_lib/analyticsTypes";
import { HOTEL_KEY, areaLabel, canSeeAnalytics, isAdminLike } from "../_lib/analyticsUtils";

export function useAnalyticsBoot() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [profile, setProfile] = useState<Profile | null>(null);
  const [hotelId, setHotelId] = useState<string | null>(null);
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
        const { data: userData } = await supabase.auth.getUser();
        const user = userData.user;
        if (!user) {
          router.push("/login");
          return;
        }

        const { data: pData, error: pErr } = await supabase
          .from("profiles")
          .select("id,hotel_id,role,active,full_name")
          .eq("id", user.id)
          .single();

        if (pErr || !pData || pData.active === false) {
          router.push("/login");
          return;
        }

        const p = pData as Profile;

        if (!canSeeAnalytics(p.role)) {
          router.push("/dashboard");
          return;
        }

        const hid =
          p.role === "superadmin"
            ? (typeof window !== "undefined"
                ? localStorage.getItem(HOTEL_KEY)
                : null) || null
            : p.hotel_id ?? null;

        if (!alive) return;
        setProfile(p);
        setHotelId(hid);

        if (!hid) {
          setLoading(false);
          setError("No hay hotel activo. Como superadmin, primero selecciona un hotel.");
          return;
        }

        const { data: hData, error: hErr } = await supabase
          .from("hotels")
          .select("id,name")
          .eq("id", hid)
          .single();
        if (hErr) throw hErr;

        let areaRows: AreaRow[] = [];

        if (isAdminLike(p.role)) {
          const { data: aData, error: aErr } = await supabase
            .from("areas")
            .select("id,name,type,hotel_id")
            .eq("hotel_id", hid)
            .order("name", { ascending: true });

          if (aErr) throw aErr;
          areaRows = (aData ?? []) as AreaRow[];
        } else {
          const { data: accessData, error: accessErr } = await supabase
            .from("user_area_access")
            .select("area_id")
            .eq("user_id", p.id)
            .eq("hotel_id", hid);

          if (accessErr) throw accessErr;

          const allowedIds = (accessData ?? [])
            .map((r: any) => r.area_id)
            .filter(Boolean);

          if (allowedIds.length > 0) {
            const { data: aData, error: aErr } = await supabase
              .from("areas")
              .select("id,name,type,hotel_id")
              .eq("hotel_id", hid)
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
  }, [router]);

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