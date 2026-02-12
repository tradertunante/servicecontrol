// app/components/GaugeChart.tsx
"use client";

import { useEffect, useState } from "react";

type GaugeProps = {
  value: number; // 0-100
  label: string;
  count?: number;
  size?: number;
};

function getColor(value: number): string {
  if (value < 60) return "#c62828"; // Rojo
  if (value < 80) return "#ef6c00"; // Naranja
  return "#2e7d32"; // Verde
}

export default function GaugeChart({ value, label, count, size = 200 }: GaugeProps) {
  const [animatedValue, setAnimatedValue] = useState(0);

  useEffect(() => {
    const timer = setTimeout(() => {
      setAnimatedValue(value);
    }, 100);
    return () => clearTimeout(timer);
  }, [value]);

  const clampedValue = Math.max(0, Math.min(100, animatedValue));
  const circumference = 2 * Math.PI * 70;
  const strokeDashoffset = circumference - (clampedValue / 100) * circumference;
  const color = getColor(clampedValue);

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 12,
      }}
    >
      <svg width={size} height={size} viewBox="0 0 200 200">
        {/* Círculo de fondo */}
        <circle
          cx="100"
          cy="100"
          r="70"
          fill="none"
          stroke="rgba(0,0,0,0.08)"
          strokeWidth="20"
        />

        {/* Círculo de progreso */}
        <circle
          cx="100"
          cy="100"
          r="70"
          fill="none"
          stroke={color}
          strokeWidth="20"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          transform="rotate(-90 100 100)"
          style={{
            transition: "stroke-dashoffset 1.5s ease-in-out, stroke 1.5s ease-in-out",
          }}
        />

        {/* Texto central - MÁS PEQUEÑO */}
        <text
          x="100"
          y="95"
          textAnchor="middle"
          dominantBaseline="middle"
          style={{
            fontSize: 32,
            fontWeight: 950,
            fill: color,
          }}
        >
          {clampedValue.toFixed(1)}%
        </text>

        {/* Contador de auditorías */}
        {count !== undefined && (
          <text
            x="100"
            y="120"
            textAnchor="middle"
            style={{
              fontSize: 12,
              fontWeight: 700,
              fill: "rgba(0,0,0,0.5)",
            }}
          >
            ({count} {count === 1 ? "auditoría" : "auditorías"})
          </text>
        )}
      </svg>

      <div
        style={{
          fontSize: 14,
          fontWeight: 900,
          opacity: 0.8,
          textAlign: "center",
        }}
      >
        {label}
      </div>
    </div>
  );
}