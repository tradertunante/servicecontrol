// FILE: app/components/HeatMap.tsx
"use client";

import React, { useMemo } from "react";

type HeatCell = { value: number | null; count: number };

// ✅ Acepta sort_order para ordenar igual que Admin
export type HeatMapRow =
  | {
      // formato nuevo (recomendado)
      group?: string;        // ROOMS / A&B / SPA ...
      label?: string;        // nombre del departamento
      sort_order?: number | null;
      months: HeatCell[];
    }
  | {
      // compat con formato antiguo
      areaName?: string;
      months: HeatCell[];
    };

export default function HeatMap({ data, monthLabels }: { data: HeatMapRow[]; monthLabels: string[] }) {
  const rows = useMemo(() => {
    return (data ?? []).map((r: any) => ({
      group: (r.group ?? "").trim() || "Sin categoría",
      label: (r.label ?? r.areaName ?? "—") as string,
      sort_order: typeof r.sort_order === "number" ? r.sort_order : null,
      months: (r.months ?? []) as HeatCell[],
    }));
  }, [data]);

  const grouped = useMemo(() => {
    const map = new Map<
      string,
      {
        group: string;
        items: { label: string; sort_order: number | null; months: HeatCell[] }[];
      }
    >();

    for (const r of rows) {
      const g = (r.group ?? "").trim() || "Sin categoría";
      if (!map.has(g)) map.set(g, { group: g, items: [] });
      map.get(g)!.items.push({ label: r.label, sort_order: r.sort_order, months: r.months });
    }

    // ✅ Orden dentro del grupo: sort_order asc, luego label
    for (const v of map.values()) {
      v.items.sort((a, b) => {
        const ao = a.sort_order;
        const bo = b.sort_order;

        const aHas = typeof ao === "number";
        const bHas = typeof bo === "number";

        if (aHas && bHas && ao !== bo) return ao - bo;
        if (aHas && !bHas) return -1;
        if (!aHas && bHas) return 1;

        return (a.label ?? "").localeCompare(b.label ?? "", "es");
      });
    }

    // Orden de grupos: Rooms / A&B / Spa / resto / Sin categoría
    const priority = (g: string) => {
      const low = g.toLowerCase();
      if (low === "rooms") return 0;
      if (low === "a&b" || low === "a&b " || low === "f&b" || low === "fnb") return 1;
      if (low === "spa") return 2;
      if (low === "sin categoría") return 99;
      return 10;
    };

    return Array.from(map.values()).sort(
      (a, b) => priority(a.group) - priority(b.group) || a.group.localeCompare(b.group, "es")
    );
  }, [rows]);

  const cellBg = (v: number | null) => {
    if (v === null || !Number.isFinite(v)) return "rgba(0,0,0,0.04)";
    if (v < 60) return "rgba(198,40,40,0.20)";
    if (v < 80) return "rgba(239,108,0,0.18)";
    return "rgba(10,122,59,0.18)";
  };

  const cellText = (v: number | null) => {
    if (v === null || !Number.isFinite(v)) return "—";
    return `${v.toFixed(0)}%`;
  };

  const wrap: React.CSSProperties = { width: "100%", overflowX: "auto" };

  const table: React.CSSProperties = {
    width: "100%",
    borderCollapse: "separate",
    borderSpacing: 10,
    minWidth: 980,
  };

  const th: React.CSSProperties = {
    textAlign: "center",
    fontWeight: 950,
    opacity: 0.75,
    fontSize: 13,
    whiteSpace: "nowrap",
  };

  const thLeft: React.CSSProperties = { ...th, textAlign: "left", paddingLeft: 6 };

  const deptCell: React.CSSProperties = {
    textAlign: "left",
    fontWeight: 950,
    padding: "10px 14px",
    borderRadius: 12,
    background: "rgba(0,0,0,0.03)",
    border: "1px solid rgba(0,0,0,0.06)",
    whiteSpace: "nowrap",
  };

  const cell: React.CSSProperties = {
    textAlign: "center",
    fontWeight: 950,
    padding: "10px 12px",
    borderRadius: 12,
    border: "1px solid rgba(0,0,0,0.06)",
    whiteSpace: "nowrap",
    minWidth: 62,
  };

  const groupRow: React.CSSProperties = {
    fontWeight: 1000,
    fontSize: 14,
    opacity: 0.9,
    padding: "10px 14px",
    borderRadius: 14,
    border: "1px solid rgba(0,0,0,0.06)",
    background: "rgba(0,0,0,0.02)",
  };

  return (
    <div style={wrap}>
      <table style={table}>
        <thead>
          <tr>
            <th style={thLeft}>Departamento</th>
            {monthLabels.map((m) => (
              <th key={m} style={th}>
                {m}
              </th>
            ))}
          </tr>
        </thead>

        <tbody>
          {grouped.map((g) => (
            <React.Fragment key={g.group}>
              <tr>
                <td style={groupRow} colSpan={1 + monthLabels.length}>
                  {g.group}
                </td>
              </tr>

              {g.items.map((r) => (
                <tr key={`${g.group}-${r.label}`}>
                  <td style={deptCell}>{r.label}</td>
                  {monthLabels.map((_, idx) => {
                    const c = r.months[idx] ?? { value: null, count: 0 };
                    const v = c.value;
                    return (
                      <td
                        key={idx}
                        style={{ ...cell, background: cellBg(v) }}
                        title={v === null ? `Sin ejecuciones (${c.count})` : `${v.toFixed(1)}% · ejecuciones: ${c.count}`}
                      >
                        {cellText(v)}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </React.Fragment>
          ))}
        </tbody>
      </table>
    </div>
  );
}