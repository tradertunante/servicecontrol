"use client";

import type { ReactNode } from "react";

export default function MobileAuditLayout({
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
    <div className="block lg:hidden">
      <div className="sticky top-0 z-20 border-b border-slate-200 bg-slate-50">
        {header}
        <div className="py-3">{sections}</div>
      </div>
      <div className="px-4 py-4 pb-28">{content}</div>
      {footer}
    </div>
  );
}
