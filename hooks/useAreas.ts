"use client";

import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabaseClient";

export type AreaLite = {
  id: string;
  name: string;
  type: string | null;
  active: boolean;
};

async function fetchAreas(hotelId: string): Promise<AreaLite[]> {
  const { data, error } = await supabase
    .from("areas")
    .select("id, name, type, active")
    .eq("hotel_id", hotelId)
    .eq("active", true)
    .order("name");

  if (error) throw error;
  return (data ?? []) as AreaLite[];
}

export function useAreas(hotelId: string | null | undefined) {
  return useQuery({
    queryKey: ["areas", hotelId],
    queryFn: () => fetchAreas(hotelId!),
    enabled: !!hotelId,
    staleTime: 5 * 60 * 1000,
  });
}
