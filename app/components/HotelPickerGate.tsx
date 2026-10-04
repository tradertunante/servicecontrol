"use client";

import { useEffect, useState } from "react";
import { setActiveHotel, notifyActiveHotelChanged } from "@/lib/auth/activeHotelClient";
import { getCurrentUser } from "@/lib/auth/clientSession";
import { isHotelPicked, markHotelPickedForCurrentUser } from "@/lib/auth/hotelPickedSession";
import { useHotelId } from "@/hooks/useHotelId";

// Pantalla de selección de hotel al entrar, para usuarios con varios hoteles.
// Se muestra una vez por pestaña y usuario. Preselecciona el hotel activo
// (el último usado), así que confirmar sin tocar nada entra al mismo hotel.
export default function HotelPickerGate() {
  const { data: session, isLoading } = useHotelId();
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const hotels = session?.availableHotels ?? [];
  const activeHotelId = session?.hotelId ?? null;

  useEffect(() => {
    if (isLoading || hotels.length < 2 || !activeHotelId) {
      setOpen(false);
      return;
    }
    let cancelled = false;
    void (async () => {
      const user = await getCurrentUser();
      if (cancelled || !user || isHotelPicked(user.id)) return;
      setSelected(activeHotelId);
      setOpen(true);
    })();
    return () => { cancelled = true; };
  }, [isLoading, hotels.length, activeHotelId]);

  if (!open) return null;

  const confirm = async () => {
    if (!selected) return;
    setBusy(true);
    setError("");
    try {
      if (selected === activeHotelId) {
        await markHotelPickedForCurrentUser();
        setOpen(false);
        return;
      }
      await setActiveHotel(selected);
      await markHotelPickedForCurrentUser();
      notifyActiveHotelChanged(selected);
      window.location.reload();
    } catch {
      setError("No se pudo cambiar de hotel. Inténtalo de nuevo.");
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="hotel-picker-title"
        className="w-full max-w-md rounded-2xl bg-white text-slate-900 p-6 shadow-xl"
      >
        <h2 id="hotel-picker-title" className="text-xl font-bold">Elige un hotel</h2>
        <p className="mt-1 text-sm opacity-75">Trabajarás en el hotel que elijas. Puedes cambiarlo después desde la cabecera.</p>

        <div role="radiogroup" aria-label="Hoteles disponibles" className="mt-4 flex flex-col gap-2">
          {hotels.map((hotel) => {
            const checked = selected === hotel.id;
            return (
              <button
                key={hotel.id}
                type="button"
                role="radio"
                aria-checked={checked}
                disabled={busy}
                onClick={() => setSelected(hotel.id)}
                className={`flex items-center justify-between rounded-xl border px-4 py-3 text-left transition-colors disabled:opacity-50 ${checked ? "border-slate-900 bg-slate-900/5" : "border-slate-200"}`}
              >
                <span className="font-semibold">{hotel.name || "Hotel sin nombre"}</span>
                <span className="text-xs opacity-70">{hotel.role}</span>
              </button>
            );
          })}
        </div>

        {error && <p role="alert" className="mt-3 text-sm text-red-600">{error}</p>}

        <div className="mt-5 flex justify-end">
          <button
            type="button"
            onClick={() => { void confirm(); }}
            disabled={busy || !selected}
            className="rounded-lg bg-slate-900 px-5 py-2 font-semibold text-white disabled:opacity-50"
          >
            {busy ? "Entrando…" : "Entrar"}
          </button>
        </div>
      </div>
    </div>
  );
}
