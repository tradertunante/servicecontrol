"use client";

import { useState } from "react";
import { notifyActiveHotelChanged, setActiveHotel } from "@/lib/auth/activeHotelClient";
import { markHotelPickedForCurrentUser } from "@/lib/auth/hotelPickedSession";

type HotelOption = { id: string; name: string };

type Props = {
  hotels: HotelOption[];
  activeHotelId: string | null;
  label: string;
};

// Selector de hotel para usuarios con membresía en varios hoteles.
// Al cambiar, el rol y el hotel del perfil cambian en servidor: se recarga esta
// pestaña y se avisa a las demás (ver onActiveHotelChanged en HotelHeader).
export default function HotelSwitcher({ hotels, activeHotelId, label }: Props) {
  const [switching, setSwitching] = useState(false);

  const handleChange = async (hotelId: string) => {
    if (!hotelId || hotelId === activeHotelId) return;
    setSwitching(true);
    try {
      await setActiveHotel(hotelId);
      await markHotelPickedForCurrentUser();
      notifyActiveHotelChanged(hotelId);
      window.location.reload();
    } catch {
      setSwitching(false);
    }
  };

  return (
    <select
      aria-label={label}
      title={label}
      value={activeHotelId ?? ""}
      disabled={switching}
      onChange={(event) => { void handleChange(event.target.value); }}
      className="text-[13.5px] font-semibold text-white bg-transparent border-none cursor-pointer truncate max-w-[min(48vw,320px)] max-[720px]:max-w-[38vw] disabled:opacity-50 [&>option]:text-slate-900"
    >
      {!activeHotelId && <option value="">{label}</option>}
      {hotels.map((hotel) => (
        <option key={hotel.id} value={hotel.id}>
          {hotel.name}
        </option>
      ))}
    </select>
  );
}
