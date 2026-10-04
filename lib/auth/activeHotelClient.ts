"use client";

export type ActiveHotelPayload = {
  ok: boolean;
  hotel_id: string | null;
  hotel_name: string | null;
  error?: string | null;
  role?: string | null;
  profile_hotel_id?: string | null;
  is_trial?: boolean;
  trial_expires_at?: string | null;
  available_hotels?: { id: string; name: string; role: string }[];
};

async function parseJson(response: Response) {
  return (await response.json().catch(() => null)) as ActiveHotelPayload | null;
}

export async function fetchActiveHotel() {
  const response = await fetch("/api/session/active-hotel", {
    cache: "no-store",
    credentials: "same-origin",
  });
  const payload = await parseJson(response);

  if (!response.ok || !payload) {
    throw new Error(payload?.error ?? "No se pudo resolver el hotel activo.");
  }

  return payload;
}

export async function setActiveHotel(hotelId: string | null) {
  const response = await fetch("/api/session/active-hotel", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    credentials: "same-origin",
    body: JSON.stringify(hotelId ? { hotel_id: hotelId } : { clear: true }),
  });
  const payload = await parseJson(response);

  if (!response.ok || !payload) {
    throw new Error(payload?.error ?? "No se pudo actualizar el hotel activo.");
  }

  return payload;
}

// Sincroniza el hotel activo entre pestañas del mismo navegador: al cambiar de
// hotel en una pestaña, las demás reciben el nuevo hotel y se recargan.
const ACTIVE_HOTEL_CHANNEL = "sc-active-hotel";

export function notifyActiveHotelChanged(hotelId: string) {
  if (typeof BroadcastChannel === "undefined") return;
  const channel = new BroadcastChannel(ACTIVE_HOTEL_CHANNEL);
  channel.postMessage({ hotelId });
  channel.close();
}

export function onActiveHotelChanged(listener: (hotelId: string) => void) {
  if (typeof BroadcastChannel === "undefined") return () => {};
  const channel = new BroadcastChannel(ACTIVE_HOTEL_CHANNEL);
  channel.onmessage = (event: MessageEvent<{ hotelId?: string }>) => {
    if (event.data?.hotelId) listener(event.data.hotelId);
  };
  return () => channel.close();
}
