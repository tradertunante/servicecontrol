// FILE: app/(app)/team/_components/target-assignments/CardHeader.tsx
"use client";

import type { CSSProperties } from "react";
import { useTranslations } from "next-intl";

type Props = {
  btn: CSSProperties;
  loading: boolean;
  saving: boolean;
  selectedAreaId: string;
  onRefresh: () => void;
  onOpenHistory: () => void;
};

export default function CardHeader({
  btn,
  loading,
  saving,
  selectedAreaId,
  onRefresh,
  onOpenHistory,
}: Props) {
  const t = useTranslations("app.team.targets");
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        gap: 12,
        alignItems: "flex-start",
        flexWrap: "wrap",
      }}
    >
      <div>
        <div style={{ fontSize: 18, fontWeight: 800 }}>
          {t("cardTitle")}
        </div>
        <div style={{ opacity: 0.8, marginTop: 6, fontSize: 13 }}>
          {t("cardSubtitle")}
        </div>
      </div>

      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
        <button
          style={btn}
          onClick={onRefresh}
          disabled={loading || saving}
        >
          {t("refresh")}
        </button>
        <button style={btn} onClick={onOpenHistory} disabled={!selectedAreaId}>
          {t("history")}
        </button>
      </div>
    </div>
  );
}
