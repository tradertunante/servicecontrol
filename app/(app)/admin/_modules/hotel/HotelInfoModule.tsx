"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

type HotelRow = {
  id: string;
  name: string | null;
  created_at: string | null;
};

const HOTEL_KEY = "sc_hotel_id";
const HOTEL_CHANGED_EVENT = "sc-hotel-changed";

export default function HotelInfoModule() {
  const [hotelId, setHotelId] = useState<string | null>(null);
  const [hotel, setHotel] = useState<HotelRow | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const readHotel = () => {
      try {
        setHotelId(localStorage.getItem(HOTEL_KEY));
      } catch {
        setHotelId(null);
      }
    };
    readHotel();
    window.addEventListener(HOTEL_CHANGED_EVENT, readHotel);
    window.addEventListener("storage", readHotel);
    return () => {
      window.removeEventListener(HOTEL_CHANGED_EVENT, readHotel);
      window.removeEventListener("storage", readHotel);
    };
  }, []);

  async function load() {
    setError("");
    setHotel(null);

    if (!hotelId) {
      setError("No hay hotel seleccionado.");
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase.from("hotels").select("id, name, created_at").eq("id", hotelId).single();
      if (error) throw error;
      setHotel((data ?? null) as any);
    } catch (e: any) {
      setError(e?.message || "No se pudo cargar la info del hotel.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hotelId]);

  return (
    <div>
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
        <button
          onClick={load}
          disabled={loading}
          style={{
            padding: "10px 14px",
            borderRadius: 12,
            border: "1px solid var(--border)",
            background: "var(--card-bg)",
            fontWeight: 900,
            cursor: loading ? "not-allowed" : "pointer",
            opacity: loading ? 0.6 : 1,
          }}
        >
          {loading ? "Cargando…" : "Recargar"}
        </button>
      </div>

      {error ? (
        <div
          style={{
            marginTop: 14,
            padding: 12,
            borderRadius: 12,
            border: "1px solid rgba(220,0,0,0.35)",
            background: "rgba(220,0,0,0.06)",
            color: "crimson",
            fontWeight: 900,
          }}
        >
          {error}
        </div>
      ) : null}

      <div
        style={{
          marginTop: 14,
          background: "var(--card-bg)",
          border: "1px solid var(--border)",
          borderRadius: 16,
          boxShadow: "var(--shadow-sm)",
          padding: 16,
        }}
      >
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <Info label="Hotel ID" value={hotelId ?? "—"} />
          <Info label="Nombre" value={hotel?.name ?? "—"} />
        </div>
      </div>
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ padding: 14, borderRadius: 12, border: "1px solid rgba(0,0,0,0.10)", background: "rgba(0,0,0,0.02)" }}>
      <div style={{ fontSize: 12, opacity: 0.7, fontWeight: 900 }}>{label}</div>
      <div style={{ marginTop: 6, fontSize: 16, fontWeight: 950 }}>{value}</div>
    </div>
  );
}