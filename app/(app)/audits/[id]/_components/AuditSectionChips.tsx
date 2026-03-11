"use client";

import type { SectionRow } from "../_hooks/useAuditSession";

export default function AuditSectionChips({
  sections,
  activeSectionId,
  onSelect,
}: {
  sections: SectionRow[];
  activeSectionId: string | null;
  onSelect: (sectionId: string) => void;
}) {
  return (
    <div className="-mx-4 overflow-x-auto px-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      <div className="flex min-w-max gap-2 pb-1">
        {sections.map((section) => {
          const active = section.id === activeSectionId;
          return (
            <button
              key={section.id}
              type="button"
              onClick={() => onSelect(section.id)}
              className={`min-h-[42px] whitespace-nowrap rounded-full border px-3.5 text-sm font-extrabold transition sm:min-h-[48px] ${
                active
                  ? "border-slate-900 bg-slate-900 text-white"
                  : "border-slate-200 bg-white text-slate-700"
              }`}
            >
              {section.name}
            </button>
          );
        })}
      </div>
    </div>
  );
}
