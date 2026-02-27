// FILE: app/(app)/areas/[areaId]/_components/Sparkline.tsx
"use client";

export default function Sparkline({ values }: { values: number[] }) {
  const w = 120;
  const h = 34;
  const pad = 3;

  if (!values.length) {
    return (
      <div style={{ width: w, height: h, display: "flex", alignItems: "center", opacity: 0.6 }}>
        —
      </div>
    );
  }

  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = Math.max(1, max - min);

  const pts = values.map((v, i) => {
    const x = pad + (i * (w - pad * 2)) / Math.max(1, values.length - 1);
    const y = pad + (h - pad * 2) * (1 - (v - min) / span);
    return { x, y };
  });

  const d = pts
    .map((p, i) => `${i === 0 ? "M" : "L"} ${p.x.toFixed(2)} ${p.y.toFixed(2)}`)
    .join(" ");

  return (
    <div style={{ width: w, height: h, overflow: "hidden" }}>
      <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} role="img" aria-label="tendencia" style={{ display: "block" }}>
        <path d={d} fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
        <circle cx={pts[pts.length - 1].x} cy={pts[pts.length - 1].y} r="2.5" fill="currentColor" />
      </svg>
    </div>
  );
}