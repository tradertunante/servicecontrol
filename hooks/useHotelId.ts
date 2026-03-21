"use client";

import { useQuery } from "@tanstack/react-query";
import { fetchActiveHotel } from "@/lib/auth/activeHotelClient";
import { useProfile } from "./useProfile";

export function useHotelId() {
  const { data: profile } = useProfile();

  return useQuery({
    queryKey: ["active-hotel"],
    queryFn: async () => {
      const result = await fetchActiveHotel();
      return result.hotel_id;
    },
    enabled: !!profile,
    staleTime: 5 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
  });
}
