// FILE: app/(app)/areas/[areaId]/_components/AreaTabs.tsx
"use client";

import type { TabKey } from "../_lib/areaTypes";

function tabBtn(active: boolean): React.CSSProperties {
  return {
    padding: "10px 14px",
    borderRadius: 12,
    border: "1px solid rgba(0,0,0,0.2)",
    background: active ? "#000" : "#fff",
    color: active ? "#fff" : "#000",
    fontWeight: 900,
    cursor: "pointer",
  };
}

export default function AreaTabs({
  activeTab,
  onChangeTab,
  role,
}: {
  activeTab: TabKey;
  onChangeTab: (t: TabKey) => void;
  role?: string | null;
}) {
  const isAuditor = role === "auditor";

  return (
    <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 18 }}>
      {!isAuditor && (
        <button style={tabBtn(activeTab === "dashboard")} onClick={() => onChangeTab("dashboard")}>
          Dashboard
        </button>
      )}
      {!isAuditor && (
        <button style={tabBtn(activeTab === "history")} onClick={() => onChangeTab("history")}>
          Historial
        </button>
      )}
      <button style={tabBtn(activeTab === "templates")} onClick={() => onChangeTab("templates")}>
        Auditorías disponibles
      </button>
    </div>
  );
}