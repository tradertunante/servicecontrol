"use client";

import { useCallback, useEffect, useState } from "react";

import {
  type ActiveHotelPayload,
  fetchActiveHotel,
  setActiveHotel as persistActiveHotel,
} from "@/lib/auth/activeHotelClient";

export function useActiveHotel() {
  const [context, setContext] = useState<ActiveHotelPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const payload = await fetchActiveHotel();
      setContext(payload);
    } catch (err) {
      setContext(null);
      setError(err instanceof Error ? err.message : "No se pudo resolver el hotel activo.");
    } finally {
      setLoading(false);
    }
  }, []);

  const selectHotel = useCallback(async (hotelId: string | null) => {
    const payload = await persistActiveHotel(hotelId);
    setContext((prev) => ({
      ...(prev ?? {}),
      ...payload,
      error: null,
      ok: true,
    }));
    setError(null);
    return payload;
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return {
    context,
    loading,
    error,
    refresh,
    selectHotel,
    activeHotelId: context?.hotel_id ?? null,
    role: context?.role ?? null,
    profileHotelId: context?.profile_hotel_id ?? null,
  };
}
