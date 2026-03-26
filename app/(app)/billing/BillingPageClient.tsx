"use client";

import { useEffect, useState } from "react";
import type { BillingState } from "@/lib/billing/getActiveSubscription";

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  active: { label: "Activa", color: "#22c55e" },
  trialing: { label: "Periodo de prueba", color: "#3b82f6" },
  past_due: { label: "Pago pendiente", color: "#ef4444" },
  canceled: { label: "Cancelada", color: "#6b7280" },
  unpaid: { label: "Impagada", color: "#ef4444" },
};

const PLAN_LABELS: Record<string, string> = {
  starter: "Starter",
  professional: "Professional",
  enterprise: "Enterprise",
};

export default function BillingPageClient() {
  const [billing, setBilling] = useState<BillingState | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => {
    const controller = new AbortController();

    (async () => {
      try {
        const res = await fetch("/api/billing/status", {
          credentials: "include",
          signal: controller.signal,
        });
        const data = await res.json();
        if (!controller.signal.aborted && data.ok) {
          setBilling(data.billing);
        }
      } catch (e) {
        if (e instanceof DOMException && e.name === "AbortError") return;
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    })();

    return () => { controller.abort(); };
  }, []);

  const handleCheckout = async (planCode: string, interval: "month" | "year") => {
    setActionLoading(true);
    try {
      const res = await fetch("/api/billing/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ plan_code: planCode, interval }),
      });
      const data = await res.json();
      if (data.ok && data.url) {
        window.location.href = data.url;
      }
    } finally {
      setActionLoading(false);
    }
  };

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
  const statusInfo = sub ? STATUS_LABELS[sub.status] ?? { label: sub.status, color: "#6b7280" } : null;

  return (
    <div className="min-h-screen bg-[#eef1f5] p-6">
      <div className="max-w-3xl mx-auto">
        <h1 className="text-2xl font-bold mb-6">Facturación</h1>

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
          /* No subscription — show plans */
          <div className="bg-white rounded-xl shadow-sm p-6 mb-6">
            <h2 className="text-lg font-semibold mb-2">Sin suscripción activa</h2>
            <p className="text-sm text-gray-500 mb-6">Elige un plan para empezar.</p>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {[
                { code: "starter", name: "Starter", price: "29", features: ["1 hotel", "10 usuarios", "50 auditorías/mes"] },
                { code: "professional", name: "Professional", price: "79", features: ["3 hoteles", "25 usuarios/hotel", "500 auditorías/mes", "Reportes", "Formaciones"] },
                { code: "enterprise", name: "Enterprise", price: "199", features: ["Hoteles ilimitados", "Usuarios ilimitados", "Auditorías ilimitadas", "Todo incluido"] },
              ].map((plan) => (
                <div key={plan.code} className="border border-gray-200 rounded-xl p-5 flex flex-col">
                  <h3 className="font-semibold text-lg">{plan.name}</h3>
                  <p className="text-2xl font-bold mt-2">
                    {plan.price}€<span className="text-sm font-normal text-gray-400">/mes</span>
                  </p>
                  <ul className="mt-4 space-y-1 text-sm text-gray-600 flex-1">
                    {plan.features.map((f) => (
                      <li key={f}>✓ {f}</li>
                    ))}
                  </ul>
                  <button
                    onClick={() => handleCheckout(plan.code, "month")}
                    disabled={actionLoading}
                    className="mt-4 w-full px-4 py-2 bg-black text-white rounded-lg text-sm hover:bg-gray-800 disabled:opacity-50"
                  >
                    Empezar
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
