// FILE: app/(app)/dashboard/_components/DashboardShell.tsx
"use client";

import type { CSSProperties, ReactNode } from "react";

export default function DashboardShell({
  bg,
  fg,
  children,
  css,
}: {
  bg: string;
  fg: string;
  children: ReactNode;
  css: string;
}) {
  return (
    <main className="dash" style={{ background: bg, color: fg }}>
      {children}
      <style jsx>{css}</style>
    </main>
  );
}

export function buildCardStyle(opts: {
  fg: string;
  border: string;
  cardBg: string;
  shadowLg: string;
}): CSSProperties {
  return {
    borderRadius: 18,
    border: `1px solid ${opts.border}`,
    background: opts.cardBg,
    padding: 20,
    boxShadow: opts.shadowLg,
    color: opts.fg,
  };
}

export function buildMiniBtnStyle(opts: { fg: string; border: string; inputBg: string }): CSSProperties {
  return {
    padding: "8px 10px",
    borderRadius: 10,
    border: `1px solid ${opts.border}`,
    background: opts.inputBg,
    color: opts.fg,
    cursor: "pointer",
    fontWeight: 900,
    fontSize: 12,
    boxShadow: "var(--shadow-mini, 0 4px 14px rgba(0,0,0,0.06))",
    whiteSpace: "nowrap",
  };
}

export function buildGhostBtnStyle(opts: { fg: string; border: string; inputBg: string; shadowSm: string }): CSSProperties {
  return {
    padding: "10px 12px",
    borderRadius: 12,
    border: `1px solid ${opts.border}`,
    background: opts.inputBg,
    color: opts.fg,
    cursor: "pointer",
    fontWeight: 950,
    fontSize: 13,
    boxShadow: opts.shadowSm,
    whiteSpace: "nowrap",
  };
}