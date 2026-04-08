"use client";

import { useCallback, useEffect, useState } from "react";
import ReportSubscriptionsModule from "../report-subscriptions/ReportSubscriptionsModule";

type Settings = {
  new_user_email_enabled: boolean;
  quality_audit_submitted_email_enabled: boolean;
};

const TOGGLES: Array<{
  key: keyof Settings;
  label: string;
  description: string;
}> = [
  {
    key: "new_user_email_enabled",
    label: "Nuevo usuario creado",
    description: "Envía un email de bienvenida cuando se crea un nuevo usuario en el hotel.",
  },
  {
    key: "quality_audit_submitted_email_enabled",
    label: "Auditoría de calidad enviada",
    description: "Envía notificaciones instantáneas a los suscriptores cuando se completa una auditoría de calidad.",
  },
];

export default function NotificationsModule({ hotelId }: { hotelId: string }) {
  const [settings, setSettings] = useState<Settings>({
    new_user_email_enabled: true,
    quality_audit_submitted_email_enabled: true,
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<Date | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchSettings = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/notifications");
      const data = await res.json();
      if (data.ok) setSettings(data.settings);
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings, hotelId]);

  function toggle(key: keyof Settings) {
    setSettings((prev) => ({ ...prev, [key]: !prev[key] }));
    setSavedAt(null);
    setError(null);
  }

  async function handleSave() {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/notifications", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(settings),
      });
      const data = await res.json();
      if (!data.ok) {
        setError(data.error ?? "No se pudo guardar.");
        return;
      }
      setSettings(data.settings);
      setSavedAt(new Date());
    } catch {
      setError("Error de conexión.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
    <div className="rounded-2xl border border-black/10 bg-white p-5 shadow-sm">
      <h2 className="text-lg font-black mb-1">Notificaciones</h2>
      <p className="text-sm text-gray-500 mb-5">
        Activa o desactiva los emails automáticos que el sistema envía ante eventos del hotel.
      </p>

      {loading ? (
        <p className="text-sm text-gray-400">Cargando…</p>
      ) : (
        <>
          {/* Card: Emails transaccionales */}
          <div className="rounded-xl border border-gray-100 bg-gray-50/50 p-4 mb-5">
            <div className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-4">
              Emails transaccionales
            </div>

            <div className="grid gap-3">
              {TOGGLES.map(({ key, label, description }) => (
                <div
                  key={key}
                  className="flex items-center justify-between gap-4 py-3 border-b border-gray-100 last:border-b-0"
                >
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-semibold text-gray-800">{label}</div>
                    <div className="text-xs text-gray-500 mt-0.5 leading-relaxed">{description}</div>
                  </div>

                  {/* Toggle */}
                  <button
                    role="switch"
                    aria-checked={settings[key]}
                    onClick={() => toggle(key)}
                    className={[
                      "relative flex-shrink-0 w-11 h-6 rounded-full transition-colors duration-200 focus:outline-none",
                      settings[key] ? "bg-black" : "bg-gray-200",
                    ].join(" ")}
                  >
                    <span
                      className={[
                        "absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow-sm transition-transform duration-200",
                        settings[key] ? "translate-x-5" : "translate-x-0",
                      ].join(" ")}
                    />
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Feedback */}
          {error && (
            <p className="text-sm text-red-600 font-semibold mb-3">{error}</p>
          )}
          {savedAt && !error && (
            <p className="text-sm text-green-600 font-semibold mb-3">
              Cambios guardados correctamente.
            </p>
          )}

          <button
            onClick={handleSave}
            disabled={saving}
            className="px-5 py-2 rounded-lg bg-black text-white text-sm font-bold hover:bg-gray-800 disabled:opacity-50 transition-colors"
          >
            {saving ? "Guardando…" : "Guardar cambios"}
          </button>
        </>
      )}
    </div>

    <div className="mt-4">
      <ReportSubscriptionsModule hotelId={hotelId} />
    </div>
    </>
  );
}
