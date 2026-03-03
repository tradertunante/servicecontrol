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
  channelLabel?: string;
  compareTag?: "internal" | "quality";
};

function bgForScore(score: number, channel?: string) {
  if (channel === "quality") {
    if (score < 60) return "color-mix(in srgb, var(--danger) 22%, #f3e8ff)";
    if (score < 80) return "color-mix(in srgb, var(--warn) 22%, #f3e8ff)";
    return "color-mix(in srgb, var(--ok) 22%, #f3e8ff)";
  }
  if (score < 60) return "color-mix(in srgb, var(--danger) 18%, white)";
  if (score < 80) return "color-mix(in srgb, var(--warn) 18%, white)";
  return "color-mix(in srgb, var(--ok) 18%, white)";
}

function borderForScore(score: number) {
  if (score < 60) return "color-mix(in srgb, var(--danger) 55%, rgba(0,0,0,0.10))";
  if (score < 80) return "color-mix(in srgb, var(--warn) 55%, rgba(0,0,0,0.10))";
  return "color-mix(in srgb, var(--ok) 55%, rgba(0,0,0,0.10))";
}

export default function HeatMap({
  data,
  monthLabels,
  compareMode = false,
}: {
  data: HeatMapRow[];
  monthLabels: string[];
  compareMode?: boolean;
}) {
  const rows = useMemo(() => {
    const safe = Array.isArray(data) ? data : [];
    return safe.map((r: any) => ({
      key: String(r.key ?? `${r.parentKey ?? "x"}:${r.label}`),
      group: (r.group ?? "—").trim() || "—",
      label: String(r.label ?? "—"),
      months: (r.months ?? []) as HeatCell[],
      kind: (r.kind ?? (r.parentKey ? "audit" : "area")) as "area" | "audit",
      parentKey: r.parentKey ? String(r.parentKey) : undefined,
      channelLabel: r.channelLabel as string | undefined,
      compareTag: r.compareTag as "internal" | "quality" | undefined,
    }));
  }, [data]);

  const parents = useMemo(() => rows.filter((r) => r.kind === "area"), [rows]);

  const childrenByParent = useMemo(() => {
    const map = new Map<string, HeatMapRow[]>();
    for (const r of rows) {
      if (r.kind !== "audit" || !r.parentKey) continue;
      if (!map.has(r.parentKey)) map.set(r.parentKey, []);
      map.get(r.parentKey)!.push(r);
    }
    for (const [k, arr] of map) {
      arr.sort((a, b) => a.label.localeCompare(b.label, "es"));
      map.set(k, arr);
    }
    return map;
  }, [rows]);

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
        <div className="h headLeft">Departamento</div>
        {monthLabels.map((m) => (
          <div key={m} className="h headCell">{m}</div>
        ))}

        {flatToRender.map(({ row, level }) => {
          const kids = row.kind === "area" ? childrenByParent.get(row.key) ?? [] : [];
          const hasKids = row.kind === "area" && kids.length > 0;
          const isQuality = row.compareTag === "quality";
          const isInternal = row.compareTag === "internal";
          const isChild = row.kind === "audit";

          return (
            <React.Fragment key={row.key}>
              <button
                type="button"
                className={[
                  "left",
                  isChild ? "child" : "",
                  isQuality ? (isChild ? "qualityChild" : "qualityRow") : "",
                  isInternal ? "internalRow" : "",
                ].filter(Boolean).join(" ")}
                onClick={() => { if (hasKids) toggle(row.key); }}
                style={{
                  paddingLeft: level === 1 ? 26 : 14,
                  cursor: hasKids ? "pointer" : "default",
                }}
              >
                {hasKids ? (
                  <span className={`caret ${expanded[row.key] ? "open" : ""}`} aria-hidden="true">▶</span>
                ) : (
                  <span className="caret spacer" aria-hidden="true">▶</span>
                )}

                <span className={`label ${isChild ? "labelChild" : ""}`}>
                  {row.channelLabel ? (
                    <span>
                      <span className={`channelBadge ${isQuality ? "badgeQuality" : "badgeInternal"}`}>
                        {row.channelLabel}
                      </span>
                      {" "}{row.label}
                    </span>
                  ) : (
                    row.label
                  )}
                </span>
              </button>

              {monthLabels.map((_, idx) => {
                const cell = row.months?.[idx];
                const v = cell?.value;

                if (v == null || !Number.isFinite(v)) {
                  return (
                    <div
                      key={`${row.key}:${idx}`}
                      className={`cell empty ${isQuality ? "qualityCellBg" : ""}`}
                    >
                      —
                    </div>
                  );
                }

                const pct = Math.round(v);
                const count = cell?.count ?? 0;

                return (
                  <div
                    key={`${row.key}:${idx}`}
                    className={`cell pill ${isQuality ? "qualityCell qualityCellBg" : ""}`}
                    style={{
                      background: bgForScore(pct, row.compareTag),
                      borderColor: borderForScore(pct),
                    }}
                    title={`${pct}% (${count} auditorías)`}
                  >
                    <span className="cellScore">{pct}%</span>
                    {count > 0 && (
                      <span className="cellCount">({count})</span>
                    )}
                  </div>
                );
              })}
            </React.Fragment>
          );
        })}
      </div>

      <style jsx>{`
        .wrap { width: max-content; }

        .grid {
          display: grid;
          grid-template-columns: 280px repeat(${monthLabels.length}, 84px);
          gap: 10px;
          align-items: center;
        }

        .h {
          background: rgba(255,255,255,0.7);
          border: 1px solid rgba(0,0,0,0.08);
          border-radius: 12px;
          padding: 10px 12px;
          font-weight: 950;
          font-size: 13px;
          text-align: center;
          white-space: nowrap;
        }

        .headLeft { text-align: left; }
        .headCell { text-align: center; }

        .left {
          border: 0;
          background: rgba(255,255,255,0.55);
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
          background: rgba(255,255,255,0.42);
          font-weight: 900;
        }

        .left.internalRow {
          background: rgba(59,130,246,0.06);
          border: 1px solid rgba(59,130,246,0.18);
        }

        .left.qualityRow {
          background: var(--quality-bg);
          border: 1px solid var(--quality-border);
        }

        .left.qualityChild {
          background: var(--quality-bg-child);
          border: 1px solid var(--quality-border);
        }

        .qualityCellBg {
          background: var(--quality-bg) !important;
        }

        .channelBadge {
          font-size: 11px;
          font-weight: 900;
          padding: 2px 6px;
          border-radius: 999px;
          white-space: nowrap;
        }

        .badgeInternal {
          background: rgba(59,130,246,0.12);
          color: rgb(29,78,216);
          border: 1px solid rgba(59,130,246,0.25);
        }

        .badgeQuality {
          background: var(--quality-badge-bg);
          color: var(--quality-badge-text);
          border: 1px solid var(--quality-badge-border);
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

        .caret.open { transform: rotate(90deg); }
        .caret.spacer { opacity: 0; }

        .label {
          min-width: 0;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .labelChild { opacity: 0.92; }

        .cell {
          height: 44px;
          border-radius: 12px;
          display: flex;
          flex-direction: row;
          align-items: center;
          justify-content: center;
          gap: 3px;
          border: 1px solid rgba(0,0,0,0.10);
          background: rgba(255,255,255,0.55);
        }

        .cell.empty { opacity: 0.7; }
        .pill { border-width: 1px; }

        .qualityCell {
          border-left: 3px solid var(--quality-cell-accent) !important;
        }

        .cellScore {
          font-weight: 950;
          font-size: 13px;
          line-height: 1;
        }

        .cellCount {
          font-size: 10px;
          font-weight: 700;
          opacity: 0.65;
          line-height: 1;
          margin-top: 1px;
        }

        @media (max-width: 720px) {
          .grid {
            grid-template-columns: 250px repeat(${monthLabels.length}, 82px);
            gap: 8px;
          }
        }
      `}</style>
    </div>
  );
}