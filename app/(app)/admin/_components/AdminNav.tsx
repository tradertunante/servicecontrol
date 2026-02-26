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
    <div style={{ display: "grid", gap: 10 }}>
      {items.map((it) => {
        const active = it.key === activeTab;
        return (
          <button
            key={it.key}
            onClick={() => go(it.key)}
            style={{
              textAlign: "left",
              padding: "12px 14px",
              borderRadius: 14,
              border: "1px solid var(--border)",
              background: active ? "rgba(0,120,255,0.08)" : "var(--card-bg)",
              fontWeight: 900,
              cursor: "pointer",
            }}
          >
            {it.label}
          </button>
        );
      })}
    </div>
  );
}