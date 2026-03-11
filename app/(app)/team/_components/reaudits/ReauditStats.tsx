// FILE: app/(app)/team/_components/reaudits/ReauditStats.tsx
"use client";

import type { ReauditStats as ReauditStatsType } from "../../_lib/reauditTypes";

export default function ReauditStats({
  stats,
}: {
  stats: ReauditStatsType;
}) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
        gap: 10,
      }}
    >
      {[
        { label: "Total Re-audits", value: stats.total },
        { label: "Pending Training", value: stats.pendingTraining },
        { label: "Blocked", value: stats.blocked },
        { label: "Ready", value: stats.ready },
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
