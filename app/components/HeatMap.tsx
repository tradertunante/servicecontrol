"use client";

import React, { useMemo, useState } from "react";

type HeatCell = { value: number | null; count: number };

export type HeatMapRow = {
  group: string; // p.ej. "HK"
  label: string; // p.ej. "Housekeeping"
  months: HeatCell[]; // 12M + Año
  rowId?: string; // estable (area_id)
  children?: Array<{
    label: string; // nombre del template
    months: HeatCell[];
    templateId?: string;
  }>;
};

function pct(v: number) {
  return `${Math.round(v)}%`;
}

/**
 * ✅ Escala basada en globals.css (SIN colores hardcodeados)
 * Define en globals.css:
 * --heat-1..--heat-5 (de peor a mejor, o como lo tengas)
 * --heat-text, --heat-border
 */
function heatToken(score: number) {
  // Ajusta los cortes si quieres otra lógica
  if (score < 55) return "var(--heat-1)";
  if (score < 65) return "var(--heat-2)";
  if (score < 75) return "var(--heat-3)";
  if (score < 85) return "var(--heat-4)";
  return "var(--heat-5)";
}

export default function HeatMap({ data, monthLabels }: { data: HeatMapRow[]; monthLabels: string[] }) {
  const rows = useMemo(() => {
    return (data ?? []).map((r) => ({
      group: (r.group ?? "").trim() || "Sin categoría",
      label: (r.label ?? "—") as string,
      months: (r.months ?? []) as HeatCell[],
      rowId: (r.rowId ?? `${(r.group ?? "").trim()}__${(r.label ?? "").trim()}`) as string,
      children: (r.children ?? []) as any[],
    }));
  }, [data]);

  // ✅ Quitamos filas grupo (HK/FO/F&B) -> simplemente ordenamos por label y listo
  const sortedAreas = useMemo(() => {
    const copy = [...rows];
    copy.sort((a, b) => (a.label ?? "").localeCompare(b.label ?? "", "es"));
    return copy;
  }, [rows]);

  const [open, setOpen] = useState<Record<string, boolean>>({});
  const toggle = (rowId: string) => setOpen((s) => ({ ...s, [rowId]: !s[rowId] }));

  return (
    <div className="wrap">
      <div className="grid">
        {/* Header */}
        <div className="head leftHead">Departamento</div>
        {monthLabels.map((m) => (
          <div key={m} className="head">
            {m}
          </div>
        ))}

        {/* Body (solo áreas, sin grupos) */}
        {sortedAreas.map((area) => {
          const hasChildren = (area.children ?? []).length > 0;
          const isOpen = !!open[area.rowId!];

          return (
            <React.Fragment key={area.rowId}>
              {/* Area label */}
              <button
                type="button"
                className={`labelCell ${hasChildren ? "clickable" : ""}`}
                onClick={() => hasChildren && toggle(area.rowId!)}
                title={hasChildren ? "Ver desglose por auditoría" : ""}
              >
                <span className="labelInner">
                  {hasChildren ? <span className={`tri ${isOpen ? "open" : ""}`}>▶</span> : <span className="triGhost" />}
                  <span className="labelText">{area.label}</span>
                </span>
              </button>

              {/* Area months */}
              {area.months.map((c, i) => {
                const key = `${area.rowId}-m-${i}`;
                if (!c || c.count === 0 || c.value === null) {
                  return (
                    <div key={key} className="cell empty">
                      —
                    </div>
                  );
                }

                const bg = heatToken(c.value);
                return (
                  <div key={key} className="cell">
                    <div
                      className="pill"
                      style={{
                        background: bg,
                        color: "var(--heat-text, var(--text))",
                        boxShadow: "inset 0 0 0 1px var(--heat-border, rgba(0,0,0,0.08))",
                      }}
                    >
                      <div className="val">{pct(c.value)}</div>
                    </div>
                  </div>
                );
              })}

              {/* Children */}
              {hasChildren && isOpen
                ? area.children!.map((ch, idx) => (
                    <React.Fragment key={`${area.rowId}-ch-${idx}`}>
                      <div className="childLabelCell">
                        <span className="childDot">•</span>
                        <span className="childText">{ch.label}</span>
                      </div>

                      {(ch.months ?? []).map((c: HeatCell, i: number) => {
                        const key = `${area.rowId}-ch-${idx}-m-${i}`;
                        if (!c || c.count === 0 || c.value === null) {
                          return (
                            <div key={key} className="cell empty child">
                              —
                            </div>
                          );
                        }

                        const bg = heatToken(c.value);
                        return (
                          <div key={key} className="cell child">
                            <div
                              className="pill childPill"
                              style={{
                                background: bg,
                                color: "var(--heat-text, var(--text))",
                                boxShadow: "inset 0 0 0 1px var(--heat-border, rgba(0,0,0,0.08))",
                                opacity: 0.92,
                              }}
                            >
                              <div className="val childVal">{pct(c.value)}</div>
                            </div>
                          </div>
                        );
                      })}
                    </React.Fragment>
                  ))
                : null}
            </React.Fragment>
          );
        })}
      </div>

      <style jsx>{`
        .wrap {
          width: max-content;
        }

        .grid {
          display: grid;
          grid-template-columns: 260px repeat(${monthLabels.length}, 72px);
          gap: 10px;
          align-items: center;
        }

        .head {
          font-weight: 950;
          font-size: 14px;
          opacity: 0.9;
          text-align: center;
          padding: 10px 8px;
          border-radius: 12px;
          background: var(--heat-head-bg, rgba(0, 0, 0, 0.04));
          white-space: nowrap;
        }

        .leftHead {
          text-align: left;
          padding-left: 14px;
        }

        .labelCell {
          border: 0;
          background: var(--heat-label-bg, rgba(0, 0, 0, 0.03));
          padding: 10px 12px;
          border-radius: 14px;
          text-align: left;
          cursor: default;
        }

        .labelCell.clickable {
          cursor: pointer;
        }

        .labelCell.clickable:hover {
          background: var(--heat-label-bg-hover, rgba(0, 0, 0, 0.06));
        }

        .labelInner {
          display: flex;
          align-items: center;
          gap: 10px;
          min-width: 0;
        }

        .tri {
          display: inline-block;
          transform: rotate(0deg);
          transition: transform 0.12s ease;
          font-size: 12px;
          opacity: 0.7;
          width: 12px;
        }

        .tri.open {
          transform: rotate(90deg);
        }

        .triGhost {
          width: 12px;
        }

        .labelText {
          font-weight: 900;
          font-size: 13px;
          opacity: 0.95;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .childLabelCell {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 8px 12px 8px 28px;
          border-radius: 14px;
          background: var(--heat-child-label-bg, rgba(0, 0, 0, 0.02));
          text-align: left;
          min-width: 0;
        }

        .childDot {
          opacity: 0.6;
          flex-shrink: 0;
        }

        .childText {
          font-size: 12px;
          font-weight: 800;
          opacity: 0.85;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .cell {
          height: 38px;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .cell.empty {
          opacity: 0.6;
          font-weight: 800;
        }

        .pill {
          min-width: 56px;
          padding: 8px 10px;
          border-radius: 14px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
        }

        .val {
          font-weight: 950;
          font-size: 12px;
          opacity: 0.95;
        }

        .childVal {
          font-size: 11px;
          opacity: 0.9;
        }
      `}</style>
    </div>
  );
}