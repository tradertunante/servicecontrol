// FILE: app/(app)/dashboard/_components/HotelPicker.tsx
"use client";

import type { CSSProperties } from "react";
import type { HotelRow } from "../_lib/dashboardTypes";
import { HOTEL_KEY } from "../_hooks/useDashboardData";

export default function HotelPicker({
  hotels,
  card,
  ghostBtn,
  fg,
  bg,
  selectedHotelId,
  setSelectedHotelId,
}: {
  hotels: HotelRow[];
  card: CSSProperties;
  ghostBtn: CSSProperties;
  fg: string;
  bg: string;
  selectedHotelId: string | null;
  setSelectedHotelId: (v: string | null) => void;
}) {
  if (selectedHotelId) return null;

  return (
    <main className="dash" style={{ background: bg, color: fg }}>
      <div style={{ ...card, margin: "0 auto" }}>
        <div style={{ fontSize: 22, fontWeight: 950 }}>Elige un hotel</div>
        <div style={{ marginTop: 8, opacity: 0.7 }}>
          Como superadmin, primero selecciona el hotel con el que quieres trabajar.
        </div>

        <div style={{ marginTop: 16, display: "grid", gap: 10 }}>
          {hotels.length === 0 ? (
            <div style={{ opacity: 0.7 }}>No hay hoteles creados todavía.</div>
          ) : (
            hotels.map((h) => (
              <button
                key={h.id}
                onClick={() => {
                  localStorage.setItem(HOTEL_KEY, h.id);
                  setSelectedHotelId(h.id);
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
                <div style={{ opacity: 0.7, fontWeight: 900 }}>Entrar →</div>
              </button>
            ))
          )}
        </div>
      </div>
    </main>
  );
}