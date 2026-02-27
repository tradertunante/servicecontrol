// FILE: app/components/HeatMap.tsx
"use client";

import React, { useMemo, useState } from "react";

type HeatCell = { value: number | null; count: number };

export type HeatMapRow =
  | {
      group?: string;
      label?: string;
      months: HeatCell[];
    }
  | {
      areaName?: string;
      months: HeatCell[];
    };

function clamp(n: number, a: number, b: number) {
  return Math.max(a, Math.min(b, n));
}

/**
 * Color por %:
 * 0   => rojo
 * 50  => amarillo
 * 100 => verde
 */
function bgFromPct(v: number | null) {
  if (v === null || Number.isNaN(v)) return "rgba(0,0,0,0.06)";
  const t = clamp(v, 0, 100) / 100; // 0..1
  const hue = 0 + 120 * t; // 0=rojo, 120=verde
  // un poco más suave para que no “cante”
  return `hsl(${hue.toFixed(0)} 70% 78%)`;
}

function textColorForPct(v: number | null) {
  if (v === null || Number.isNaN(v)) return "rgba(0,0,0,0.65)";
  // si baja mucho, ponemos texto más oscuro (fondo más “caliente” y claro)
  // si está alto, igual oscuro. Mantener simple:
  return "rgba(0,0,0,0.85)";
}

