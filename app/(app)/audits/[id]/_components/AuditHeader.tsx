"use client";

import BackButton from "@/app/components/BackButton";

export default function AuditHeader({
  title,
  subtitle,
  meta,
}: {
  title: string;
  subtitle: string;
  meta: string;
}) {
  return (
    <div className="flex flex-col gap-3 border-b border-slate-200 bg-white px-4 py-4">
      <div className="flex items-center gap-3">
        <BackButton fallback="/areas" />
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-lg font-black tracking-tight text-slate-950">{title}</h1>
          <div className="text-sm font-semibold text-slate-700">{subtitle}</div>
          <div className="text-xs font-medium text-slate-500">{meta}</div>
        </div>
      </div>
    </div>
  );
}
