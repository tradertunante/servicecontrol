// FILE: app/(app)/dashboard/_components/QuickLinks.tsx
"use client";

import type { CSSProperties } from "react";
import { useTranslations } from "next-intl";

export default function QuickLinks({
  routerPush,
  inputBorder,
  inputBg,
  fg,
  shadowSm,
  showAnalytics,
}: {
  routerPush: (path: string) => void;
  inputBorder: string;
  inputBg: string;
  fg: string;
  shadowSm: string;
  showAnalytics: boolean;
}) {
  const t = useTranslations("app.dashboard");

  const btn: CSSProperties = {
    textAlign: "left",
    padding: 16,
    borderRadius: 14,
    border: `1px solid ${inputBorder}`,
    background: inputBg,
    color: fg,
    boxShadow: shadowSm,
    cursor: "pointer",
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 w-full mt-6">
      <button onClick={() => routerPush("/areas")} className="quickBtn w-full" style={btn}>
        <div style={{ fontSize: 16, fontWeight: 900 }}>{t("viewAllDepts")}</div>
        <div style={{ marginTop: 4, opacity: 0.7, fontSize: 13 }}>{t("exploreAudits")}</div>
      </button>

      {showAnalytics && (
        <button onClick={() => routerPush("/analytics")} className="quickBtn w-full" style={btn}>
          <div style={{ fontSize: 16, fontWeight: 900 }}>{t("analytics")}</div>
          <div style={{ marginTop: 4, opacity: 0.7, fontSize: 13 }}>{t("collaboratorRanking")}</div>
        </button>
      )}
    </div>
  );
}
