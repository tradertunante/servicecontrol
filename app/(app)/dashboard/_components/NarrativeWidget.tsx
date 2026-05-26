"use client";

import { useEffect, useState } from "react";

type Narrative = {
  id: string;
  period_label: string;
  period_type: string;
  narrative_hotel: string;
  overall_score: number | null;
  prev_overall_score: number | null;
  total_audits: number | null;
  created_at: string;
};

export default function NarrativeWidget({
  hotelId,
  periodType = "weekly",
}: {
  hotelId: string | null;
  periodType?: "weekly" | "monthly";
}) {
  const [narrative, setNarrative] = useState<Narrative | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!hotelId) { setLoading(false); return; }
    let alive = true;
    void fetch(`/api/reports/narratives/latest?hotel_id=${hotelId}&period_type=${periodType}`)
      .then(r => r.json())
      .then(d => { if (alive) { setNarrative(d.narrative ?? null); setLoading(false); } })
      .catch(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [hotelId, periodType]);

  if (loading || !narrative) return null;

  const trend = narrative.prev_overall_score != null && narrative.overall_score != null
    ? narrative.overall_score - narrative.prev_overall_score
    : null;

  const periodLabel = periodType === "weekly" ? "Semana" : "Mes";

  return (
    <div style={{
      background: "var(--card-bg, rgba(255,255,255,0.92))",
      border: "1px solid var(--border, rgba(0,0,0,0.12))",
      borderRadius: 14,
      padding: "20px 22px",
      boxShadow: "var(--shadow-lg, 0 10px 30px rgba(0,0,0,0.20))",
      marginBottom: 20,
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
        <span style={{ fontSize: 18 }}>✦</span>
        <div>
          <div style={{ fontWeight: 800, fontSize: 15, letterSpacing: 0.2 }}>
            Análisis IA · {periodLabel}
          </div>
          <div style={{ fontSize: 12, opacity: 0.55, marginTop: 1 }}>
            {narrative.period_label}
            {trend != null && (
              <span style={{ marginLeft: 8, color: trend >= 0 ? "#16a34a" : "#dc2626", fontWeight: 700 }}>
                {trend >= 0 ? "▲" : "▼"} {Math.abs(trend).toFixed(1)} pts vs período anterior
              </span>
            )}
          </div>
        </div>
      </div>
      <p style={{ margin: 0, fontSize: 14, lineHeight: 1.6, opacity: 0.85 }}>
        {narrative.narrative_hotel}
      </p>
    </div>
  );
}