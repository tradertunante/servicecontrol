// FILE: app/(app)/dashboard/_components/WorstAuditsCard.tsx
"use client";

import type { CSSProperties } from "react";
import type { WorstAudit } from "../_lib/dashboardTypes";
import { scoreColor } from "../_lib/dashboardUtils";

function isFiniteNumber(x: unknown): x is number {
  return typeof x === "number" && Number.isFinite(x);
}

export default function WorstAuditsCard({
  card,
  rowBg,
  border,
  fg,
  miniBtn,
  worst3Audits,
  onGoWorstAuditDetail,
}: {
  card: CSSProperties;
  rowBg: string;
  border: string;
  fg: string;
  miniBtn: CSSProperties;
  worst3Audits: WorstAudit[];
  onGoWorstAuditDetail: (areaId: string, templateId: string) => void;
}) {
  if (!worst3Audits || worst3Audits.length === 0) return null;

  return (
    <div style={{ ...card, marginTop: 16 }} className="card">
      <div className="sectionTitle">Top 3 auditorías con peor resultado (promedio)</div>

      <div style={{ display: "grid", gap: 12 }}>
        {worst3Audits.map((a, idx) => {
          const avgNum = isFiniteNumber(a?.avg) ? a.avg : null;
          const avgLabel = avgNum === null ? "—" : `${avgNum.toFixed(1)}%`;
          const avgColor = avgNum === null ? "var(--text)" : scoreColor(avgNum);

          return (
            <div
              key={a.id}
              className="rowCard"
              style={{ background: rowBg, border: `1px solid ${border}`, color: fg }}
            >
              <div className="rowLeft">
                <span className="rowBadge">{idx === 0 ? "🚨" : "⚠️"}</span>
                <div style={{ minWidth: 0 }}>
                  <div className="rowTitle">{a.name}</div>
                  <div style={{ marginTop: 4, fontSize: 12, opacity: 0.75 }}>
                    {a.count} ejecución{a.count === 1 ? "" : "es"} · promedio del periodo
                  </div>
                </div>
              </div>

              <div className="rowRight">
                <span className="rowScore" style={{ color: avgColor }}>
                  {avgLabel}
                </span>

                <button onClick={() => onGoWorstAuditDetail(a.areaId, a.id)} style={miniBtn} className="rowBtn">
                  Ver detalle
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}