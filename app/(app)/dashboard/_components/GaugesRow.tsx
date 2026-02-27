// FILE: app/(app)/dashboard/_components/GaugesRow.tsx
"use client";

import type { CSSProperties } from "react";
import GaugeChart from "@/app/components/GaugeChart";
import { getCurrentQuarter } from "../_lib/dashboardUtils";
import type { ScoreAgg } from "../_lib/dashboardTypes";

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
  const now = new Date();
  const monthName = now.toLocaleDateString("es-ES", { month: "long", year: "numeric" });

  return (
    <div className="gridGauges">
      <div style={card} className="card">
        <GaugeChart
          value={monthScore.avg ?? 0}
          label={monthName.charAt(0).toUpperCase() + monthName.slice(1)}
          count={monthScore.count}
          size={180}
        />
      </div>

      <div style={card} className="card">
        <GaugeChart value={quarterScore.avg ?? 0} label={`Q${getCurrentQuarter()} ${now.getFullYear()}`} count={quarterScore.count} size={180} />
      </div>

      <div style={card} className="card">
        <GaugeChart value={yearScore.avg ?? 0} label={`Año ${now.getFullYear()}`} count={yearScore.count} size={180} />
      </div>
    </div>
  );
}