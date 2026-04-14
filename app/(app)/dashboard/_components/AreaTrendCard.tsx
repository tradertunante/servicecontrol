"use client";

import { useMemo, useState } from "react";
import { useLocale, useTranslations } from "next-intl";

const MONTH_LABELS_EN = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const MONTH_LABELS_ES = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];

type MonthPoint = { month: string; label: string; score: number };
type AreaSeries = { areaId: string; areaName: string; points: MonthPoint[] };
type AuditRun = { area_id: string; score: number | null; executed_at: string | null };
type Area = { id: string; name: string };

const COLORS = [
  "#2563eb", "#dc2626", "#16a34a", "#d97706", "#7c3aed",
  "#0891b2", "#db2777", "#65a30d", "#ea580c", "#4f46e5",
];

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

export default function AreaTrendCard({ runs, areas }: { runs: AuditRun[]; areas: Area[] }) {
  const locale = useLocale();
  const t = useTranslations("app.dashboard");
  const MONTH_LABELS = locale === "es" ? MONTH_LABELS_ES : MONTH_LABELS_EN;

  const [months] = useState(6);
  const [hover, setHover] = useState<{ x: number; y: number; score: number; area: string } | null>(null);

  const series = useMemo(() => {
    const now = new Date();
    const cutoff = new Date(now.getFullYear(), now.getMonth() - months + 1, 1);
    const grouped = new Map<string, Map<string, number[]>>();

    for (const run of runs) {
      if (!run.area_id || run.score == null || !run.executed_at) continue;
      const d = new Date(run.executed_at);
      if (d < cutoff) continue;
      const monthKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      if (!grouped.has(run.area_id)) grouped.set(run.area_id, new Map());
      const areaMap = grouped.get(run.area_id)!;
      if (!areaMap.has(monthKey)) areaMap.set(monthKey, []);
      areaMap.get(monthKey)!.push(run.score);
    }

    const monthKeys: string[] = [];
    for (let i = 0; i < months; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() - months + 1 + i, 1);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      monthKeys.push(key);
    }

    const areaNameById = new Map(areas.map((a) => [a.id, a.name]));
    const result: AreaSeries[] = [];

    for (const [areaId, monthMap] of grouped) {
      const points: MonthPoint[] = [];
      for (const mk of monthKeys) {
        const scores = monthMap.get(mk);
        if (!scores || scores.length === 0) continue;
        const avg = scores.reduce((s, v) => s + v, 0) / scores.length;
        const [y, m] = mk.split("-");
        points.push({
          month: mk,
          label: `${MONTH_LABELS[parseInt(m, 10) - 1]} ${y.slice(2)}`,
          score: Math.round(avg * 10) / 10,
        });
      }
      if (points.length >= 2) {
        result.push({ areaId, areaName: areaNameById.get(areaId) || "Area", points });
      }
    }

    result.sort((a, b) => a.areaName.localeCompare(b.areaName));
    return result;
  }, [runs, areas, months, MONTH_LABELS]);

  if (series.length === 0) {
    return (
      <div className="rounded-2xl border bg-white p-5">
        <h3 className="text-sm font-extrabold text-gray-900">{t("trend")}</h3>
        <p className="mt-2 text-xs text-gray-400">{t("trendInsufficient")}</p>
      </div>
    );
  }

  const width = 800;
  const height = 240;
  const padL = 50, padR = 20, padT = 20, padB = 32;
  const innerW = width - padL - padR;
  const innerH = height - padT - padB;

  const allMonths = Array.from(new Set(series.flatMap((s) => s.points.map((p) => p.month)))).sort();
  const monthLabels = allMonths.map((mk) => {
    const [y, m] = mk.split("-");
    return `${MONTH_LABELS[parseInt(m, 10) - 1]} ${y.slice(2)}`;
  });

  const xFor = (month: string) => {
    const idx = allMonths.indexOf(month);
    if (allMonths.length === 1) return padL + innerW / 2;
    return padL + (idx / (allMonths.length - 1)) * innerW;
  };

  const allScores = series.flatMap((s) => s.points.map((p) => p.score));
  const dataMin = Math.min(...allScores);
  const dataMax = Math.max(...allScores);
  const yMin = Math.max(0, Math.floor((dataMin - 5) / 10) * 10);
  const yMax = Math.min(100, Math.ceil((dataMax + 5) / 10) * 10);
  const yRange = yMax - yMin < 20 ? 20 : yMax - yMin;
  const yBottom = yMin;
  const yTop = yMin + yRange;

  const yFor = (score: number) => {
    const t = (clamp(score, yBottom, yTop) - yBottom) / yRange;
    return padT + (1 - t) * innerH;
  };

  const gridStep = yRange <= 20 ? 5 : 10;
  const gridLines: number[] = [];
  for (let v = yBottom; v <= yTop; v += gridStep) gridLines.push(v);

  return (
    <div className="rounded-2xl border bg-white p-5" data-onboarding="area-trend">
      <h3 className="text-sm font-extrabold text-gray-900 mb-3">{t("trend")}</h3>

      <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-auto">
        {gridLines.map((v) => (
          <g key={v}>
            <line x1={padL} y1={yFor(v)} x2={width - padR} y2={yFor(v)} stroke="rgba(0,0,0,0.06)" strokeWidth="1" />
            <text x={padL - 8} y={yFor(v) + 4} textAnchor="end" fontSize="14" fontWeight="700" fill="rgba(0,0,0,0.35)">{v}%</text>
          </g>
        ))}
        {allMonths.map((mk, i) => (
          <text key={mk} x={xFor(mk)} y={height - 8} textAnchor="middle" fontSize="14" fontWeight="700" fill="rgba(0,0,0,0.45)">
            {monthLabels[i]}
          </text>
        ))}
        {series.map((s, si) => {
          const color = COLORS[si % COLORS.length];
          const coords = s.points.map((p) => ({ x: xFor(p.month), y: yFor(p.score), score: p.score }));
          const lineD = coords.length <= 1 ? "" :
            `M ${coords[0].x.toFixed(1)} ${coords[0].y.toFixed(1)} ` +
            coords.slice(1).map((c) => `L ${c.x.toFixed(1)} ${c.y.toFixed(1)}`).join(" ");

          return (
            <g key={s.areaId}>
              {coords.length > 1 && <path d={lineD} fill="none" stroke={color} strokeWidth="3" strokeLinejoin="round" opacity={0.85} />}
              {coords.map((c, ci) => (
                <g key={ci} onMouseEnter={() => setHover({ x: c.x, y: c.y, score: c.score, area: s.areaName })} onMouseLeave={() => setHover(null)} style={{ cursor: "pointer" }}>
                  <circle cx={c.x} cy={c.y} r={14} fill="transparent" />
                  <circle cx={c.x} cy={c.y} r={5} fill="white" stroke={color} strokeWidth="2.5" />
                </g>
              ))}
            </g>
          );
        })}
        {hover && (() => {
          const label = `${hover.score}% ${hover.area}`;
          const tw = label.length * 8.5 + 20;
          const th = 30;
          const tx = hover.x + tw / 2 > width - padR ? hover.x - tw / 2 : hover.x - tw / 2 < padL ? padL : hover.x - tw / 2;
          const ty = hover.y - th - 10;
          return (
            <g style={{ pointerEvents: "none" }}>
              <rect x={tx} y={ty} width={tw} height={th} rx={8} fill="#0f172a" opacity={0.92} />
              <text x={tx + tw / 2} y={ty + th / 2 + 5} textAnchor="middle" fontSize="13" fontWeight="800" fill="white">{label}</text>
            </g>
          );
        })()}
      </svg>

      <div className="flex flex-wrap gap-3 mt-3">
        {series.map((s, si) => (
          <div key={s.areaId} className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: COLORS[si % COLORS.length] }} />
            <span className="text-xs font-semibold text-gray-600">{s.areaName}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
