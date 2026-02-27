"use client";

import type { SortDir } from "../_lib/analyticsTypes";

export default function SortHeader({
  label,
  active,
  dir,
  onClick,
  align = "left",
}: {
  label: string;
  active: boolean;
  dir: SortDir;
  onClick: () => void;
  align?: "left" | "right";
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        "inline-flex items-center gap-1 font-extrabold text-xs text-gray-500 hover:text-gray-700 select-none",
        align === "right" ? "ml-auto" : "",
      ].join(" ")}
      title="Ordenar"
    >
      <span>{label}</span>
      <span className={active ? "text-gray-700" : "text-gray-300"} aria-hidden>
        {dir === "asc" ? "▲" : "▼"}
      </span>
    </button>
  );
}