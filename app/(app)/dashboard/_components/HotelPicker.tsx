// FILE: app/(app)/dashboard/_components/HotelPicker.tsx
"use client";

import type { CSSProperties } from "react";
import { useTranslations } from "next-intl";
import { useQueryClient } from "@tanstack/react-query";
import { ACTIVE_HOTEL_QUERY_KEY } from "@/hooks/useHotelId";
import { setActiveHotel } from "@/lib/auth/activeHotelClient";
import type { HotelRow } from "../_lib/dashboardTypes";

export default function HotelPicker({
  hotels,
  card,
  ghostBtn,
  fg,
  bg,
  activeHotelId,
  setActiveHotelId,
}: {
  hotels: HotelRow[];
  card: CSSProperties;
  ghostBtn: CSSProperties;
  fg: string;
  bg: string;
  activeHotelId: string | null;
  setActiveHotelId: (v: string | null) => void;
}) {
  const t = useTranslations("app.dashboard");
  const queryClient = useQueryClient();

  if (activeHotelId) return null;

  return (
    <main className="dash" style={{ background: bg, color: fg }}>
      <div style={{ ...card, margin: "0 auto" }}>
        <div style={{ fontSize: 22, fontWeight: 950 }}>{t("pickHotel")}</div>
        <div style={{ marginTop: 8, opacity: 0.7 }}>
          {t("pickHotelDesc")}
        </div>

        <div style={{ marginTop: 16, display: "grid", gap: 10 }}>
          {hotels.length === 0 ? (
            <div style={{ opacity: 0.7 }}>{t("noHotels")}</div>
          ) : (
            hotels.map((h) => (
              <button
                key={h.id}
                onClick={() => {
                  void (async () => {
                    await setActiveHotel(h.id);
                    await queryClient.invalidateQueries({ queryKey: ACTIVE_HOTEL_QUERY_KEY });
                    setActiveHotelId(h.id);
                  })();
                }}
                style={{
                  ...ghostBtn,
                  textAlign: "left",
                  padding: 14,
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                }}
              >
                <div style={{ fontWeight: 950 }}>{h.name}</div>
                <div style={{ opacity: 0.7, fontWeight: 900 }}>{t("enter")}</div>
              </button>
            ))
          )}
        </div>
      </div>
    </main>
  );
}
