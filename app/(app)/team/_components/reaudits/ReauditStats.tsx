// FILE: app/(app)/team/_components/reaudits/ReauditStats.tsx
"use client";

import { useTranslations } from "next-intl";
import type { ReauditStats as ReauditStatsType } from "../../_lib/reauditTypes";

export default function ReauditStats({
  stats,
}: {
  stats: ReauditStatsType;
}) {
  const t = useTranslations("app.team.reaudits");
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
        gap: 10,
      }}
    >
      {[
        { label: t("statsTotal"), value: stats.total },
        { label: t("statsPendingTraining"), value: stats.pendingTraining },
        { label: t("statsBlocked"), value: stats.blocked },
        { label: t("statsReady"), value: stats.ready },
      ].map((item) => (
        <div
          key={item.label}
          style={{
            background: "var(--card-bg)",
            border: "1px solid var(--border)",
            borderRadius: 14,
            padding: 12,
            boxShadow: "var(--shadow-sm)",
          }}
        >
          <div style={{ fontSize: 13, color: "var(--muted)", fontWeight: 800 }}>
            {item.label}
          </div>
          <div style={{ marginTop: 4, fontSize: 24, fontWeight: 950 }}>
            {item.value}
          </div>
        </div>
      ))}
    </div>
  );
}
