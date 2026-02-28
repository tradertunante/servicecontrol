// FILE: app/components/HeatMap.tsx
"use client";

import React, { useMemo, useState } from "react";

type HeatCell = { value: number | null; count: number };

export type HeatMapRow = {
  key: string;
  group?: string;
  label: string;
  months: HeatCell[];
  kind?: "area" | "audit";
  parentKey?: string;
};

function bgForScore(score: number) {
  // ✅ colores vienen de Globals.css
  // Usamos color-mix para hacer pasteles sin hardcodear hex.
  // Si el navegador no soporta color-mix, al menos se verá el borde/estado.
  if (score < 60) return "color-mix(in srgb, var(--danger) 18%, white)";
  if (score < 80) return "color-mix(in srgb, var(--warn) 18%, white)";
  return "color-mix(in srgb, var(--ok) 18%, white)";
}

function borderForScore(score: number) {
  if (score < 60) return "color-mix(in srgb, var(--danger) 55%, rgba(0,0,0,0.10))";
  if (score < 80) return "color-mix(in srgb, var(--warn) 55%, rgba(0,0,0,0.10))";
  return "color-mix(in srgb, var(--ok) 55%, rgba(0,0,0,0.10))";
}

export default function HeatMap({ data, monthLabels }: { data: HeatMapRow[]; monthLabels: string[] }) {
  const rows = useMemo(() => {
    const safe = Array.isArray(data) ? data : [];
    return safe.map((r: any) => ({
      key: String(r.key ?? `${r.parentKey ?? "x"}:${r.label}`),
      group: (r.group ?? "—").trim() || "—",
      label: String(r.label ?? "—"),
      months: (r.months ?? []) as HeatCell[],
      kind: (r.kind ?? (r.parentKey ? "audit" : "area")) as "area" | "audit",
      parentKey: r.parentKey ? String(r.parentKey) : undefined,
    }));
  }, [data]);

  // separamos parents y children
  const parents = useMemo(() => rows.filter((r) => r.kind === "area"), [rows]);
  const childrenByParent = useMemo(() => {
    const map = new Map<string, HeatMapRow[]>();
    for (const r of rows) {
      if (r.kind !== "audit" || !r.parentKey) continue;
      if (!map.has(r.parentKey)) map.set(r.parentKey, []);
      map.get(r.parentKey)!.push(r);
    }
    // orden por label
    for (const [k, arr] of map) {
      arr.sort((a, b) => a.label.localeCompare(b.label, "es"));
      map.set(k, arr);
    }
    return map;
  }, [rows]);

  // expanded state por área
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  const toggle = (key: string) => setExpanded((s) => ({ ...s, [key]: !s[key] }));

  const flatToRender = useMemo(() => {
    const out: Array<{ row: HeatMapRow; level: number }> = [];
    for (const p of parents) {
      out.push({ row: p, level: 0 });

      const kids = childrenByParent.get(p.key) ?? [];
      if (kids.length > 0 && expanded[p.key]) {
        for (const c of kids) out.push({ row: c, level: 1 });
      }
    }
    return out;
  }, [parents, childrenByParent, expanded]);

  return (
    <div className="wrap">
      <div className="grid">
        {/* header */}
        <div className="h headLeft">Departamento</div>
        {monthLabels.map((m) => (
          <div key={m} className="h headCell">
            {m}
          </div>
        ))}

        {/* rows */}
        {flatToRender.map(({ row, level }) => {
          const kids = row.kind === "area" ? childrenByParent.get(row.key) ?? [] : [];
          const hasKids = row.kind === "area" && kids.length > 0;

          return (
            <React.Fragment key={row.key}>
              <button
                type="button"
                className={`left ${row.kind === "audit" ? "child" : ""}`}
                onClick={() => {
                  if (hasKids) toggle(row.key);
                }}
                style={{
                  paddingLeft: level === 1 ? 26 : 14,
                  cursor: hasKids ? "pointer" : "default",
                }}
              >
                {hasKids ? (
                  <span className={`caret ${expanded[row.key] ? "open" : ""}`} aria-hidden="true">
                    ▶
                  </span>
                ) : (
                  <span className="caret spacer" aria-hidden="true">
                    ▶
                  </span>
                )}

                <span className={`label ${row.kind === "audit" ? "labelChild" : ""}`}>{row.label}</span>
              </button>

              {monthLabels.map((_, idx) => {
                const cell = row.months?.[idx];
                const v = cell?.value;

                if (v == null || !Number.isFinite(v)) {
                  return (
                    <div key={`${row.key}:${idx}`} className="cell empty">
                      —
                    </div>
                  );
                }

                const pct = Math.round(v);
                return (
                  <div
                    key={`${row.key}:${idx}`}
                    className="cell pill"
                    style={{
                      background: bgForScore(pct),
                      borderColor: borderForScore(pct),
                    }}
                    title={`${pct}% (${cell.count} auditorías)`}
                  >
                    {pct}%
                  </div>
                );
              })}
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
          grid-template-columns: 280px repeat(${monthLabels.length}, 72px);
          gap: 10px;
          align-items: center;
        }

        .h {
          background: rgba(255, 255, 255, 0.7);
          border: 1px solid rgba(0, 0, 0, 0.08);
          border-radius: 12px;
          padding: 10px 12px;
          font-weight: 950;
          font-size: 13px;
          text-align: center;
          white-space: nowrap;
        }

        .headLeft {
          text-align: left;
        }

        .headCell {
          text-align: center;
        }

        .left {
          border: 0;
          background: rgba(255, 255, 255, 0.55);
          border-radius: 12px;
          padding: 10px 14px;
          font-weight: 950;
          font-size: 13px;
          text-align: left;
          display: flex;
          align-items: center;
          gap: 10px;
        }

        .left.child {
          background: rgba(255, 255, 255, 0.42);
          font-weight: 900;
        }

        .caret {
          width: 16px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          font-size: 12px;
          opacity: 0.8;
          transform: rotate(0deg);
          transition: transform 120ms ease;
        }

        .caret.open {
          transform: rotate(90deg);
        }

        .caret.spacer {
          opacity: 0;
        }

        .label {
          min-width: 0;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .labelChild {
          opacity: 0.92;
        }

        .cell {
          height: 40px;
          border-radius: 12px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-weight: 950;
          font-size: 13px;
          border: 1px solid rgba(0, 0, 0, 0.10);
          background: rgba(255, 255, 255, 0.55);
        }

        .cell.empty {
          opacity: 0.7;
        }

        .pill {
          border-width: 1px;
        }

        @media (max-width: 720px) {
          .grid {
            grid-template-columns: 250px repeat(${monthLabels.length}, 70px);
            gap: 8px;
          }
        }
      `}</style>
    </div>
  );
}