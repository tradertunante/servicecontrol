"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import type { BillingState } from "@/lib/billing/getActiveSubscription";
import { PLANS } from "@/lib/billing/plans";

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  active: { label: "Activa", color: "#22c55e" },
  trialing: { label: "Periodo de prueba", color: "#3b82f6" },
  past_due: { label: "Pago pendiente", color: "#ef4444" },
  canceled: { label: "Cancelada", color: "#6b7280" },
  unpaid: { label: "Impagada", color: "#ef4444" },
};

const PLAN_LABELS: Record<string, string> = Object.fromEntries(
  PLANS.map((p) => [p.code, p.name]),
);

// El webhook de Stripe tarda unos segundos en aprovisionar tras el checkout:
// mientras haya session_id sin suscripción visible, reintentamos.
const POLL_INTERVAL_MS = 2500;
const POLL_MAX_ATTEMPTS = 24; // ~1 minuto

export default function BillingPageClient() {
  const searchParams = useSearchParams();
  const justPaid = Boolean(searchParams.get("session_id"));

  const [billing, setBilling] = useState<BillingState | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [pollTimedOut, setPollTimedOut] = useState(false);
  const pollAttempts = useRef(0);

  useEffect(() => {
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout> | null = null;

    const fetchStatus = async () => {
      try {
        const res = await fetch("/api/billing/status", {
          credentials: "include",
          signal: controller.signal,
        });
        const data = await res.json();
        if (controller.signal.aborted) return;

        if (data.ok) setBilling(data.billing);
        setLoading(false);

        const hasSub = Boolean(data.ok && data.billing?.subscription);
        if (justPaid && !hasSub) {
          pollAttempts.current += 1;
          if (pollAttempts.current < POLL_MAX_ATTEMPTS) {
            timer = setTimeout(fetchStatus, POLL_INTERVAL_MS);
          } else {
            setPollTimedOut(true);
          }
        } else if (justPaid && hasSub) {
          // El perfil pudo cambiar (rol admin, hotel nuevo): refrescar el shell.
          window.location.replace("/billing");
        }
      } catch (e) {
        if (e instanceof DOMException && e.name === "AbortError") return;
        if (!controller.signal.aborted) setLoading(false);
      }
    };

    fetchStatus();

    return () => {
      controller.abort();
      if (timer) clearTimeout(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [justPaid]);

  const handlePortal = async () => {
    setActionLoading(true);
    try {
      const res = await fetch("/api/billing/portal", {
        method: "POST",
        credentials: "include",
      });
      const data = await res.json();
      if (data.ok && data.url) {
        window.location.href = data.url;
      }
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#eef1f5] flex items-center justify-center">
        <p className="text-gray-500">Cargando...</p>
      </div>
    );
  }

  const sub = billing?.subscription;

  // Post-checkout: el webhook aún no ha confirmado la suscripción
  if (justPaid && !sub && !pollTimedOut) {
    return (
      <div className="min-h-screen bg-[#eef1f5] flex items-center justify-center p-6">
        <div className="bg-white rounded-xl shadow-sm p-8 max-w-md text-center">
          <div className="mx-auto mb-4 h-10 w-10 animate-spin rounded-full border-4 border-gray-200 border-t-[#185FA5]" />
          <h1 className="text-lg font-semibold">Confirmando tu pago…</h1>
          <p className="mt-2 text-sm text-gray-500">
            Estamos activando tu cuenta y creando tu hotel. Esto tarda unos segundos.
          </p>
        </div>
      </div>
    );
  }

  const statusInfo = sub ? STATUS_LABELS[sub.status] ?? { label: sub.status, color: "#6b7280" } : null;

  return (
    <div className="min-h-screen bg-[#eef1f5] p-6">
      <div className="max-w-3xl mx-auto">
        <h1 className="text-2xl font-bold mb-6">Facturación</h1>

        {pollTimedOut && !sub && (
          <div className="mb-6 p-4 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-800">
            Tu pago se ha recibido pero la activación está tardando más de lo normal.
            Recarga esta página en un minuto o escríbenos a soporte y lo resolvemos al momento.
          </div>
        )}

        {/* Current plan */}
        {sub ? (
          <div className="bg-white rounded-xl shadow-sm p-6 mb-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-lg font-semibold">
                  Plan {PLAN_LABELS[sub.plan_code] ?? sub.plan_code}
                </h2>
                <div className="flex items-center gap-2 mt-1">
                  <span
                    className="inline-block w-2 h-2 rounded-full"
                    style={{ backgroundColor: statusInfo?.color }}
                  />
                  <span className="text-sm text-gray-600">{statusInfo?.label}</span>
                  <span className="text-sm text-gray-400">
                    &middot; {sub.interval === "year" ? "Anual" : "Mensual"}
                  </span>
                </div>
              </div>
              <button
                onClick={handlePortal}
                disabled={actionLoading}
                className="px-4 py-2 bg-black text-white rounded-lg text-sm hover:bg-gray-800 disabled:opacity-50"
              >
                Gestionar suscripción
              </button>
            </div>

            {sub.current_period_end && (
              <p className="text-sm text-gray-500">
                {sub.cancel_at_period_end
                  ? `Se cancela el ${new Date(sub.current_period_end).toLocaleDateString("es-ES")}`
                  : `Próxima renovación: ${new Date(sub.current_period_end).toLocaleDateString("es-ES")}`}
              </p>
            )}

            {sub.trial_end && sub.status === "trialing" && (
              <p className="text-sm text-blue-600 mt-1">
                Prueba gratuita hasta {new Date(sub.trial_end).toLocaleDateString("es-ES")}
              </p>
            )}

            {sub.status === "past_due" && (
              <div className="mt-3 p-3 bg-red-50 rounded-lg">
                <p className="text-sm text-red-700">
                  Tu pago ha fallado. Actualiza tu método de pago para evitar la suspensión del servicio.
                </p>
                <button
                  onClick={handlePortal}
                  className="mt-2 text-sm text-red-700 underline"
                >
                  Actualizar método de pago
                </button>
              </div>
            )}

            {/* Plan limits */}
            {sub.entitlements && (
              <div className="mt-4 pt-4 border-t border-gray-100">
                <h3 className="text-sm font-medium text-gray-700 mb-2">Incluido en tu plan</h3>
                <div className="grid grid-cols-2 gap-2 text-sm text-gray-600">
                  <div>Hoteles: hasta {sub.entitlements.max_hotels}</div>
                  <div>Usuarios/hotel: hasta {sub.entitlements.max_users_per_hotel}</div>
                  <div>Auditorías/mes: hasta {sub.entitlements.max_audits_per_month}</div>
                  <div>Reportes: {sub.entitlements.reports_enabled ? "Sí" : "No"}</div>
                  <div>Formaciones: {sub.entitlements.training_enabled ? "Sí" : "No"}</div>
                  <div>Analytics: {sub.entitlements.analytics_enabled ? "Sí" : "No"}</div>
                </div>
              </div>
            )}
          </div>
        ) : (
          /* No subscription — send to the plan picker */
          <div className="bg-white rounded-xl shadow-sm p-8 mb-6 text-center">
            <h2 className="text-lg font-semibold mb-2">Sin suscripción activa</h2>
            <p className="text-sm text-gray-500 mb-6">
              Elige un plan y tu cuenta se activa en el momento.
            </p>
            <Link
              href="/upgrade"
              className="inline-block px-6 py-3 bg-[#185FA5] text-white rounded-lg text-sm font-semibold hover:bg-[#1a6ab8]"
            >
              Ver planes
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
