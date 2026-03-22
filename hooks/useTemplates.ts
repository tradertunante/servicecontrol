"use client";

import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabaseClient";

export type TemplateLite = {
  id: string;
  name: string;
  hotel_id: string | null;
  active: boolean;
};

async function fetchTemplates(hotelId: string): Promise<TemplateLite[]> {
  const { data, error } = await supabase
    .from("audit_templates")
    .select("id, name, hotel_id, active")
    .eq("hotel_id", hotelId)
    .eq("active", true)
    .order("name");

  if (error) throw error;
  return (data ?? []) as TemplateLite[];
}

export function useTemplates(hotelId: string | null | undefined) {
  return useQuery({
    queryKey: ["templates", hotelId],
    queryFn: () => fetchTemplates(hotelId!),
    enabled: !!hotelId,
    staleTime: 5 * 60 * 1000,
  });
}
