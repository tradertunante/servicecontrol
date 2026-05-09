"use client";

import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

type Subscription = {
  id: string;
  email: string;
  frequency: "instant" | "weekly" | "monthly";
  scope: "all_areas" | "my_areas" | "specific_areas";
  area_ids: string[] | null;
  channel: "all" | "quality" | "internal";
  active: boolean;
  created_at: string;
};

type Area = { id: string; name: string };

const FREQ_LABELS: Record<string, string> = {
  instant: "Instantáneo",
  weekly: "Semanal",
  monthly: "Mensual",
};

const SCOPE_LABELS: Record<string, string> = {
  all_areas: "Todas las áreas",
  my_areas: "Mis áreas asignadas",
  specific_areas: "Áreas específicas",
};

const CHANNEL_LABELS: Record<string, string> = {
  all: "Todas",
  quality: "Solo calidad",
  internal: "Solo internas",
};

export default function ReportSubscriptionsModule({ hotelId }: { hotelId: string }) {
  const [subs, setSubs] = useState<Subscription[]>([]);
  const [areas, setAreas] = useState<Area[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form state
  const [email, setEmail] = useState("");
  const [frequency, setFrequency] = useState<"instant" | "weekly" | "monthly">("weekly");
  const [scope, setScope] = useState<"all_areas" | "my_areas" | "specific_areas">("all_areas");
  const [selectedAreaIds, setSelectedAreaIds] = useState<string[]>([]);
  const [channel, setChannel] = useState<"all" | "quality" | "internal">("all");

  const fetchSubs = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/report-subscriptions");
      const data = await res.json();
      if (data.ok) setSubs(data.subscriptions);
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSubs();
  }, [fetchSubs, hotelId]);

  useEffect(() => {
    async function loadAreas() {
      const { data } = await supabase
        .from("areas")
        .select("id,name")
        .eq("hotel_id", hotelId)
        .order("name");
      setAreas((data ?? []) as Area[]);
    }
    loadAreas();
  }, [hotelId]);

  function toggleArea(areaId: string) {
    setSelectedAreaIds((prev) =>
      prev.includes(areaId) ? prev.filter((id) => id !== areaId) : [...prev, areaId]
    );
  }

  async function handleAdd() {
    if (!email.trim() || !email.includes("@")) {
      setError("Ingresa un email válido.");
      return;
    }
    if (scope === "specific_areas" && selectedAreaIds.length === 0) {
      setError("Selecciona al menos un área.");
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const res = await fetch("/api/admin/report-subscriptions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: email.trim(),
          frequency,
          scope,
          area_ids: scope === "specific_areas" ? selectedAreaIds : null,
          channel,
        }),
      });

      const data = await res.json();
      if (!data.ok) {
        setError(data.error || "No se pudo agregar.");
        return;
      }

      setEmail("");
      setSelectedAreaIds([]);
      fetchSubs();
    } catch {
      setError("Error de conexión.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    try {
      await fetch("/api/admin/report-subscriptions", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      setSubs((prev) => prev.filter((s) => s.id !== id));
    } catch {
      // silent
    }
  }

  function areaNames(ids: string[] | null): string {
    if (!ids || ids.length === 0) return "—";
    return ids
      .map((id) => areas.find((a) => a.id === id)?.name ?? id.slice(0, 8))
      .join(", ");
  }

  return (
    <div className="rounded-2xl border border-black/10 bg-white p-5 shadow-sm">
      <h2 className="text-lg font-black mb-1">Reportes por email</h2>
      <p className="text-sm text-gray-500 mb-5">
        Configura quién recibe reportes, con qué frecuencia, y de qué áreas y tipo de auditoría.
      </p>

      {/* Form */}
      <div className="rounded-xl border border-gray-100 bg-gray-50/50 p-4 mb-5">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3">
          <div>
            <label className="block text-xs font-bold text-gray-600 mb-1">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="nombre@hotel.com"
              className="w-full px-3 py-3 rounded-lg border border-gray-200 text-sm focus:outline-none focus:border-blue-400 min-h-[44px]"
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-gray-600 mb-1">Frecuencia</label>
            <select
              value={frequency}
              onChange={(e) => setFrequency(e.target.value as typeof frequency)}
              className="w-full px-3 py-3 rounded-lg border border-gray-200 text-sm focus:outline-none focus:border-blue-400 min-h-[44px]"
            >
              <option value="instant">Instantáneo (al enviar auditoría)</option>
              <option value="weekly">Semanal (lunes)</option>
              <option value="monthly">Mensual (día 1)</option>
            </select>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3">
          <div>
            <label className="block text-xs font-bold text-gray-600 mb-1">Tipo de auditorías</label>
            <select
              value={channel}
              onChange={(e) => setChannel(e.target.value as typeof channel)}
              className="w-full px-3 py-3 rounded-lg border border-gray-200 text-sm focus:outline-none focus:border-blue-400 min-h-[44px]"
            >
              <option value="all">Todas las auditorías</option>
              <option value="quality">Solo auditorías de calidad</option>
              <option value="internal">Solo auditorías internas</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-bold text-gray-600 mb-1">Alcance de áreas</label>
            <select
              value={scope}
              onChange={(e) => setScope(e.target.value as typeof scope)}
              className="w-full px-3 py-3 rounded-lg border border-gray-200 text-sm focus:outline-none focus:border-blue-400 min-h-[44px]"
            >
              <option value="all_areas">Todas las áreas</option>
              <option value="my_areas">Mis áreas asignadas</option>
              <option value="specific_areas">Áreas específicas</option>
            </select>
          </div>
        </div>

        {scope === "specific_areas" && (
          <div className="mb-3">
            <label className="block text-xs font-bold text-gray-600 mb-1.5">Selecciona áreas</label>
            <div className="flex flex-wrap gap-2">
              {areas.map((area) => {
                const selected = selectedAreaIds.includes(area.id);
                return (
                  <button
                    key={area.id}
                    onClick={() => toggleArea(area.id)}
                    className={`px-3 py-2 min-h-[44px] rounded-lg text-xs font-bold border transition-colors ${
                      selected
                        ? "bg-black text-white border-black"
                        : "bg-white text-gray-700 border-gray-200 hover:border-gray-400"
                    }`}
                  >
                    {area.name}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {error && <p className="text-sm text-red-600 font-semibold mb-3">{error}</p>}

        <button
          onClick={handleAdd}
          disabled={saving}
          className="px-5 py-3 rounded-lg bg-black text-white text-sm font-bold hover:bg-gray-800 disabled:opacity-50 transition-colors min-h-[44px]"
        >
          {saving ? "Guardando…" : "Agregar suscripción"}
        </button>
      </div>

      {/* List */}
      {loading ? (
        <p className="text-sm text-gray-400">Cargando…</p>
      ) : subs.length === 0 ? (
        <p className="text-sm text-gray-400">No hay suscriptores configurados.</p>
      ) : (
        <>
          {/* Mobile: tarjetas */}
          <div className="flex flex-col gap-2 md:hidden">
            {subs.map((sub) => (
              <div key={sub.id} className="border border-gray-100 rounded-xl p-3 bg-gray-50/50">
                <div className="flex items-start justify-between gap-2 mb-2">
                  <span className="text-sm font-medium text-gray-800 break-all leading-snug">{sub.email}</span>
                  <button
                    onClick={() => handleDelete(sub.id)}
                    className="text-xs text-red-500 hover:text-red-700 font-bold flex-shrink-0 ml-1"
                  >
                    Eliminar
                  </button>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-bold ${
                    sub.frequency === "instant"
                      ? "bg-red-50 text-red-700"
                      : sub.frequency === "weekly"
                      ? "bg-blue-50 text-blue-700"
                      : "bg-purple-50 text-purple-700"
                  }`}>
                    {FREQ_LABELS[sub.frequency]}
                  </span>
                  <span className="text-xs text-gray-500">{CHANNEL_LABELS[sub.channel]}</span>
                  <span className="text-xs text-gray-400">
                    {sub.scope === "specific_areas" ? areaNames(sub.area_ids) : SCOPE_LABELS[sub.scope]}
                  </span>
                </div>
              </div>
            ))}
          </div>

          {/* Desktop: tabla */}
          <div className="hidden md:block border border-gray-100 rounded-xl overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50">
                  <th className="text-left px-4 py-2.5 font-bold text-gray-600">Email</th>
                  <th className="text-left px-4 py-2.5 font-bold text-gray-600">Frecuencia</th>
                  <th className="text-left px-4 py-2.5 font-bold text-gray-600">Auditorías</th>
                  <th className="text-left px-4 py-2.5 font-bold text-gray-600">Áreas</th>
                  <th className="text-right px-4 py-2.5 font-bold text-gray-600"></th>
                </tr>
              </thead>
              <tbody>
                {subs.map((sub) => (
                  <tr key={sub.id} className="border-t border-gray-50 hover:bg-gray-50/50">
                    <td className="px-4 py-2.5 font-medium">{sub.email}</td>
                    <td className="px-4 py-2.5">
                      <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-bold ${
                        sub.frequency === "instant"
                          ? "bg-red-50 text-red-700"
                          : sub.frequency === "weekly"
                          ? "bg-blue-50 text-blue-700"
                          : "bg-purple-50 text-purple-700"
                      }`}>
                        {FREQ_LABELS[sub.frequency]}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-gray-500 text-xs">
                      {CHANNEL_LABELS[sub.channel]}
                    </td>
                    <td className="px-4 py-2.5 text-gray-500 text-xs max-w-[200px] truncate">
                      {sub.scope === "specific_areas"
                        ? areaNames(sub.area_ids)
                        : SCOPE_LABELS[sub.scope]}
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      <button
                        onClick={() => handleDelete(sub.id)}
                        className="text-xs text-red-500 hover:text-red-700 font-bold"
                      >
                        Eliminar
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
