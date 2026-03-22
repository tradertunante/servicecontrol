"use client";

import React from "react";
import { useRouter } from "next/navigation";

import BuilderEmbedded from "@/app/components/BuilderEmbedded";
import type { Profile } from "@/lib/types";

const btnClasses =
  "py-[10px] px-[14px] rounded-[12px] border border-[rgba(0,0,0,0.2)] bg-white text-black font-black cursor-pointer text-[14px] whitespace-nowrap";

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
  // Dynamic: depends on embedded prop
  const containerStyle: React.CSSProperties = embedded ? { width: "100%" } : { padding: 24, paddingTop: 96 };

  return (
    <div style={containerStyle}>
      <BuilderEmbedded
        hotelIdInUse={hotelIdInUse}
        greetingName={profile.full_name ?? null}
        showStandardsCard={true}
        rightActions={
          <div className="flex gap-[10px] items-center flex-wrap">
            <button className={btnClasses} onClick={() => router.push("/areas/order")}>
              Ordenar areas
            </button>
            {showBackToDashboard && !embedded ? (
              <button className={btnClasses} onClick={() => router.push("/dashboard")}>
                ← Atras
              </button>
            ) : null}
          </div>
        }
      />
    </div>
  );
}
