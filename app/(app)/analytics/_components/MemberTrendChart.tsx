// FILE: app/(app)/analytics/_components/MemberTrendChart.tsx
"use client";

import { useMemo } from "react";
import type { MemberTrendRow } from "../_lib/analyticsTypes";

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

function fmtPct(v: number) {
  return `${v.toFixed(2)}%`;
}

export default function MemberTrendChart({
  trend,
  height = 190,
}: {
  trend: MemberTrendRow[];
  height?: number;
}) {
  const points = useMemo(() => {
    // Convertimos FAIL% -> Éxito%
    const clean = (trend ?? [])
      .filter((t) => typeof t.fail_pct === "number" && isFinite(t.fail_pct as any))
      .map((t) => {
        const fail = t.fail_pct as number;
        const success = clamp(100 - fail, 0, 100);
        return {
          run_id: t.run_id,
          executed_at: t.executed_at,
          value: success,
        };
      });

    // orden por fecha (por si acaso)
    clean.sort((a, b) => {
      const ta = a.executed_at ? new Date(a.executed_at).getTime() : 0;
      const tb = b.executed_at ? new Date(b.executed_at).getTime() : 0;
      return ta - tb;
    });

    return clean;
  }, [trend]);

  if (!points.length) {
    return (
      <div className="rounded-2xl border bg-gray-50 p-4">
        <div className="text-sm font-extrabold text-gray-900">Gráfica</div>
        <div className="mt-1 text-xs font-semibold text-gray-500">
          No hay datos suficientes para dibujar (necesita auditorías con FAIL%).
        </div>
      </div>
    );
  }

  // SVG responsive
  const width = 1000;

  // ✅ Aumentamos padding izquierdo para que NO se corten los textos del eje Y
  const padL = 96;
  const padR = 18;
  const padT = 18;
  const padB = 40;

  const innerW = width - padL - padR;
  const innerH = height - padT - padB;

  const values = points.map((p) => p.value);
  let minV = Math.min(...values);
  let maxV = Math.max(...values);

  // ✅ Margen visual y clamp al rango 0–100
  minV = clamp(minV - 5, 0, 100);
  maxV = clamp(maxV + 5, 0, 100);

  // Si el rango queda plano, forzamos mínimo 10 puntos
  if (maxV - minV < 10) {
    const mid = (minV + maxV) / 2;
    minV = clamp(mid - 5, 0, 100);
    maxV = clamp(mid + 5, 0, 100);
  }

  const yFor = (v: number) => {
    const t = (v - minV) / (maxV - minV);
    return padT + (1 - clamp(t, 0, 1)) * innerH;
  };

  const xForIndex = (i: number) => {
    if (points.length === 1) return padL + innerW / 2;
    return padL + (i / (points.length - 1)) * innerW;
  };

  const coords = points.map((p, i) => ({
    ...p,
    x: xForIndex(i),
    y: yFor(p.value),
  }));

  const lineD =
    coords.length <= 1
      ? ""
      : `M ${coords[0].x.toFixed(2)} ${coords[0].y.toFixed(2)} ` +
        coords
          .slice(1)
          .map((c) => `L ${c.x.toFixed(2)} ${c.y.toFixed(2)}`)
          .join(" ");

  // ✅ Marcas del eje Y: min / mid / max (con texto NO recortado)
  const grid = [
    { v: maxV, label: fmtPct(maxV) },
    { v: (minV + maxV) / 2, label: fmtPct((minV + maxV) / 2) },
    { v: minV, label: fmtPct(minV) },
  ];

  const last = coords[coords.length - 1];
  const lastDate = last.executed_at ? new Date(last.executed_at).toLocaleDateString("es-ES") : "—";

  return (
    <div className="rounded-2xl border bg-gray-50 p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-sm font-extrabold text-gray-900">Gráfica de progresión</div>
          <div className="mt-1 text-xs font-semibold text-gray-500">
            <span className="font-extrabold">Éxito%</span> por auditoría (ordenado por fecha). Última:{" "}
            <span className="font-extrabold">{lastDate}</span>
          </div>
        </div>

        <div className="rounded-full border bg-white px-3 py-1 text-xs font-extrabold text-gray-700">
          {points.length} puntos
        </div>
      </div>

      <div className="mt-3 w-full">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          className="w-full h-auto"
          role="img"
          aria-label="Gráfica de progresión de Éxito%"
        >
          {/* grid + labels */}
          {grid.map((g, idx) => {
            const y = yFor(g.v);
            return (
              <g key={idx}>
                <line
                  x1={padL}
                  y1={y}
                  x2={width - padR}
                  y2={y}
                  stroke="rgba(0,0,0,0.10)"
                  strokeWidth="2"
                />
                {/* tick */}
                <line
                  x1={padL - 8}
                  y1={y}
                  x2={padL}
                  y2={y}
                  stroke="rgba(0,0,0,0.30)"
                  strokeWidth="2"
                />
                {/* label */}
                <text
                  x={padL - 12}
                  y={y + 6}
                  textAnchor="end"
                  fontSize="22"
                  fontWeight="800"
                  fill="rgba(0,0,0,0.55)"
                >
                  {g.label}
                </text>
              </g>
            );
          })}

          {/* línea */}
          {coords.length > 1 ? (
            <path
              d={lineD}
              fill="none"
              stroke="rgba(0,0,0,0.90)"
              strokeWidth="4"
              strokeLinejoin="round"
            />
          ) : null}

          {/* puntos */}
          {coords.map((c) => (
            <g key={c.run_id}>
              <circle
                cx={c.x}
                cy={c.y}
                r={coords.length === 1 ? 10 : 7}
                fill="white"
                stroke="rgba(0,0,0,0.90)"
                strokeWidth="4"
              />
              <title>
                {`${c.executed_at ? new Date(c.executed_at).toLocaleDateString("es-ES") : "—"} · Éxito ${fmtPct(c.value)}`}
              </title>
            </g>
          ))}

          {/* etiqueta del último punto */}
          <g>
            <rect
              x={clamp(last.x + 14, padL, width - padR - 240)}
              y={clamp(last.y - 18, padT, height - padB - 40)}
              width="240"
              height="38"
              rx="14"
              ry="14"
              fill="rgba(0,0,0,0.07)"
              stroke="rgba(0,0,0,0.10)"
            />
            <text
              x={clamp(last.x + 24, padL + 8, width - padR - 220)}
              y={clamp(last.y + 9, padT + 18, height - padB - 12)}
              fontSize="22"
              fontWeight="900"
              fill="rgba(0,0,0,0.85)"
            >
              Éxito {fmtPct(last.value)}
            </text>
          </g>

          {/* eje X: primer/último */}
          <text x={padL} y={height - 10} fontSize="22" fontWeight="800" fill="rgba(0,0,0,0.55)">
            {coords[0].executed_at ? new Date(coords[0].executed_at).toLocaleDateString("es-ES") : "—"}
          </text>
          <text
            x={width - padR}
            y={height - 10}
            textAnchor="end"
            fontSize="22"
            fontWeight="800"
            fill="rgba(0,0,0,0.55)"
          >
            {lastDate}
          </text>
        </svg>
      </div>
    </div>
  );
}