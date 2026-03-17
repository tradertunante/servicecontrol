"use client";

export type ActiveHotelPayload = {
  ok: boolean;
  hotel_id: string | null;
  error?: string | null;
  role?: string | null;
  profile_hotel_id?: string | null;
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
