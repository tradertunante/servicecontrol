// FILE: app/(app)/dashboard/_components/GaugesRow.tsx
"use client";

import type { CSSProperties } from "react";
import GaugeChart from "@/app/components/GaugeChart";

type ScoreAgg = {
  avg: number | null;
  count: number;
};

function formatPct(avg: number | null | undefined) {
  if (avg === null || avg === undefined) return "—";
  const n = Number(avg);
  if (!Number.isFinite(n)) return "—";
  return `${n.toFixed(1)}%`;
}

function safeNumber(avg: number | null | undefined) {
  const n = Number(avg);
  if (!Number.isFinite(n)) return null;
  return n;
}

export default function GaugesRow({
  card,
  monthScore,
  quarterScore,
  yearScore,
  prevMonthScore,
  prevQuarterScore,
  prevYearScore,
}: {
  card: CSSProperties;
  monthScore: ScoreAgg;
  quarterScore: ScoreAgg;
  yearScore: ScoreAgg;
  prevMonthScore: ScoreAgg;
  prevQuarterScore: ScoreAgg;
  prevYearScore: ScoreAgg;
}) {
  const items = [
    {
      title: monthTitle(),
      score: monthScore,
      previousTitle: monthTitle(-1),
      previousScore: prevMonthScore,
    },
    {
      title: quarterTitle(),
      score: quarterScore,
      previousTitle: quarterTitle(-1),
      previousScore: prevQuarterScore,
    },
    {
      title: yearTitle(),
      score: yearScore,
      previousTitle: yearTitle(-1),
      previousScore: prevYearScore,
    },
  ];

  return (
    <div className="gridGauges">
      {items.map((a, idx) => {
        const avgNum = safeNumber(a.score?.avg);
        const label = formatPct(a.score?.avg);
        const count = a.score?.count ?? 0;
        const prevLabel = formatPct(a.previousScore?.avg);
        const prevCount = a.previousScore?.count ?? 0;
        const hasPrevData = a.previousScore?.avg != null;

        return (
          <div key={idx} style={card} className="card gaugeCard">
            <div className="gaugeTitle">{a.title}</div>

            <div className="gaugeBody">
              <div className="gaugeWrap">
                <GaugeChart value={avgNum ?? 0} label="" />

                <div className="gaugeText">
                  <div className="gaugePct">{label}</div>
                  <div className="gaugeCount">({count} auditorías)</div>
                </div>
              </div>

              <div className="gaugeCompare">
                <div className="gaugeCompareTitle">{a.previousTitle}</div>
                {hasPrevData ? (
                  <>
                    <div className="gaugeComparePct">{prevLabel}</div>
                    <div className="gaugeCompareCount">
                      {prevCount === 1 ? "1 auditoría" : `${prevCount} auditorías`}
                    </div>
                  </>
                ) : (
                  <div className="gaugeCompareEmpty">Sin dato previo</div>
                )}
              </div>
            </div>
          </div>
        );
      })}

      <style jsx>{`
        .gridGauges {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
          gap: 16px;
          margin-bottom: 16px;
        }

        .gaugeCard {
          display: grid;
          gap: 12px;
        }

        .gaugeBody {
          display: grid;
          grid-template-columns: minmax(0, 1fr) 120px;
          gap: 14px;
          align-items: end;
        }

        .gaugeWrap {
          position: relative;
          display: grid;
          place-items: center;
        }

        /* ✅ CLAVE: ocultar cualquier texto que pinte GaugeChart en el centro (SVG <text>) */
        .gaugeWrap :global(svg text) {
          display: none !important;
        }
        .gaugeWrap :global(svg tspan) {
          display: none !important;
        }

        .gaugeText {
          position: absolute;
          display: grid;
          place-items: center;
          gap: 2px;
          text-align: center;
          pointer-events: none;
        }

        .gaugePct {
          font-weight: 950;
          font-size: 34px;
          line-height: 1;
          color: var(--text);
          text-shadow: none !important;
          filter: none !important;
          -webkit-text-stroke: 0 !important;
        }

        .gaugeCount {
          font-size: 12px;
          opacity: 0.7;
          font-weight: 800;
          color: var(--text);
          text-shadow: none !important;
          filter: none !important;
        }

        .gaugeTitle {
          font-weight: 950;
          opacity: 0.85;
          text-align: center;
        }

        .gaugeCompare {
          min-width: 0;
          display: grid;
          gap: 2px;
          align-content: end;
          justify-items: start;
          text-align: left;
          padding-left: 2px;
          padding-bottom: 18px;
        }

        .gaugeCompareTitle {
          font-size: 11px;
          font-weight: 800;
          opacity: 0.68;
          line-height: 1.25;
        }

        .gaugeComparePct {
          font-size: 20px;
          font-weight: 950;
          line-height: 1;
          letter-spacing: -0.03em;
          opacity: 0.82;
        }

        .gaugeCompareCount,
        .gaugeCompareEmpty {
          font-size: 11px;
          line-height: 1.35;
          opacity: 0.58;
          font-weight: 700;
        }

        @media (max-width: 720px) {
          .gaugeBody {
            grid-template-columns: 1fr;
            gap: 10px;
          }

          .gaugeCompare {
            justify-items: center;
            text-align: center;
            padding-left: 0;
            padding-bottom: 0;
          }

          .gaugePct {
            font-size: 30px;
          }

          .gaugeComparePct {
            font-size: 19px;
          }
        }
      `}</style>
    </div>
  );
}

function monthTitle(yearOffset = 0) {
  const d = new Date();
  d.setFullYear(d.getFullYear() + yearOffset);
  const m = d.toLocaleDateString("es-ES", { month: "long" });
  const cap = m.charAt(0).toUpperCase() + m.slice(1);
  return `${cap} de ${d.getFullYear()}`;
}

function quarterTitle(yearOffset = 0) {
  const d = new Date();
  d.setFullYear(d.getFullYear() + yearOffset);
  const q = Math.floor(new Date().getMonth() / 3) + 1;
  return `Q${q} ${d.getFullYear()}`;
}

function yearTitle(yearOffset = 0) {
  const d = new Date();
  d.setFullYear(d.getFullYear() + yearOffset);
  return `Año ${d.getFullYear()}`;
}
