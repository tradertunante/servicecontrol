"use client";

import { usePathname } from "next/navigation";

function getTourEvent(pathname: string | null): string {
  if (pathname?.startsWith("/admin")) return "sc:start-tour:admin";
  if (pathname?.startsWith("/team/progreso")) return "sc:start-tour:team-progreso";
  if (pathname?.startsWith("/team/historial")) return "sc:start-tour:team-historial";
  if (pathname?.startsWith("/team")) return "sc:start-tour:team";
  if (pathname?.startsWith("/members")) return "sc:start-tour:members";
  if (pathname?.startsWith("/team/templates")) return "sc:start-tour:team-auditar";
  if (pathname?.match(/^\/audits\/[^/]+$/)) return "sc:start-tour:audit-session";
  return "sc:start-tour:dashboard";
}

export default function SupportButton() {
  const pathname = usePathname();

  function launch() {
    window.dispatchEvent(new Event(getTourEvent(pathname)));
  }

  return (
    <button
      onClick={launch}
      aria-label="Ver tutorial"
      title="Ver tutorial"
      className="w-8 h-8 flex items-center justify-center rounded-lg text-zinc-400 hover:text-zinc-900 hover:bg-zinc-100 transition-colors text-[13px] font-black"
    >
      ?
    </button>
  );
}
