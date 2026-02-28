"use client";

import type { CSSProperties } from "react";
import HeatMap from "@/app/components/HeatMap";

export default function HeatMapCard({
  card,
  heatMapData,
  monthLabels,
}: {
  card: CSSProperties;
  heatMapData: any[] | undefined | null;
  monthLabels: string[];
}) {
  const safe = Array.isArray(heatMapData) ? heatMapData : [];

  return (
    <div style={{ ...card, marginTop: 16 }} className="card">
      <div className="sectionTitle">Tendencia · 12M</div>

      <div className="hint">
        Tip: haz clic en un área (p. ej. <b>Housekeeping</b>) para ver el desglose por auditoría.
      </div>

      <div className="heatWrap">
        <div className="heatInner">
          {safe.length > 0 ? (
            <HeatMap data={safe} monthLabels={monthLabels} />
          ) : (
            <div style={{ opacity: 0.7 }}>No hay datos suficientes.</div>
          )}
        </div>
      </div>

      <style jsx>{`
        .hint {
          margin-top: -10px;
          margin-bottom: 12px;
          opacity: 0.75;
          font-size: 13px;
          line-height: 1.25;
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
      `}</style>
    </div>
  );
}