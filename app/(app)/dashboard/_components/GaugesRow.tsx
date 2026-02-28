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
}: {
  card: CSSProperties;
  monthScore: ScoreAgg;
  quarterScore: ScoreAgg;
  yearScore: ScoreAgg;
}) {
  const items = [
    { title: monthTitle(), score: monthScore },
    { title: quarterTitle(), score: quarterScore },
    { title: yearTitle(), score: yearScore },
  ];

  return (
    <div className="gridGauges">
      {items.map((a, idx) => {
        const avgNum = safeNumber(a.score?.avg);
        const label = formatPct(a.score?.avg);
        const count = a.score?.count ?? 0;

        return (
          <div key={idx} style={card} className="card gaugeCard">
            <div className="gaugeWrap">
              <GaugeChart value={avgNum ?? 0} />
              <div className="gaugeText">
                <div className="gaugePct">{label}</div>
                <div className="gaugeCount">({count} auditorías)</div>
              </div>
            </div>

            <div className="gaugeTitle">{a.title}</div>
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
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 12px;
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
        /* Por si GaugeChart usa <tspan> o grupos */
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
        }

        @media (max-width: 720px) {
          .gaugePct {
            font-size: 30px;
          }
        }
      `}</style>
    </div>
  );
}

function monthTitle() {
  const d = new Date();
  const m = d.toLocaleDateString("es-ES", { month: "long" });
  const cap = m.charAt(0).toUpperCase() + m.slice(1);
  return `${cap} de ${d.getFullYear()}`;
}

function quarterTitle() {
  const q = Math.floor(new Date().getMonth() / 3) + 1;
  return `Q${q} ${new Date().getFullYear()}`;
}

function yearTitle() {
  return `Año ${new Date().getFullYear()}`;
}