// app/components/HeatMap.tsx
"use client";

type HeatMapCell = {
  value: number | null;
  count: number;
};

type HeatMapProps = {
  data: {
    areaName: string;
    months: HeatMapCell[];
  }[];
  monthLabels: string[];
};

function getCellColor(value: number | null): string {
  if (value === null) return "rgba(0,0,0,0.03)";
  if (value < 60) return "#ffcdd2";
  if (value < 70) return "#ffcc80";
  if (value < 80) return "#fff59d";
  if (value < 90) return "#c5e1a5";
  return "#a5d6a7";
}

function getCellTextColor(value: number | null): string {
  if (value === null) return "rgba(0,0,0,0.3)";
  if (value < 60) return "#c62828";
  if (value < 80) return "#ef6c00";
  return "#2e7d32";
}

export default function HeatMap({ data, monthLabels }: HeatMapProps) {
  return (
    <div style={{ overflowX: "auto" }}>
      <table
        style={{
          width: "100%",
          borderCollapse: "separate",
          borderSpacing: "4px",
        }}
      >
        <thead>
          <tr>
            <th
              style={{
                padding: "10px 14px",
                textAlign: "left",
                fontWeight: 950,
                fontSize: 14,
                opacity: 0.7,
              }}
            >
              Área
            </th>
            {monthLabels.map((label) => (
              <th
                key={label}
                style={{
                  padding: "10px 8px",
                  textAlign: "center",
                  fontWeight: 950,
                  fontSize: 13,
                  opacity: 0.7,
                }}
              >
                {label}
              </th>
            ))}
          </tr>
        </thead>

        <tbody>
          {data.map((row) => (
            <tr key={row.areaName}>
              <td
                style={{
                  padding: "12px 14px",
                  fontWeight: 950,
                  fontSize: 14,
                  whiteSpace: "nowrap",
                }}
              >
                {row.areaName}
              </td>
              {row.months.map((cell, idx) => (
                <td
                  key={idx}
                  title={
                    cell.value !== null
                      ? `${cell.value.toFixed(1)}% (${cell.count} ${cell.count === 1 ? "auditoría" : "auditorías"})`
                      : "Sin datos"
                  }
                  style={{
                    padding: "12px 8px",
                    textAlign: "center",
                    background: getCellColor(cell.value),
                    borderRadius: 8,
                    fontWeight: 900,
                    fontSize: 13,
                    color: getCellTextColor(cell.value),
                    cursor: cell.value !== null ? "pointer" : "default",
                    transition: "all 0.2s",
                  }}
                  onMouseEnter={(e) => {
                    if (cell.value !== null) {
                      e.currentTarget.style.transform = "scale(1.05)";
                      e.currentTarget.style.boxShadow = "0 4px 12px rgba(0,0,0,0.15)";
                    }
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.transform = "scale(1)";
                    e.currentTarget.style.boxShadow = "none";
                  }}
                >
                  {cell.value !== null ? `${cell.value.toFixed(0)}%` : "—"}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}