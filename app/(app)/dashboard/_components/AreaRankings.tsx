// FILE: app/(app)/dashboard/_components/AreaRankings.tsx
"use client";

import type { CSSProperties } from "react";

type TrendPoint = {
  key: string; // "Dic", "Ene", etc.
  avg: number | null;
  count: number;
};

type AreaRankingRow = {
  areaId: string;
  areaName: string;

  // 🔑 IMPORTANTE:
  // En tu dashboard, los agregados suelen venir como:
  //  - avg (media)
  //  - count (nº auditorías)
  // Si tú lo llamas distinto, cambia aquí el nombre.
  avg: number | null;
  count: number;

  // Tendencia últimos 3 meses (para el texto bajo el título)
  trend3m?: TrendPoint[];
};

export default function AreaRankings({
  card,
  rowBg,
  border,
  fg,
  miniBtn,
  top3Areas,
  worst3Areas,
  runs, // lo mantenemos por compat, aunque aquí no lo usamos directamente
  onGoAreaDetail,
}: {
  card: CSSProperties;
  rowBg: string;
  border: string;
  fg: string;
  miniBtn: CSSProperties;
  top3Areas: AreaRankingRow[];
  worst3Areas: AreaRankingRow[];
  runs: any[];
  onGoAreaDetail: (areaId: string) => void;
}) {
  const formatPct = (n: number | null | undefined) => {
    if (n === null || n === undefined || !Number.isFinite(Number(n))) return "—";
    return `${Number(n).toFixed(1)}%`;
  };

  const trendLabel = (t?: TrendPoint[]) => {
    if (!t || t.length === 0) return { label: "Tendencia 3 meses:", text: "—" };
    const parts = t.map((p) => `${p.key} — (${p.count})`);
    return { label: "Tendencia 3 meses:", text: parts.join("   ") };
  };

  const renderRow = (a: AreaRankingRow, idx: number, badge: string) => {
    const t = trendLabel(a.trend3m);

    return (
      <div
        key={`${a.areaId}-${idx}`}
        className="rowCard"
        style={{
          background: rowBg,
          border: `1px solid ${border}`,
        }}
      >
        <div className="rowLeft">
          <div className="rowBadge" aria-hidden>
            {badge}
          </div>

          <div style={{ minWidth: 0 }}>
            <div className="rowTitle">{a.areaName}</div>

            <div className="rowTrend">
              <div className="rowTrendLabel">{t.label}</div>
              <div className="rowTrendItems">
                <div className="rowTrendItem">{t.text}</div>
              </div>
            </div>
          </div>
        </div>

        <div className="rowRight">
          <div className="rowMeta">({a.count ?? 0} auditorías)</div>
          <div className="rowScore">{formatPct(a.avg)}</div>

          <button className="rowBtn" style={miniBtn} onClick={() => onGoAreaDetail(a.areaId)}>
            Ver detalle
          </button>
        </div>
      </div>
    );
  };

  return (
    <div className="gridTwo">
      <div style={card} className="card">
        <div className="sectionTitle">Top 3 departamentos con mejor performance (2026)</div>
        <div className="list">
          {(top3Areas ?? []).length === 0 ? (
            <div style={{ opacity: 0.7 }}>No hay datos suficientes.</div>
          ) : (
            top3Areas.slice(0, 3).map((a, i) => renderRow(a, i, ["🥇", "🥈", "🥉"][i] ?? "🏅"))
          )}
        </div>
      </div>

      <div style={card} className="card">
        <div className="sectionTitle">Top 3 departamentos con peor performance (2026)</div>
        <div className="list">
          {(worst3Areas ?? []).length === 0 ? (
            <div style={{ opacity: 0.7 }}>No hay datos suficientes.</div>
          ) : (
            worst3Areas.slice(0, 3).map((a, i) => renderRow(a, i, "⚠️"))
          )}
        </div>
      </div>

      <style jsx>{`
        .gridTwo {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
          gap: 16px;
        }

        .list {
          display: flex;
          flex-direction: column;
          gap: 12px;
        }

        .rowCard {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 14px 16px;
          border-radius: 12px;
          gap: 12px;
        }

        .rowLeft {
          display: flex;
          align-items: flex-start;
          gap: 12px;
          min-width: 0;
          flex: 1;
        }

        .rowBadge {
          font-size: 22px;
          line-height: 22px;
          flex-shrink: 0;
        }

        .rowTitle {
          font-weight: 950;
          font-size: 16px;
          white-space: normal;
          overflow: visible;
          text-overflow: unset;
          word-break: break-word;
          overflow-wrap: anywhere;
          color: ${fg};
        }

        .rowTrend {
          margin-top: 6px;
          display: flex;
          flex-wrap: wrap;
          gap: 10px;
          opacity: 0.85;
        }

        .rowTrendLabel {
          font-size: 12px;
          font-weight: 900;
        }

        .rowTrendItems {
          display: flex;
          gap: 10px;
          flex-wrap: wrap;
        }

        .rowTrendItem {
          font-size: 12px;
        }

        .rowRight {
          display: flex;
          align-items: center;
          gap: 12px;
          flex-shrink: 0;
        }

        .rowMeta {
          font-size: 13px;
          opacity: 0.7;
          white-space: nowrap;
        }

        .rowScore {
          font-weight: 950;
          font-size: 20px;
          white-space: nowrap;
        }

        @media (max-width: 720px) {
          .rowCard {
            flex-direction: column;
            align-items: stretch;
            gap: 10px;
          }

          .rowRight {
            justify-content: space-between;
          }

          .rowBtn {
            width: 100%;
          }
        }
      `}</style>
    </div>
  );
}