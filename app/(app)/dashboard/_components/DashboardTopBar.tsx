// FILE: app/(app)/dashboard/_components/DashboardTopBar.tsx
"use client";

import type { CSSProperties } from "react";
import { useTranslations } from "next-intl";
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
  const t = useTranslations("app.dashboard");

  return (
    <div className="topBar">
      <div className="topText">
        {t("greeting")}{profile?.full_name ? `, ${profile.full_name}` : ""}. {t("role")} <strong>{profile?.role}</strong> · {t("departments")}{" "}
        <strong>{areasCount}</strong> · {t("selectedHotel")} <strong>{selectedHotelName}</strong>
      </div>

      {canChooseHotel ? (
        <button style={ghostBtn} onClick={onChangeHotel}>
          {t("changeHotel")}
        </button>
      ) : null}
    </div>
  );
}
