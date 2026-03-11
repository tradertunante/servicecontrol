// FILE: app/(app)/team/_components/reaudits/ReauditFilters.tsx
"use client";

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
  const btn: React.CSSProperties = {
    padding: "10px 14px",
    borderRadius: 12,
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
        borderRadius: 16,
        padding: 14,
        display: "flex",
        gap: 10,
        flexWrap: "wrap",
        alignItems: "center",
      }}
    >
      <input
        value={q}
        onChange={(e) => onQChange(e.target.value)}
        placeholder="Buscar área, template, colaborador, auditor..."
        style={{
          flex: 1,
          minWidth: 260,
          padding: "10px 12px",
          borderRadius: 12,
          border: "1px solid var(--border)",
          background: "var(--card-bg)",
        }}
      />

      <select
        value={statusFilter}
        onChange={(e) => onStatusFilterChange(e.target.value as any)}
        style={btn}
      >
        <option value="all">Todos los estados</option>
        <option value="pending_training">pending_training</option>
        <option value="blocked_by_non_operational">
          blocked_by_non_operational
        </option>
        <option value="draft">ready_for_reaudit</option>
      </select>

      <button onClick={onReload} style={btn}>
        Recargar
      </button>
    </div>
  );
}
