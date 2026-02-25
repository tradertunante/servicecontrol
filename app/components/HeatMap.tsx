"use client";

import React, { useMemo, useState } from "react";

type HeatCell = { value: number | null; count: number };

export type HeatMapRow = {
  group?: string;
  label?: string;
  shortLabel?: string;
  months: HeatCell[];
  children?: {
    label?: string;
    shortLabel?: string;
    months: HeatCell[];
  }[];
  sort_order?: number | null;
};

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

/* 🔥 Fondo con opción sólida */
function scoreBg(value: number | null, solid = false) {
  if (value === null) return solid ? "#f2f2f2" : "rgba(0,0,0,0.03)";

  if (solid) {
    if (value < 60) return "#f8c9c9";
    if (value < 80) return "#ffe0c2";
    return "#cfe9da";
  }

  if (value < 60) return "rgba(198,40,40,0.18)";
  if (value < 80) return "rgba(239,108,0,0.18)";
  return "rgba(10,122,59,0.16)";
}

function scoreText(value: number | null) {
  if (value === null) return "#666";
  if (value < 60) return "#c62828";
  if (value < 80) return "#ef6c00";
  return "#0a7a3b";
}

function autoFontSizeByLen(text: string, base = 14, min = 10) {
  const len = (text ?? "").length;
  if (len <= 14) return base;
  if (len <= 22) return clamp(base - 2, min, base);
  if (len <= 30) return clamp(base - 3, min, base);
  return min;
}

function displayLabel(label?: string, shortLabel?: string) {
  return (shortLabel ?? "").trim() || (label ?? "");
}

export default function HeatMap({
  data,
  monthLabels,
}: {
  data: HeatMapRow[];
  monthLabels: string[];
}) {
  const [openKeys, setOpenKeys] = useState<Record<string, boolean>>({});

  const rows = useMemo(() => data ?? [], [data]);
  const lastIdx = monthLabels.length - 1;

  const toggle = (key: string) => {
    setOpenKeys((p) => ({ ...p, [key]: !p[key] }));
  };

  return (
    <>
      <div className="heatOuter">
        <div className="heatInner">

          {/* HEADER */}
          <div className="gridRow header">
            <div className="cell stickyLeft headLeft">Departamento</div>

            {monthLabels.slice(0, lastIdx).map((m) => (
              <div key={m} className="cell head">
                {m}
              </div>
            ))}

            <div className="cell stickyRight headRight">
              {monthLabels[lastIdx]}
            </div>
          </div>

          {/* BODY */}
          {rows.map((r, index) => {
            const key = `${r.group}-${r.label}-${index}`;
            const isOpen = !!openKeys[key];
            const hasChildren = (r.children ?? []).length > 0;

            const label = displayLabel(r.label, r.shortLabel);
            const fontSize = autoFontSizeByLen(label, 14, 11);

            return (
              <React.Fragment key={key}>
                <div className="gridRow">
                  {/* LEFT */}
                  <button
                    className={`cell stickyLeft leftCell ${
                      hasChildren ? "clickable" : ""
                    }`}
                    onClick={() => hasChildren && toggle(key)}
                    style={{ fontSize }}
                  >
                    {hasChildren && (
                      <span className="chev">
                        {isOpen ? "▾" : "▸"}
                      </span>
                    )}
                    <span className="leftText">{label}</span>
                  </button>

                  {/* MESES */}
                  {r.months.slice(0, lastIdx).map((c, i) => (
                    <div
                      key={i}
                      className="cell val"
                      style={{
                        background: scoreBg(c.value),
                      }}
                    >
                      {c.value == null ? (
                        "—"
                      ) : (
                        <span style={{ color: scoreText(c.value) }}>
                          {c.value.toFixed(1)}%
                          <span className="cnt"> ({c.count})</span>
                        </span>
                      )}
                    </div>
                  ))}

                  {/* AÑO (🔥 sólido) */}
                  <div
                    className="cell stickyRight val yearCell"
                    style={{
                      background: scoreBg(
                        r.months[lastIdx]?.value ?? null,
                        true
                      ),
                    }}
                  >
                    {r.months[lastIdx]?.value == null ? (
                      "—"
                    ) : (
                      <span
                        style={{
                          color: scoreText(
                            r.months[lastIdx]?.value ?? null
                          ),
                        }}
                      >
                        {r.months[lastIdx]?.value?.toFixed(1)}%
                        <span className="cnt">
                          ({r.months[lastIdx]?.count})
                        </span>
                      </span>
                    )}
                  </div>
                </div>

                {/* CHILDREN */}
                {hasChildren &&
                  isOpen &&
                  r.children?.map((ch, ci) => {
                    const childLabel = displayLabel(
                      ch.label,
                      ch.shortLabel
                    );
                    const childFont = autoFontSizeByLen(
                      childLabel,
                      12,
                      10
                    );

                    return (
                      <div
                        className="gridRow childRow"
                        key={`${key}-child-${ci}`}
                      >
                        <div
                          className="cell stickyLeft leftCell childLeft"
                          style={{ fontSize: childFont }}
                        >
                          • {childLabel}
                        </div>

                        {ch.months
                          .slice(0, lastIdx)
                          .map((c, i) => (
                            <div
                              key={i}
                              className="cell val childVal"
                              style={{
                                background: scoreBg(c.value),
                              }}
                            >
                              {c.value == null
                                ? "—"
                                : `${c.value.toFixed(
                                    1
                                  )}% (${c.count})`}
                            </div>
                          ))}

                        <div
                          className="cell stickyRight val yearCell childVal"
                          style={{
                            background: scoreBg(
                              ch.months[lastIdx]?.value ??
                                null,
                              true
                            ),
                          }}
                        >
                          {ch.months[lastIdx]?.value ==
                          null
                            ? "—"
                            : `${ch.months[
                                lastIdx
                              ]?.value?.toFixed(
                                1
                              )}% (${ch.months[lastIdx]?.count})`}
                        </div>
                      </div>
                    );
                  })}
              </React.Fragment>
            );
          })}
        </div>
      </div>

      <style jsx>{`
        .heatOuter {
          overflow-x: auto;
          -webkit-overflow-scrolling: touch;
        }

        .heatInner {
          min-width: max-content;
          display: grid;
          gap: 10px;
        }

        .gridRow {
          display: grid;
          grid-template-columns: 240px repeat(${lastIdx}, 92px) 120px;
          gap: 10px;
          align-items: stretch;
        }

        .cell {
          height: 44px;
          border-radius: 12px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-weight: 900;
          background: white;
          box-shadow: 0 6px 18px rgba(0, 0, 0, 0.05);
        }

        .stickyLeft {
          position: sticky;
          left: 0;
          z-index: 5;
          background: white;
        }

        .stickyRight {
          position: sticky;
          right: 0;
          z-index: 6;
        }

        .yearCell {
          border: 2px solid rgba(0, 0, 0, 0.15);
          box-shadow: 0 10px 25px rgba(0, 0, 0, 0.08);
        }

        .leftCell {
          justify-content: flex-start;
          padding: 0 12px;
          gap: 8px;
        }

        .leftCell.clickable {
          cursor: pointer;
        }

        .leftText {
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .chev {
          opacity: 0.6;
        }

        .cnt {
          font-size: 11px;
          opacity: 0.7;
        }

        .childRow .cell {
          height: 38px;
          box-shadow: none;
        }

        .childLeft {
          background: #fafafa;
        }

        @media (max-width: 720px) {
          .gridRow {
            grid-template-columns: 190px repeat(${lastIdx}, 84px) 96px;
          }
        }
      `}</style>
    </>
  );
}