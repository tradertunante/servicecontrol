"use client";

import { useState } from "react";
import { useHotelId } from "@/hooks/useHotelId";
import { PLANS } from "@/lib/billing/plans";

type Interval = "month" | "year";

export default function UpgradeClient() {
  const { data } = useHotelId();
  const [interval, setInterval] = useState<Interval>("month");
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleCheckout = async (planCode: string) => {
    setLoading(planCode);
    setError(null);
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
      } else {
        setError(data.error ?? "Error al iniciar el pago. Inténtalo de nuevo.");
      }
    } catch {
      setError("Error de red. Inténtalo de nuevo.");
    } finally {
      setLoading(null);
    }
  };

  const days = data?.trial_expires_at
    ? Math.max(0, Math.ceil((new Date(data.trial_expires_at).getTime() - Date.now()) / 86400000))
    : null;

  return (
    <div className="min-h-screen bg-[#eef1f5] p-6">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Activa tu cuenta</h1>
          <p className="mt-2 text-sm text-gray-500">
            Al completar el pago, tu hotel se crea automáticamente y entras como administrador.
          </p>
          {days !== null && (
            <p className="mt-1 text-sm text-gray-500">
              {days === 0
                ? "Tu periodo de prueba expira hoy."
                : `Tu periodo de prueba termina en ${days} ${days === 1 ? "día" : "días"}.`}
            </p>
          )}
        </div>

        {/* Interval toggle */}
        <div className="flex justify-center mb-8">
          <div className="inline-flex rounded-lg border border-gray-200 bg-white p-1">
            <button
              onClick={() => setInterval("month")}
              className={`px-4 py-2 text-sm rounded-md transition ${
                interval === "month" ? "bg-black text-white" : "text-gray-600 hover:text-gray-900"
              }`}
            >
              Mensual
            </button>
            <button
              onClick={() => setInterval("year")}
              className={`px-4 py-2 text-sm rounded-md transition ${
                interval === "year" ? "bg-black text-white" : "text-gray-600 hover:text-gray-900"
              }`}
            >
              Anual <span className="text-xs text-green-600 font-semibold">−15%</span>
            </button>
          </div>
        </div>

        {error && (
          <div className="mb-6 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700 text-center">
            {error}
          </div>
        )}

        {/* Plan cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {PLANS.map((plan) => (
            <div
              key={plan.code}
              className={`relative bg-white rounded-2xl p-6 flex flex-col shadow-sm ${
                plan.highlight ? "ring-2 ring-[#185FA5]" : "border border-gray-200"
              }`}
            >
              {plan.highlight && (
                <span className="absolute -top-3 left-1/2 -translate-x-1/2 bg-[#185FA5] text-white text-xs font-semibold px-3 py-1 rounded-full">
                  Más popular
                </span>
              )}
              <h2 className="text-lg font-semibold">{plan.name}</h2>
              <p className="text-xs text-gray-500 mt-0.5">{plan.tagline}</p>
              <div className="mt-3 flex items-end gap-1">
                <span className="text-4xl font-bold">
                  {interval === "year" ? plan.annual : plan.monthly}€
                </span>
                <span className="text-sm text-gray-400 mb-1">/mes</span>
              </div>
              {interval === "year" && (
                <p className="text-xs text-green-600 mt-1">
                  Facturado anualmente ({plan.annual * 12}€/año)
                </p>
              )}
              <ul className="mt-5 space-y-2 text-sm text-gray-600 flex-1">
                {plan.features.map((f) => (
                  <li key={f} className="flex items-start gap-2">
                    <svg className="w-4 h-4 mt-0.5 text-green-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                    {f}
                  </li>
                ))}
              </ul>
              <button
                onClick={() => handleCheckout(plan.code)}
                disabled={loading !== null}
                className={`mt-6 w-full py-2.5 rounded-xl text-sm font-semibold transition disabled:opacity-50 ${
                  plan.highlight
                    ? "bg-[#185FA5] text-white hover:bg-[#1a6ab8]"
                    : "bg-gray-100 text-gray-900 hover:bg-gray-200"
                }`}
              >
                {loading === plan.code ? "Redirigiendo…" : "Empezar ahora"}
              </button>
            </div>
          ))}
        </div>

        <p className="text-center text-xs text-gray-400 mt-6">
          Pago seguro con Stripe · Sin permanencia · Acceso inmediato tras el pago
        </p>
      </div>
    </div>
  );
}
