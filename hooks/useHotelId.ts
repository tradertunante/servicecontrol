"use client";

import { useQuery } from "@tanstack/react-query";
import { fetchActiveHotel } from "@/lib/auth/activeHotelClient";

export const ACTIVE_HOTEL_QUERY_KEY = ["active-hotel"] as const;

export function useHotelId() {
  return useQuery({
    queryKey: ACTIVE_HOTEL_QUERY_KEY,
    queryFn: async () => {
      const result = await fetchActiveHotel();
      return {
        hotelId: result.hotel_id,
        hotelName: result.hotel_name,
        role: result.role ?? null,
        is_trial: result.is_trial ?? false,
      };
    },
    staleTime: 5 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
    retry: 2,
  });
}