export default function HeatMap({
  data,
  monthLabels,
}: {
  data: HeatMapRow[];
  monthLabels: string[];
}) {
  const rows = useMemo(() => {
    return (data ?? []).map((r: any) => ({
      group: (r.group ?? "").trim() || "Sin categoría",
      label: (r.label ?? r.areaName ?? "—") as string,
      months: (r.months ?? []) as HeatCell[],
    }));
  }, [data]);

  const grouped = useMemo(() => {
    const map = new Map<
      string,
      { group: string; items: { label: string; months: HeatCell[] }[] }
    >();
    for (const r of rows) {
      const key = r.group || "Sin categoría";
      if (!map.has(key)) map.set(key, { group: key, items: [] });
      map.get(key)!.items.push({ label: r.label, months: r.months });
    }
    return Array.from(map.values()).map((g) => ({
      ...g,
      items: g.items.sort((a, b) => a.label.localeCompare(b.label)),
    }));
  }, [rows]);

  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({});

  // ✅ Identificamos la columna anual: si el último label es "Año" lo tratamos como anual
  const yearColIndex =
    monthLabels.length > 0 && monthLabels[monthLabels.length - 1].toLowerCase() === "año"
      ? monthLabels.length - 1
      : -1;

  return (
    <div className="heatRoot">
      <div className="heatGrid">
        {/* Header */}
        <div className="hCell hSticky hDept">Departamento</div>

        {monthLabels.map((m, idx) => {
          const isYear = idx === yearColIndex;
          return (
            <div
              key={idx}
              className={`hCell hSticky ${isYear ? "hYear" : ""}`}
              title={isYear ? "Promedio anual" : m}
            >
              {m}
            </div>
          );
        })}

        {/* Body */}
        {grouped.map((g) => {
          const isOpen = openGroups[g.group] ?? true;
          return (
            <React.Fragment key={g.group}>
              <div className="groupRow">
                <button
                  className="groupBtn"
                  onClick={() =>
                    setOpenGroups((p) => ({
                      ...p,
                      [g.group]: !(p[g.group] ?? true),
                    }))
                  }
                  aria-label={`toggle ${g.group}`}
                >
                  <span className="chev">{isOpen ? "▾" : "▸"}</span>
                  <span className="gName">{g.group}</span>
                </button>
              </div>
              <div className="groupFill" />

              {isOpen
                ? g.items.map((it) => (
                    <React.Fragment key={`${g.group}-${it.label}`}>
                      <div className="deptCell">
                        <div className="deptText" title={it.label}>
                          {it.label}
                        </div>
                      </div>

                      {monthLabels.map((_, mi) => {
                        const isYear = mi === yearColIndex;
                        const cell = it.months?.[mi] ?? { value: null, count: 0 };
                        const v = cell.value;

                        return (
                          <div
                            key={mi}
                            className={`mCell ${isYear ? "mYearCell" : ""}`}
                            title={
                              v === null
                                ? "—"
                                : `${v.toFixed(1)}% · ${cell.count} audits`
                            }
                          >
                            <div
                              className={`mBox ${isYear ? "mYearBox" : ""}`}
                              style={{
                                background: bgFromPct(v),
                                color: textColorForPct(v),
                              }}
                            >
                              {v === null ? "—" : `${Math.round(v)}%`}
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
        /* ✅ Ajuste fino para que quepa en desktop */
        .heatRoot {
          --deptW: 240px;
          --cellW: 66px;
          --cellH: 38px;
          --gap: 10px;
          --radius: 14px;
        }

        .heatGrid {
          display: grid;
          grid-template-columns: var(--deptW) repeat(${monthLabels.length}, var(--cellW));
          gap: var(--gap);
          align-items: center;
        }

        .hCell {
          height: var(--cellH);
          border-radius: var(--radius);
          background: rgba(255, 255, 255, 0.65);
          display: flex;
          align-items: center;
          justify-content: center;
          font-weight: 950;
          border: 1px solid rgba(0, 0, 0, 0.06);
          box-shadow: 0 4px 14px rgba(0, 0, 0, 0.04);
          padding: 0 10px;
          white-space: nowrap;
        }

        .hDept {
          justify-content: center;
        }

        /* sticky header dentro del contenedor */
        .hSticky {
          position: sticky;
          top: 0;
          z-index: 2;
        }

        /* ✅ Header Año (diferenciado) */
        .hYear {
          background: rgba(0, 0, 0, 0.08);
          border: 2px solid rgba(0, 0, 0, 0.18);
          font-weight: 1000;
        }

        .groupRow {
          grid-column: 1 / 2;
        }

        .groupFill {
          grid-column: 2 / -1;
          height: 1px;
          background: rgba(0, 0, 0, 0.06);
          margin: 6px 0;
        }

        .groupBtn {
          width: 100%;
          height: var(--cellH);
          border-radius: var(--radius);
          border: 1px solid rgba(0, 0, 0, 0.06);
          background: rgba(255, 255, 255, 0.9);
          font-weight: 950;
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 0 12px;
          cursor: pointer;
          box-shadow: 0 4px 14px rgba(0, 0, 0, 0.04);
        }

        .chev {
          opacity: 0.75;
          font-size: 14px;
          width: 14px;
          text-align: center;
          flex-shrink: 0;
        }

        .gName {
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .deptCell {
          height: var(--cellH);
          border-radius: var(--radius);
          border: 1px solid rgba(0, 0, 0, 0.06);
          background: rgba(255, 255, 255, 0.75);
          display: flex;
          align-items: center;
          padding: 0 12px;
          box-shadow: 0 4px 14px rgba(0, 0, 0, 0.04);
        }

        .deptText {
          font-weight: 950;
          font-size: 13.5px;
          line-height: 1.1;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
          width: 100%;
        }

        .mCell {
          height: var(--cellH);
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .mBox {
          width: 100%;
          height: var(--cellH);
          border-radius: var(--radius);
          border: 1px solid rgba(0, 0, 0, 0.06);
          display: flex;
          align-items: center;
          justify-content: center;
          font-weight: 1000;
          font-size: 13px;
          box-shadow: 0 4px 14px rgba(0, 0, 0, 0.04);
          user-select: none;
        }

        /* ✅ Columna Año (celdas) */
        .mYearCell {
          /* nada aquí; lo marcamos en la caja */
        }
        .mYearBox {
          border: 2px solid rgba(0, 0, 0, 0.22);
          box-shadow: 0 8px 22px rgba(0, 0, 0, 0.10);
        }

        /* ✅ En pantallas medias, compactamos aún más para que NO haya scroll */
        @media (max-width: 1200px) {
          .heatRoot {
            --deptW: 220px;
            --cellW: 60px;
            --cellH: 36px;
            --gap: 8px;
          }
          .deptText {
            font-size: 13px;
          }
          .mBox {
            font-size: 12.5px;
          }
        }

        /* ✅ Móvil: aquí NO necesitamos que “quepa”; dejamos scroll (lo gestiona HeatMapCard) */
        @media (max-width: 720px) {
          .heatRoot {
            --deptW: 220px;
            --cellW: 72px;
            --cellH: 40px;
            --gap: 10px;
          }
          .deptText {
            font-size: 13px;
          }
          .mBox {
            font-size: 13px;
          }
        }
      `}</style>
    </div>
  );
}