"use client";

import { useRouter } from "next/navigation";

import BuilderEmbedded from "@/app/components/BuilderEmbedded";

export default function BuilderModule({ hotelId }: { hotelId: string }) {
  const router = useRouter();

  return (
    <div
      style={{
        padding: 16,
        borderRadius: 16,
        border: "1px solid var(--border, rgba(0,0,0,0.10))",
        background: "var(--card-bg, rgba(255,255,255,0.92))",
        boxShadow: "var(--shadow-sm, 0 6px 18px rgba(0,0,0,0.10))",
      }}
    >
      <BuilderEmbedded
        hotelIdInUse={hotelId}
        greetingName={null}
        showStandardsCard={true}
        rightActions={
          <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
            <button
              style={{
                padding: "10px 14px",
                borderRadius: 12,
                border: "1px solid rgba(0,0,0,0.2)",
                background: "#fff",
                color: "#000",
                fontWeight: 900,
                cursor: "pointer",
                fontSize: 14,
                whiteSpace: "nowrap",
              }}
              onClick={() => router.push("/areas/order")}
            >
              Ordenar areas
            </button>
          </div>
        }
      />
    </div>
  );
}
