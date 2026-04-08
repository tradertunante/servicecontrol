"use client";

import BackButton from "@/app/components/BackButton";

export default function AuditHeader({
  title,
  subtitle,
  meta,
  roomNumber,
}: {
  title: string;
  subtitle: string;
  meta: string;
  roomNumber?: string | null;
}) {
  return (
    <div data-onboarding="audit-header" className="flex flex-col gap-2 border-b border-slate-200 bg-white px-4 py-3 lg:px-6 lg:py-4">
      <div className="flex items-center gap-2.5">
        <BackButton fallback="/areas" />
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-base font-black tracking-tight text-slate-950 lg:text-lg">{title}</h1>
          <div className="truncate text-xs font-semibold text-slate-700 sm:text-sm">{subtitle}</div>
          <div className="truncate text-[11px] font-medium text-slate-500 sm:text-xs">{meta}</div>
          {roomNumber ? (
            <div className="truncate text-[11px] font-semibold text-slate-600 sm:text-xs">
              Habitación: {roomNumber}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
