"use client";

import type { CSSProperties } from "react";
import type { PendingTeamItem } from "../_hooks/useDashboardData";

function PendingTeamRow({
  item,
  rowBg,
  border,
  fg,
  miniBtn,
  onGoDetail,
}: {
  item: PendingTeamItem;
  rowBg: string;
  border: string;
  fg: string;
  miniBtn: CSSProperties;
  onGoDetail: (teamKey: PendingTeamItem["teamKey"]) => void;
}) {
  return (
    <div
      className="pendingTeamRow"
      style={{
        background: rowBg,
        border: `1px solid ${border}`,
        color: fg,
      }}
    >
      <div className="pendingTeamContent">
        <div className="pendingTeamTitle">{item.teamLabel}</div>
        <div className="pendingTeamMeta">
          {item.pendingCount} {item.pendingCount === 1 ? "auditoría pendiente" : "auditorías pendientes"}
        </div>
      </div>

      <div className="pendingTeamAside">
        <div className="pendingTeamCountBlock">
          <div className="pendingTeamCountLabel">Pendientes</div>
          <div className="pendingTeamCount">{item.pendingCount}</div>
        </div>

        <button className="pendingTeamBtn" style={miniBtn} onClick={() => onGoDetail(item.teamKey)}>
          Ver detalle
        </button>
      </div>
    </div>
  );
}

export default function PendingTeamsCard({
  card,
  rowBg,
  border,
  fg,
  miniBtn,
  pendingByTeam,
  onGoDetail,
}: {
  card: CSSProperties;
  rowBg: string;
  border: string;
  fg: string;
  miniBtn: CSSProperties;
  pendingByTeam: PendingTeamItem[];
  onGoDetail: (teamKey: PendingTeamItem["teamKey"]) => void;
}) {
  return (
    <div style={card} className="card pendingTeamsCard">
      <div className="sectionTitle">Pendientes por equipo</div>

      <div className="pendingTeamsList">
        {pendingByTeam.map((item) => (
          <PendingTeamRow
            key={item.teamKey}
            item={item}
            rowBg={rowBg}
            border={border}
            fg={fg}
            miniBtn={miniBtn}
            onGoDetail={onGoDetail}
          />
        ))}
      </div>

      <style jsx global>{`
        .pendingTeamsCard .sectionTitle {
          font-size: 20px;
          font-weight: 950;
          letter-spacing: 0.15px;
          line-height: 1.15;
          margin-bottom: 14px;
        }

        .pendingTeamsList {
          display: grid;
          grid-template-columns: 1fr;
          gap: 10px;
        }

        .pendingTeamRow {
          display: grid;
          grid-template-columns: minmax(0, 1fr) minmax(148px, auto);
          align-items: center;
          gap: 14px;
          padding: 13px 16px;
          border-radius: 16px;
          box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.3), 0 8px 20px rgba(15, 23, 42, 0.04);
        }

        .pendingTeamContent {
          min-width: 0;
          display: flex;
          flex-direction: column;
          gap: 4px;
        }

        .pendingTeamTitle {
          font-size: 16px;
          font-weight: 950;
          line-height: 1.2;
        }

        .pendingTeamMeta {
          font-size: 13px;
          opacity: 0.7;
          line-height: 1.4;
        }

        .pendingTeamAside {
          display: flex;
          flex-direction: column;
          align-items: flex-end;
          justify-content: center;
          gap: 5px;
          text-align: right;
        }

        .pendingTeamCountBlock {
          display: grid;
          gap: 2px;
          justify-items: end;
        }

        .pendingTeamCountLabel {
          font-size: 11px;
          font-weight: 900;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          opacity: 0.5;
        }

        .pendingTeamCount {
          font-size: 30px;
          font-weight: 950;
          line-height: 1;
          letter-spacing: -0.04em;
          white-space: nowrap;
        }

        .pendingTeamBtn {
          min-width: 112px;
          width: fit-content;
        }

        @media (min-width: 1024px) {
          .pendingTeamsList {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }
        }

        @media (max-width: 720px) {
          .pendingTeamRow {
            grid-template-columns: minmax(0, 1fr);
          }

          .pendingTeamAside {
            align-items: flex-start;
            text-align: left;
          }

          .pendingTeamCountBlock {
            justify-items: start;
          }
        }
      `}</style>
    </div>
  );
}
