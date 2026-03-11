"use client";

import type { ReactNode } from "react";

export default function DesktopAuditLayout({
  header,
  content,
  footer,
}: {
  header: ReactNode;
  content: ReactNode;
  footer: ReactNode;
}) {
  return (
    <div className="hidden lg:block">
      <div className="sticky top-0 z-20 bg-slate-50">{header}</div>
      <div className="px-6 py-6 pb-28">{content}</div>
      {footer}
    </div>
  );
}
