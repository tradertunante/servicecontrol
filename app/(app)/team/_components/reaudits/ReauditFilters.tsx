// FILE: app/(app)/team/_components/reaudits/ReauditFilters.tsx
"use client";

import { useTranslations } from "next-intl";

export default function ReauditFilters({
  q,
  onQChange,
  statusFilter,
  onStatusFilterChange,
  onReload,
}: {
  q: string;
  onQChange: (value: string) => void;
  statusFilter: "all" | "pending_training" | "blocked_by_non_operational" | "draft";
  onStatusFilterChange: (
    value: "all" | "pending_training" | "blocked_by_non_operational" | "draft"
  ) => void;
  onReload: () => void | Promise<void>;
}) {
  const t = useTranslations("app.team.reaudits");
  const btn: React.CSSProperties = {
    padding: "9px 12px",
    borderRadius: 10,
    border: "1px solid var(--border)",
    background: "var(--card-bg)",
    fontWeight: 900,
    cursor: "pointer",
  };

  return (
    <div
      style={{
        background: "var(--card-bg)",
        border: "1px solid var(--border)",
        borderRadius: 14,
        padding: 12,
        display: "flex",
        gap: 8,
        flexWrap: "wrap",
        alignItems: "stretch",
      }}
    >
      <input
        value={q}
        onChange={(e) => onQChange(e.target.value)}
        placeholder={t("searchPlaceholder")}
        style={{
          flex: "1 1 220px",
          minWidth: 0,
          padding: "9px 11px",
          borderRadius: 10,
          border: "1px solid var(--border)",
          background: "var(--card-bg)",
        }}
      />

      <select
        value={statusFilter}
        onChange={(e) => onStatusFilterChange(e.target.value as any)}
        style={btn}
      >
        <option value="all">{t("allStatuses")}</option>
        <option value="pending_training">{t("statusPendingTraining")}</option>
        <option value="blocked_by_non_operational">{t("statusBlocked")}</option>
        <option value="draft">{t("statusReady")}</option>
      </select>

      <button onClick={onReload} style={btn}>
        {t("reload")}
      </button>
    </div>
  );
}
