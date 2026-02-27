"use client";

import type { TabKey } from "../_lib/analyticsTypes";

export default function AnalyticsTabs({
  tab,
  setTab,
}: {
  tab: TabKey;
  setTab: (t: TabKey) => void;
}) {
  const btn = (key: TabKey, label: string) => (
    <button
      onClick={() => setTab(key)}
      className={[
        "rounded-2xl px-4 py-2.5 text-sm font-extrabold border",
        tab === key
          ? "bg-black text-white border-black"
          : "bg-white text-black border-gray-200 hover:bg-gray-50",
      ].join(" ")}
    >
      {label}
    </button>
  );

  return (
    <div className="mt-6 flex flex-wrap gap-2">
      {btn("ranking", "Ranking")}
      {btn("common", "Fallos comunes")}
      {btn("member", "Datos por colaborador")}
    </div>
  );
}