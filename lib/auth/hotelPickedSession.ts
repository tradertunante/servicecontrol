"use client";

import { getCurrentUser } from "./clientSession";

// Marca de "ya elegí hotel en esta pestaña". Guarda el id del usuario, así que
// si otra persona entra en la misma pestaña el selector vuelve a aparecer.
const KEY = "sc-hotel-picked-user";

export function markHotelPicked(userId: string) {
  try {
    sessionStorage.setItem(KEY, userId);
  } catch {
    // Almacenamiento bloqueado: el selector aparecerá en cada carga.
  }
}

export function isHotelPicked(userId: string) {
  try {
    return sessionStorage.getItem(KEY) === userId;
  } catch {
    return false;
  }
}

export async function markHotelPickedForCurrentUser() {
  const user = await getCurrentUser();
  if (user) markHotelPicked(user.id);
}
