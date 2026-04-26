"use client";

import { useHotelId } from "@/hooks/useHotelId";
import { Link } from "@/i18n/navigation";

export default function TrialBanner() {
  const { data } = useHotelId();

  if (!data?.is_trial) return null;

  return (
    <div
      className="flex items-center justify-between gap-4 px-5 py-2.5 text-xs sm:px-8"
      style={{ background: "#185FA5", color: "#fff" }}
    >
      <span>
        Estás explorando ServiceControl con datos de demostración.{" "}
        <span className="opacity-75">Los cambios que hagas no afectan a ningún hotel real.</span>
      </span>
      <Link
        href="/demo"
        className="shrink-0 rounded-[4px] bg-white/20 px-3 py-1 font-semibold transition hover:bg-white/30"
      >
        Solicitar demo real
      </Link>
    </div>
  );
}