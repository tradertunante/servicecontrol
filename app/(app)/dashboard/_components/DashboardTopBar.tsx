// FILE: app/(app)/dashboard/_components/DashboardTopBar.tsx
"use client";

import type { CSSProperties } from "react";
import type { Profile } from "../_lib/dashboardTypes";

export default function DashboardTopBar({
  profile,
  areasCount,
  selectedHotelName,
  canChooseHotel,
  ghostBtn,
  onChangeHotel,
}: {
  profile: Profile | null;
  areasCount: number;
  selectedHotelName: string;
  canChooseHotel: boolean;
  ghostBtn: CSSProperties;
  onChangeHotel: () => void;
}) {
  return (
    <div className="topBar">
      <div className="topText">
        Hola{profile?.full_name ? `, ${profile.full_name}` : ""}. Rol: <strong>{profile?.role}</strong> · Departamentos:{" "}
        <strong>{areasCount}</strong> · Hotel seleccionado: <strong>{selectedHotelName}</strong>
      </div>

      {canChooseHotel ? (
        <button style={ghostBtn} onClick={onChangeHotel}>
          Cambiar hotel
        </button>
      ) : null}
    </div>
  );
}