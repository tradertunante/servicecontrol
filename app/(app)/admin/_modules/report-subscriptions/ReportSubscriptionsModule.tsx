"use client";

import { useCallback, useEffect, useState } from "react";

type Subscription = {
  id: string;
  email: string;
  report_type: string;
  active: boolean;
  created_at: string;
};

export default function ReportSubscriptionsModule({ hotelId }: { hotelId: string }) {
  const [subs, setSubs] = useState<Subscription[]>([]);
  const [loading, setLoading] = useState(true);
  const [email, setEmail] = useState("");
  const [reportType, setReportType] = useState<"weekly" | "monthly">("weekly");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

  async function handleAdd() {
    if (!email.trim() || !email.includes("@")) {
      setError("Ingresa un email válido.");
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const res = await fetch("/api/admin/report-subscriptions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), report_type: reportType }),
      });

      const data = await res.json();
      if (!data.ok) {
        setError(data.error || "No se pudo agregar.");
        return;
      }

      setEmail("");
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

  return (
    <div className="rounded-2xl border border-black/10 bg-white p-5 shadow-sm">
      <h2 className="text-lg font-black mb-1">Reportes por email</h2>
      <p className="text-sm text-gray-500 mb-4">
        Los suscriptores reciben un resumen automático por email (semanal los lunes, mensual el día 1).
      </p>

      {/* Add form */}
      <div className="flex flex-wrap gap-2 items-end mb-4">
        <div className="flex-1 min-w-[200px]">
          <label className="block text-xs font-bold text-gray-600 mb-1">Email</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="nombre@hotel.com"
            className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:border-blue-400"
          />
        </div>
        <div>
          <label className="block text-xs font-bold text-gray-600 mb-1">Frecuencia</label>
          <select
            value={reportType}
            onChange={(e) => setReportType(e.target.value as "weekly" | "monthly")}
            className="px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:border-blue-400"
          >
            <option value="weekly">Semanal</option>
            <option value="monthly">Mensual</option>
          </select>
        </div>
        <button
          onClick={handleAdd}
          disabled={saving}
          className="px-4 py-2 rounded-lg bg-black text-white text-sm font-bold hover:bg-gray-800 disabled:opacity-50 transition-colors"
        >
          {saving ? "Guardando…" : "Agregar"}
        </button>
      </div>

      {error && (
        <p className="text-sm text-red-600 font-semibold mb-3">{error}</p>
      )}

      {/* List */}
      {loading ? (
        <p className="text-sm text-gray-400">Cargando…</p>
      ) : subs.length === 0 ? (
        <p className="text-sm text-gray-400">No hay suscriptores configurados.</p>
      ) : (
        <div className="border border-gray-100 rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50">
                <th className="text-left px-4 py-2.5 font-bold text-gray-600">Email</th>
                <th className="text-left px-4 py-2.5 font-bold text-gray-600">Tipo</th>
                <th className="text-right px-4 py-2.5 font-bold text-gray-600">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {subs.map((sub) => (
                <tr key={sub.id} className="border-t border-gray-50 hover:bg-gray-50/50">
                  <td className="px-4 py-2.5 font-medium">{sub.email}</td>
                  <td className="px-4 py-2.5">
                    <span className="inline-block px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 text-xs font-bold">
                      {sub.report_type === "weekly" ? "Semanal" : "Mensual"}
                    </span>
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
      )}
    </div>
  );
}
