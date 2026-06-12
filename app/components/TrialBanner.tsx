"use client";

import { useHotelId } from "@/hooks/useHotelId";
import { Link } from "@/i18n/navigation";

function daysLeft(expiresAt: string | null): number | null {
  if (!expiresAt) return null;
  const ms = new Date(expiresAt).getTime() - Date.now();
  return Math.max(0, Math.ceil(ms / (1000 * 60 * 60 * 24)));
}

export default function TrialBanner() {
  const { data } = useHotelId();

  if (!data?.is_trial) return null;

  const days = daysLeft(data.trial_expires_at ?? null);
  const urgency = days !== null && days <= 3;

  return (
    <div
      className="flex items-center justify-between gap-4 px-5 py-2.5 text-xs sm:px-8"
      style={{ background: urgency ? "#b91c1c" : "#185FA5", color: "#fff" }}
    >
      <span>
        {days !== null ? (
          <>
            Tu prueba gratuita{" "}
            {days === 0 ? (
              <strong>expira hoy</strong>
            ) : (
              <>
                termina en <strong>{days} {days === 1 ? "día" : "días"}</strong>
              </>
            )}
            .{" "}
          </>
        ) : (
          <>Estás en periodo de prueba. </>
        )}
        <span className="opacity-75">Activa tu cuenta para conservar tus datos.</span>
      </span>
      <Link
        href="/upgrade"
        className="shrink-0 rounded-[4px] bg-white/20 px-3 py-1 font-semibold transition hover:bg-white/30"
      >
        Activar cuenta
      </Link>
    </div>
  );
}