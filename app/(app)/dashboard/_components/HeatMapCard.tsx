// FILE: app/(app)/dashboard/_components/HeatMapCard.tsx
"use client";

import { useMemo } from "react";
import type { CSSProperties } from "react";
import HeatMap from "@/app/components/HeatMap";
import type { HeatMode } from "../_lib/dashboardUtils";

export default function HeatMapCard({
  card,
  heatMapData,
  monthLabels,
  heatMode,
  setHeatMode,
  selectedYear,
  setSelectedYear,
  availableYears,
}: {
  card: CSSProperties;
  heatMapData: any[];
  monthLabels: string[];
  heatMode: HeatMode;
  setHeatMode: (m: HeatMode) => void;
  selectedYear: number;
  setSelectedYear: (y: number) => void;
  availableYears: number[];
}) {
  const title = useMemo(() => {
    return heatMode === "YEAR" ? `Tendencia · Año ${selectedYear}` : "Tendencia · Últimos 12 meses";
  }, [heatMode, selectedYear]);

  return (
    <div style={{ ...card, marginTop: 16 }} className="card">
      <div className="headerRow">
        <div>
          <div className="sectionTitle">{title}</div>
          <div className="hint">Tip: haz clic en un área (p. ej. Housekeeping) para ver el desglose por auditoría.</div>
        </div>

        <div className="controls">
          <button
            className={`pill ${heatMode === "ROLLING_12M" ? "active" : ""}`}
            onClick={() => setHeatMode("ROLLING_12M")}
            type="button"
          >
            Últimos 12 meses
          </button>

          <button
            className={`pill ${heatMode === "YEAR" ? "active" : ""}`}
            onClick={() => setHeatMode("YEAR")}
            type="button"
          >
            Año
          </button>

          {heatMode === "YEAR" && (
            <select className="yearSelect" value={selectedYear} onChange={(e) => setSelectedYear(Number(e.target.value))}>
              {availableYears.map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </select>
          )}
        </div>
      </div>

      <div className="heatWrap">
        <div className="heatInner">
          {Array.isArray(heatMapData) && heatMapData.length > 0 ? (
            <HeatMap data={heatMapData} monthLabels={monthLabels} />
          ) : (
            <div style={{ opacity: 0.7 }}>No hay datos suficientes.</div>
          )}
        </div>
      </div>

      <style jsx>{`
        .headerRow {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          gap: 12px;
          margin-bottom: 12px;
        }

        .sectionTitle {
          font-size: 22px;
          font-weight: 950;
          letter-spacing: 0.4px;
          margin-bottom: 6px;
        }

        .hint {
          opacity: 0.75;
          font-size: 13px;
        }

        .controls {
          display: flex;
          align-items: center;
          gap: 10px;
          flex-wrap: wrap;
        }

        .pill {
          border: 1px solid var(--input-border);
          background: var(--input-bg);
          color: var(--text);
          border-radius: 14px;
          padding: 8px 10px;
          font-weight: 900;
          font-size: 13px;
          box-shadow: var(--shadow-sm);
          cursor: pointer;
          white-space: nowrap;
        }

        .pill.active {
          outline: 2px solid rgba(0, 0, 0, 0.08);
        }

        .yearSelect {
          border: 1px solid var(--input-border);
          background: var(--input-bg);
          color: var(--text);
          border-radius: 12px;
          padding: 8px 10px;
          font-weight: 900;
          font-size: 13px;
          box-shadow: var(--shadow-sm);
        }

        .heatWrap {
          position: relative;
          width: 100%;
          overflow-x: auto;
          overflow-y: hidden;
          -webkit-overflow-scrolling: touch;
          padding-bottom: 8px;
        }

        .heatInner {
          width: max-content;
        }

        .heatWrap:after {
          content: "";
          position: sticky;
          right: 0;
          top: 0;
          height: 100%;
          width: 28px;
          float: right;
          pointer-events: none;
          background: linear-gradient(to right, rgba(255, 255, 255, 0), rgba(255, 255, 255, 0.9));
        }

        @media (max-width: 720px) {
          .headerRow {
            flex-direction: column;
            align-items: stretch;
          }
          .controls {
            justify-content: flex-start;
          }
        }
      `}</style>
    </div>
  );
}