"use client";

import { useQuery } from "@tanstack/react-query";
import { fetchActiveHotel } from "@/lib/auth/activeHotelClient";

export function useHotelId() {
  return useQuery({
    queryKey: ["active-hotel"],
    queryFn: async () => {
      const result = await fetchActiveHotel();
      return {
        hotelId: result.hotel_id,
        hotelName: result.hotel_name,
        role: result.role ?? null,
      };
    },
    staleTime: 5 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
    retry: 2,
  });
}
