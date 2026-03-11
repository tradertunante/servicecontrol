"use client";

import type { ReactNode } from "react";

export default function DesktopAuditLayout({
  header,
  sections,
  content,
  footer,
}: {
  header: ReactNode;
  sections: ReactNode;
  content: ReactNode;
  footer: ReactNode;
}) {
  return (
    <div className="hidden lg:block">
      <div className="sticky top-0 z-20 bg-slate-50">{header}</div>
      <div className="border-b border-slate-200 bg-slate-50 py-3">{sections}</div>
      <div className="px-6 py-6 pb-28">{content}</div>
      {footer}
    </div>
  );
}
