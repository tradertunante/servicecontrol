"use client";

import React from "react";
import { useRouter } from "next/navigation";

import BuilderEmbedded from "@/app/components/BuilderEmbedded";
import type { Profile } from "@/lib/types";

export default function BuilderShell({
  profile,
  hotelIdInUse,
  embedded = false,
  showBackToDashboard = true,
}: {
  profile: Profile;
  hotelIdInUse: string;
  embedded?: boolean;
  showBackToDashboard?: boolean;
}) {
  const router = useRouter();
  const containerStyle: React.CSSProperties = embedded ? { width: "100%" } : { padding: 24, paddingTop: 96 };

  return (
    <div style={containerStyle}>
      <BuilderEmbedded
        hotelIdInUse={hotelIdInUse}
        greetingName={profile.full_name ?? null}
        showStandardsCard={true}
        rightActions={
          <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
            <button style={btnStyle} onClick={() => router.push("/areas/order")}>
              Ordenar areas
            </button>
            {showBackToDashboard && !embedded ? (
              <button style={btnStyle} onClick={() => router.push("/dashboard")}>
                ← Atras
              </button>
            ) : null}
          </div>
        }
      />
    </div>
  );
}

const btnStyle: React.CSSProperties = {
  padding: "10px 14px",
  borderRadius: 12,
  border: "1px solid rgba(0,0,0,0.2)",
  background: "#fff",
  color: "#000",
  fontWeight: 900,
  cursor: "pointer",
  fontSize: 14,
  whiteSpace: "nowrap",
};
