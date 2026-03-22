"use client";

import { useRouter, useSearchParams } from "next/navigation";

type TabKey = "hotel" | "areas" | "users" | "access";

const items: Array<{ key: TabKey; label: string }> = [
  { key: "hotel", label: "Info del hotel" },
  { key: "areas", label: "Departamentos" },
  { key: "users", label: "Usuarios" },
  { key: "access", label: "Acceso por área" },
];

export default function AdminNav({ activeTab }: { activeTab: TabKey }) {
  const router = useRouter();
  const sp = useSearchParams();

  function go(tab: TabKey) {
    const next = new URLSearchParams(sp.toString());
    next.set("tab", tab);
    router.replace(`/admin?${next.toString()}`);
  }

  return (
    <div className="grid gap-[10px]">
      {items.map((it) => {
        const active = it.key === activeTab;
        return (
          <button
            key={it.key}
            onClick={() => go(it.key)}
            className={[
              "text-left py-3 px-[14px] rounded-[14px]",
              "border border-[var(--border)]",
              active ? "bg-[rgba(0,120,255,0.08)]" : "bg-[var(--card-bg)]",
              "font-black cursor-pointer",
            ].join(" ")}
          >
            {it.label}
          </button>
        );
      })}
    </div>
  );
}
