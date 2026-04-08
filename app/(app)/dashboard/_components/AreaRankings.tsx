// FILE: app/(app)/dashboard/_components/AreaRankings.tsx
"use client";

import type { CSSProperties } from "react";
import type { AuditRunRow } from "../_lib/dashboardTypes";

type TrendPoint = {
  key: string; // "Dic", "Ene", etc.
  avg: number | null;
  count: number;
};

type AreaRankingRow = {
  areaId: string;
  areaName: string;

  avg: number | null;
  count: number;

  trend3m?: TrendPoint[];
};

function RankingItemRow({
  area,
  badge,
  rowBg,
  border,
  fg,
  miniBtn,
  onGoAreaDetail,
}: {
  area: AreaRankingRow;
  badge: string;
  rowBg: string;
  border: string;
  fg: string;
  miniBtn: CSSProperties;
  onGoAreaDetail: (areaId: string) => void;
}) {
  const formatPct = (n: number | null | undefined) => {
    if (n === null || n === undefined || !Number.isFinite(Number(n))) return "—";
    return `${Number(n).toFixed(1)}%`;
  };

  const trendLabel = (t?: TrendPoint[]) => {
    if (!t || t.length === 0) return { label: "Tendencia 3 meses:", text: "—" };

    const parts = t.map((p) => `${p.key} (${p.count ?? 0})`);
    return { label: "Tendencia 3 meses:", text: parts.join(" - ") };
  };

  const trend = trendLabel(area.trend3m);

  return (
    <div
      className="rankingRow"
      style={{
        background: rowBg,
        border: `1px solid ${border}`,
        color: fg,
      }}
    >
      <div className="rankingBadgeSlot">
        <div className="rankingBadge" aria-hidden>
          <span>{badge}</span>
        </div>
      </div>

      <div className="rankingContent">
        <div className="rankingTitle">{area.areaName}</div>

        <div className="rankingTrend">
          <span className="rankingTrendLabel">{trend.label}</span>
          <span className="rankingTrendValue">{trend.text}</span>
        </div>

        <div className="rankingMeta">{area.count ?? 0} auditorías registradas</div>
      </div>

      <div className="rankingAside">
        <div className="rankingScoreBlock">
          <div className="rankingScoreLabel">Score</div>
          <div className="rankingScore">{formatPct(area.avg)}</div>
        </div>

        <button className="rankingBtn" style={miniBtn} onClick={() => onGoAreaDetail(area.areaId)}>
          Ver detalle
        </button>
      </div>
    </div>
  );
}

