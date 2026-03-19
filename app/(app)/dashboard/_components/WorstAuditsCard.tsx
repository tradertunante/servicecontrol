"use client";

import type { CSSProperties } from "react";

type WorstAuditItem = {
  areaId: string;
  areaName: string;
  templateId: string;
  templateName: string;
  score: number | null; // ✅ el hook usa score, NO avg
};

function WorstAuditRow({
  item,
  rowBg,
  border,
  fg,
  miniBtn,
  onGoWorstAuditDetail,
}: {
  item: WorstAuditItem;
  rowBg: string;
  border: string;
  fg: string;
  miniBtn: CSSProperties;
  onGoWorstAuditDetail: (areaId: string, templateId: string) => void;
}) {
  const formatPct = (n: number | null | undefined) => {
    if (n === null || n === undefined || !Number.isFinite(Number(n))) return "—";
    return `${Number(n).toFixed(1)}%`;
  };

  return (
    <div
      className="auditRow"
      style={{
        background: rowBg,
        border: `1px solid ${border}`,
        color: fg,
      }}
    >
      <div className="auditBadgeSlot">
        <div className="auditBadge" aria-hidden>
          <span>⚠️</span>
        </div>
      </div>

      <div className="auditContent">
        <div className="auditTitle">
          {item.areaName} — {item.templateName}
        </div>
      </div>

      <div className="auditAside">
        <div className="auditScore">{formatPct(item.score)}</div>

        <button
          className="auditBtn"
          style={miniBtn}
          onClick={() => onGoWorstAuditDetail(item.areaId, item.templateId)}
        >
          Ver detalle
        </button>
      </div>
    </div>
  );
}

export default function WorstAuditsCard({
  card,
  rowBg,
  border,
  fg,
  miniBtn,
  worst3Audits,
  onGoWorstAuditDetail,
}: {
  card: CSSProperties;
  rowBg: string;
  border: string;
  fg: string;
  miniBtn: CSSProperties;
  worst3Audits: WorstAuditItem[];
  onGoWorstAuditDetail: (areaId: string, templateId: string) => void;
}) {
  return (
    <div style={card} className="card">
      <div className="sectionTitle">Top 3 peores auditorías</div>

      <div className="list">
        {(worst3Audits ?? []).length === 0 ? (
          <div style={{ opacity: 0.7 }}>No hay datos suficientes.</div>
        ) : (
          worst3Audits.slice(0, 3).map((a, i) => (
            <WorstAuditRow
              key={`${a.areaId}-${a.templateId}-${i}`}
              item={a}
              rowBg={rowBg}
              border={border}
              fg={fg}
              miniBtn={miniBtn}
              onGoWorstAuditDetail={onGoWorstAuditDetail}
            />
          ))
        )}
      </div>

      <style jsx global>{`
        .list {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .auditRow {
          display: grid;
          grid-template-columns: 44px minmax(0, 1fr) minmax(124px, auto);
          grid-template-areas: "badge content aside";
          align-items: center;
          column-gap: 12px;
          min-height: 0;
          padding: 10px 16px 10px 14px;
          border-radius: 15px;
          box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.3), 0 8px 20px rgba(15, 23, 42, 0.04);
        }

        .auditBadgeSlot {
          grid-area: badge;
          align-self: center;
        }

        .auditBadge {
          width: 42px;
          height: 42px;
          display: grid;
          place-items: center;
          flex-shrink: 0;
        }

        .auditBadge span {
          font-size: 20px;
          line-height: 1;
        }

        .auditContent {
          grid-area: content;
          min-width: 0;
          display: flex;
          flex-direction: column;
          justify-content: center;
        }

        .auditTitle {
          font-weight: 950;
          font-size: 15px;
          line-height: 1.3;
          word-break: break-word;
          overflow-wrap: anywhere;
          color: ${fg};
        }

        .auditAside {
          grid-area: aside;
          display: flex;
          flex-direction: column;
          align-items: flex-end;
          justify-content: center;
          gap: 3px;
          min-width: 116px;
          text-align: right;
          align-self: center;
          justify-self: end;
        }

        .auditScore {
          font-weight: 950;
          font-size: 32px;
          line-height: 1;
          letter-spacing: -0.04em;
          white-space: nowrap;
        }

        .auditBtn {
          min-width: 104px;
          width: fit-content;
        }

        @media (max-width: 720px) {
          .auditRow {
            grid-template-columns: 40px minmax(0, 1fr);
            grid-template-areas:
              "badge content"
              "aside aside";
            padding: 12px 14px;
            row-gap: 8px;
          }

          .auditBadgeSlot {
            align-self: start;
          }

          .auditAside {
            min-width: 0;
            flex-direction: row;
            align-items: center;
            justify-content: space-between;
            gap: 8px;
            text-align: left;
            width: 100%;
          }

          .auditScore {
            font-size: 26px;
          }

          .auditBtn {
            width: auto;
            min-width: 112px;
          }
        }

        @media (max-width: 520px) {
          .auditBadge {
            width: 38px;
            height: 38px;
            border-radius: 12px;
          }

          .auditAside {
            align-items: stretch;
            flex-direction: column;
            text-align: left;
          }

          .auditBtn {
            width: 100%;
          }
        }
      `}</style>
    </div>
  );
}
