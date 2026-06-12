import { ImageResponse } from "next/og";

export const alt = "ServiceControl — Calidad y operación hotelera";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "72px 80px",
          background: "#0C1F44",
          color: "#ffffff",
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", fontSize: 44, fontWeight: 700 }}>
          <span style={{ color: "#ffffff" }}>Service</span>
          <span style={{ color: "#378ADD" }}>Control</span>
        </div>
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 28,
          }}
        >
          <div style={{ fontSize: 64, fontWeight: 700, lineHeight: 1.15, maxWidth: 980 }}>
            La calidad de tu hotel, convertida en un sistema que puedes demostrar.
          </div>
          <div style={{ fontSize: 28, color: "#B5D4F4" }}>
            Auditorías · Acciones correctivas · Reauditorías · Formación
          </div>
        </div>
        <div
          style={{
            display: "flex",
            fontSize: 20,
            letterSpacing: 6,
            color: "rgba(255,255,255,0.55)",
          }}
        >
          HOTEL QUALITY PLATFORM
        </div>
      </div>
    ),
    { ...size }
  );
}