export default function AreaRankings({
  card,
  rowBg,
  border,
  fg,
  miniBtn,
  top3Areas,
  worst3Areas,
  runs, // compat
  onGoAreaDetail,
  selectedYear,
}: {
  card: CSSProperties;
  rowBg: string;
  border: string;
  fg: string;
  miniBtn: CSSProperties;
  top3Areas: AreaRankingRow[];
  worst3Areas: AreaRankingRow[];
  runs: AuditRunRow[];
  onGoAreaDetail: (areaId: string) => void;
  selectedYear: number;
}) {
  return (
    <div className="gridTwo" data-onboarding="area-rankings">
      <div style={card} className="card">
        <div className="sectionTitle">Top 3 departamentos con mejor performance ({selectedYear})</div>
        <div className="list">
          {(top3Areas ?? []).length === 0 ? (
            <div style={{ opacity: 0.7 }}>No hay datos suficientes.</div>
          ) : (
            top3Areas.slice(0, 3).map((a, i) => (
              <RankingItemRow
                key={`${a.areaId}-${i}`}
                area={a}
                badge={["🥇", "🥈", "🥉"][i] ?? "🏅"}
                rowBg={rowBg}
                border={border}
                fg={fg}
                miniBtn={miniBtn}
                onGoAreaDetail={onGoAreaDetail}
              />
            ))
          )}
        </div>
      </div>

      <div style={card} className="card">
        <div className="sectionTitle">Top 3 departamentos con peor performance ({selectedYear})</div>
        <div className="list">
          {(worst3Areas ?? []).length === 0 ? (
            <div style={{ opacity: 0.7 }}>No hay datos suficientes.</div>
          ) : (
            worst3Areas.slice(0, 3).map((a, i) => (
              <RankingItemRow
                key={`${a.areaId}-${i}`}
                area={a}
                badge="⚠️"
                rowBg={rowBg}
                border={border}
                fg={fg}
                miniBtn={miniBtn}
                onGoAreaDetail={onGoAreaDetail}
              />
            ))
          )}
        </div>
      </div>

      <style jsx global>{`
        .gridTwo {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
          gap: 16px;
        }

        .list {
          display: flex;
          flex-direction: column;
          gap: 10px;
        }

        .rankingRow {
          display: grid;
          grid-template-columns: 44px minmax(0, 1fr) minmax(124px, auto);
          grid-template-areas: "badge content aside";
          align-items: center;
          column-gap: 14px;
          min-height: 0;
          padding: 13px 16px 13px 14px;
          border-radius: 16px;
          box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.3), 0 8px 20px rgba(15, 23, 42, 0.04);
        }

        .rankingBadgeSlot {
          grid-area: badge;
          align-self: center;
        }

        .rankingBadge {
          width: 42px;
          height: 42px;
          display: grid;
          place-items: center;
          flex-shrink: 0;
        }

        .rankingBadge span {
          font-size: 21px;
          line-height: 1;
        }

        .rankingContent {
          grid-area: content;
          min-width: 0;
          display: flex;
          flex-direction: column;
          justify-content: center;
          gap: 4px;
        }

        .rankingTitle {
          font-weight: 950;
          font-size: 16px;
          line-height: 1.2;
          white-space: normal;
          overflow: visible;
          text-overflow: unset;
          word-break: break-word;
          overflow-wrap: anywhere;
          color: ${fg};
        }

        .rankingTrend {
          display: flex;
          flex-wrap: wrap;
          gap: 4px;
          align-items: center;
          min-width: 0;
        }

        .rankingTrendLabel {
          font-size: 12px;
          font-weight: 900;
          white-space: nowrap;
          opacity: 0.62;
        }

        .rankingTrendValue {
          font-size: 12px;
          letter-spacing: 0.1px;
          opacity: 0.82;
          min-width: 0;
          word-break: break-word;
          overflow-wrap: anywhere;
        }

        .rankingMeta {
          font-size: 12px;
          line-height: 1.35;
          opacity: 0.58;
        }

        .rankingAside {
          grid-area: aside;
          display: flex;
          flex-direction: column;
          align-items: flex-end;
          justify-content: center;
          gap: 6px;
          min-width: 124px;
          text-align: right;
          align-self: center;
          justify-self: end;
        }

        .rankingScoreBlock {
          display: grid;
          gap: 2px;
          justify-items: end;
        }

        .rankingScoreLabel {
          font-size: 11px;
          font-weight: 900;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          opacity: 0.5;
        }

        .rankingScore {
          font-weight: 950;
          font-size: 30px;
          line-height: 1;
          letter-spacing: -0.04em;
          white-space: nowrap;
        }

        .rankingBtn {
          min-width: 112px;
          width: fit-content;
        }

        @media (max-width: 720px) {
          .rankingRow {
            grid-template-columns: 40px minmax(0, 1fr);
            grid-template-areas:
              "badge content"
              "aside aside";
            padding: 14px;
            row-gap: 10px;
          }

          .rankingBadgeSlot {
            align-self: start;
          }

          .rankingAside {
            min-width: 0;
            flex-direction: row;
            align-items: center;
            justify-content: space-between;
            gap: 10px;
            text-align: left;
            width: 100%;
          }

          .rankingScoreBlock {
            justify-items: start;
          }

          .rankingScore {
            font-size: 24px;
          }

          .rankingBtn {
            width: auto;
            min-width: 120px;
          }
        }

        @media (max-width: 520px) {
          .rankingBadge {
            width: 38px;
            height: 38px;
            border-radius: 12px;
          }

          .rankingAside {
            align-items: stretch;
            flex-direction: column;
            text-align: left;
          }

          .rankingScoreBlock {
            justify-items: start;
          }

          .rankingBtn {
            width: 100%;
          }
        }
      `}</style>
    </div>
  );
}
