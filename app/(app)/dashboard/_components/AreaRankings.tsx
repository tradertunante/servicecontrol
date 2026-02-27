// FILE: app/(app)/dashboard/_components/AreaRankings.tsx
"use client";

import type { CSSProperties } from "react";
import type { AreaScore, AuditRunRow } from "../_lib/dashboardTypes";
import { build3MonthTrendFromRuns, scoreColor } from "../_lib/dashboardUtils";

export default function AreaRankings({
  card,
  rowBg,
  border,
  fg,
  miniBtn,
  top3Areas,
  worst3Areas,
  runs,
  onGoAreaDetail,
}: {
  card: CSSProperties;
  rowBg: string;
  border: string;
  fg: string;
  miniBtn: CSSProperties;
  top3Areas: AreaScore[];
  worst3Areas: AreaScore[];
  runs: AuditRunRow[];
  onGoAreaDetail: (areaId: string) => void;
}) {
  const now = new Date();

  const renderAreaRow = (area: AreaScore, idx: number, kind: "best" | "worst") => {
    const badge = kind === "best" ? (idx === 0 ? "🥇" : idx === 1 ? "🥈" : "🥉") : "⚠️";
    const color = scoreColor(area.score);
    const trend = build3MonthTrendFromRuns(runs, area.id);

    return (
      <div key={area.id} className="rowCard" style={{ background: rowBg, border: `1px solid ${border}`, color: fg }}>
        <div className="rowLeft">
          <span className="rowBadge">{badge}</span>

          <div style={{ minWidth: 0 }}>
            <div className="rowTitle">{area.name}</div>

            <div className="rowTrend">
              <span className="rowTrendLabel">Tendencia 3 meses:</span>
              <div className="rowTrendItems">
                {trend.map((t) => (
                  <span key={`${t.key}-${t.year}-${t.monthIndex}`} className="rowTrendItem">
                    <strong>{t.key}</strong>{" "}
                    <span
                      style={{
                        color: t.avg === null ? "var(--placeholder)" : scoreColor(t.avg ?? 0),
                        fontWeight: 950,
                      }}
                    >
                      {t.avg === null ? "—" : `${(t.avg ?? 0).toFixed(1)}%`}
                    </span>{" "}
                    <span style={{ opacity: 0.65 }}>({t.count})</span>
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="rowRight">
          <span className="rowMeta">({area.count} auditorías)</span>
          <span className="rowScore" style={{ color }}>
            {area.score.toFixed(1)}%
          </span>
          <button onClick={() => onGoAreaDetail(area.id)} style={miniBtn} className="rowBtn">
            Ver detalle
          </button>
        </div>
      </div>
    );
  };

  if (top3Areas.length === 0 && worst3Areas.length === 0) return null;

  return (
    <div className="gridTwo" style={{ marginTop: 16 }}>
      <div style={card} className="card">
        <div className="sectionTitle">Top 3 departamentos con mejor performance ({now.getFullYear()})</div>
        <div style={{ display: "grid", gap: 12 }}>
          {top3Areas.length > 0 ? top3Areas.map((a, idx) => renderAreaRow(a, idx, "best")) : <div style={{ opacity: 0.7 }}>No hay datos suficientes.</div>}
        </div>
      </div>

      <div style={card} className="card">
        <div className="sectionTitle">Top 3 departamentos con peor performance ({now.getFullYear()})</div>
        <div style={{ display: "grid", gap: 12 }}>
          {worst3Areas.length > 0 ? worst3Areas.map((a, idx) => renderAreaRow(a, idx, "worst")) : <div style={{ opacity: 0.7 }}>No hay datos suficientes.</div>}
        </div>
      </div>
    </div>
  );
}