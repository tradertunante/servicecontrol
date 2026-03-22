"use client";

import { useRouter } from "next/navigation";

import BuilderEmbedded from "@/app/components/BuilderEmbedded";

export default function BuilderModule({ hotelId }: { hotelId: string }) {
  const router = useRouter();

  return (
    <div className="p-4 rounded-[16px] border border-[var(--border,rgba(0,0,0,0.10))] bg-[var(--card-bg,rgba(255,255,255,0.92))] shadow-[var(--shadow-sm,0_6px_18px_rgba(0,0,0,0.10))]">
      <BuilderEmbedded
        hotelIdInUse={hotelId}
        greetingName={null}
        showStandardsCard={true}
        rightActions={
          <div className="flex gap-[10px] items-center flex-wrap">
            <button
              className="py-[10px] px-[14px] rounded-[12px] border border-[rgba(0,0,0,0.2)] bg-white text-black font-black cursor-pointer text-[14px] whitespace-nowrap"
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
