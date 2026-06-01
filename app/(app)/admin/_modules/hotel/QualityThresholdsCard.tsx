"use client";

import { useEffect, useMemo, useState } from "react";
import type { CSSProperties } from "react";
import { supabase } from "@/lib/supabaseClient";

async function getAccessToken() {
  const { data } = await supabase.auth.getSession();
  return data?.session?.access_token ?? null;
}

type Props = {
  hotelId: string | null;
};

type Thresholds = {
  success_score_min: number;
  warning_score_min: number;
  success_fail_rate_max: number;
  warning_fail_rate_max: number;
};

const DEFAULTS: Thresholds = {
  success_score_min: 90,
  warning_score_min: 75,
  success_fail_rate_max: 5,
  warning_fail_rate_max: 15,
};

function cardStyle(): CSSProperties {
  return {
    border: "1px solid rgba(255,255,255,0.10)",
    borderRadius: 16,
    padding: 16,
    background: "rgba(255,255,255,0.04)",
    boxShadow: "0 6px 18px rgba(0,0,0,0.20)",
  };
}

function inputStyle(): CSSProperties {
  return {
    width: "100%",
    borderRadius: 12,
    border: "1px solid rgba(255,255,255,0.14)",
    background: "rgba(255,255,255,0.06)",
    color: "inherit",
    padding: "10px 12px",
    outline: "none",
    fontWeight: 700,
  };
}

function labelStyle(): CSSProperties {
  return {
    fontSize: 12,
    opacity: 0.75,
    fontWeight: 800,
    marginBottom: 6,
  };
}

function btnStyle(isPrimary = false): CSSProperties {
  return {
    padding: "10px 14px",
    borderRadius: 12,
    border: "1px solid rgba(255,255,255,0.14)",
    background: isPrimary ? "#fff" : "transparent",
    color: isPrimary ? "#111" : "#fff",
    fontWeight: 900,
    cursor: "pointer",
  };
}

function helpBoxStyle(): CSSProperties {
  return {
    borderRadius: 14,
    padding: 12,
    background: "rgba(255,255,255,0.05)",
    border: "1px solid rgba(255,255,255,0.08)",
    lineHeight: 1.5,
    fontSize: 13,
    opacity: 0.92,
  };
}

export default function QualityThresholdsCard({ hotelId }: Props) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [okMsg, setOkMsg] = useState<string | null>(null);

  const [form, setForm] = useState<Thresholds>(DEFAULTS);

  useEffect(() => {
    if (!hotelId) {
      setLoading(false);
      return;
    }

    (async () => {
      setLoading(true);
      setError(null);
      setOkMsg(null);

      const token = await getAccessToken();
      if (!token) { setError("Sesión inválida."); setLoading(false); return; }

      const res = await fetch("/api/admin/quality-thresholds", {
        headers: { Authorization: `Bearer ${token}` },
      });
      const payload = await res.json().catch(() => null);

      if (!res.ok) {
        setError(payload?.error ?? "No se pudieron cargar los umbrales.");
        setLoading(false);
        return;
      }

      const data = payload.thresholds;
      setForm({
        success_score_min: Number(data.success_score_min ?? DEFAULTS.success_score_min),
        warning_score_min: Number(data.warning_score_min ?? DEFAULTS.warning_score_min),
        success_fail_rate_max: Number(data.success_fail_rate_max ?? DEFAULTS.success_fail_rate_max),
        warning_fail_rate_max: Number(data.warning_fail_rate_max ?? DEFAULTS.warning_fail_rate_max),
      });

      setLoading(false);
    })();
  }, [hotelId]);

  const validation = useMemo(() => {
    if (form.warning_score_min > form.success_score_min) {
      return "La puntuación mínima de Atención no puede ser mayor que la de Óptimo.";
    }
    if (form.success_fail_rate_max > form.warning_fail_rate_max) {
      return "La tasa máxima de fallos de Óptimo no puede ser mayor que la de Atención.";
    }
    if (
      form.success_score_min < 0 ||
      form.success_score_min > 100 ||
      form.warning_score_min < 0 ||
      form.warning_score_min > 100
    ) {
      return "Los scores deben estar entre 0 y 100.";
    }
    if (
      form.success_fail_rate_max < 0 ||
      form.success_fail_rate_max > 100 ||
      form.warning_fail_rate_max < 0 ||
      form.warning_fail_rate_max > 100
    ) {
      return "Los porcentajes de FAIL deben estar entre 0 y 100.";
    }
    return null;
  }, [form]);

  function updateField<K extends keyof Thresholds>(key: K, value: string) {
    const num = Number(value);
    setForm((prev) => ({
      ...prev,
      [key]: Number.isFinite(num) ? num : 0,
    }));
  }

  async function save() {
    if (!hotelId) return;
    if (validation) {
      setError(validation);
      setOkMsg(null);
      return;
    }

    setSaving(true);
    setError(null);
    setOkMsg(null);

    const token = await getAccessToken();
    if (!token) { setError("Sesión inválida."); setSaving(false); return; }

    const res = await fetch("/api/admin/quality-thresholds", {
      method: "PUT",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify(form),
    });
    const payload = await res.json().catch(() => null);

    setSaving(false);

    if (!res.ok) {
      setError(payload?.error ?? "No se pudieron guardar los umbrales.");
      return;
    }

    setOkMsg("Umbrales guardados correctamente.");
    setTimeout(() => setOkMsg(null), 3000);
  }

  function resetDefaults() {
    setForm(DEFAULTS);
    setError(null);
    setOkMsg(null);
  }

  return (
    <section style={cardStyle()}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
        <div>
          <h3 style={{ margin: 0, fontSize: 22 }}>Umbrales de calidad</h3>
          <div style={{ marginTop: 6, opacity: 0.75 }}>
            Define a partir de qué puntuación y tasa de fallos una auditoría se clasifica como
            óptima, requiere atención o necesita acción prioritaria.
          </div>
        </div>
      </div>

      {!hotelId ? (
        <div style={{ marginTop: 16, opacity: 0.8 }}>
          Selecciona un hotel para configurar sus umbrales.
        </div>
      ) : loading ? (
        <div style={{ marginTop: 16 }}>Cargando umbrales…</div>
      ) : (
        <>
          <div
            style={{
              marginTop: 16,
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
              gap: 14,
            }}
          >
            <div>
              <div style={labelStyle()}>Puntuación mínima — Óptimo</div>
              <input
                type="number"
                min={0}
                max={100}
                step="0.1"
                value={form.success_score_min}
                onChange={(e) => updateField("success_score_min", e.target.value)}
                style={inputStyle()}
              />
              <div style={{ fontSize: 11, opacity: 0.55, marginTop: 4 }}>
                Score ≥ este valor para ser Óptimo
              </div>
            </div>

            <div>
              <div style={labelStyle()}>Puntuación mínima — Atención</div>
              <input
                type="number"
                min={0}
                max={100}
                step="0.1"
                value={form.warning_score_min}
                onChange={(e) => updateField("warning_score_min", e.target.value)}
                style={inputStyle()}
              />
              <div style={{ fontSize: 11, opacity: 0.55, marginTop: 4 }}>
                Score ≥ este valor (y &lt; Óptimo) para Requiere atención
              </div>
            </div>

            <div>
              <div style={labelStyle()}>Tasa máxima de fallos — Óptimo (%)</div>
              <input
                type="number"
                min={0}
                max={100}
                step="0.1"
                value={form.success_fail_rate_max}
                onChange={(e) => updateField("success_fail_rate_max", e.target.value)}
                style={inputStyle()}
              />
              <div style={{ fontSize: 11, opacity: 0.55, marginTop: 4 }}>
                % de ítems con FAIL ≤ este valor para ser Óptimo
              </div>
            </div>

            <div>
              <div style={labelStyle()}>Tasa máxima de fallos — Atención (%)</div>
              <input
                type="number"
                min={0}
                max={100}
                step="0.1"
                value={form.warning_fail_rate_max}
                onChange={(e) => updateField("warning_fail_rate_max", e.target.value)}
                style={inputStyle()}
              />
              <div style={{ fontSize: 11, opacity: 0.55, marginTop: 4 }}>
                % de ítems con FAIL ≤ este valor para Requiere atención
              </div>
            </div>
          </div>

          <div style={{ marginTop: 16, ...helpBoxStyle() }}>
            <div style={{ marginBottom: 6, opacity: 0.6, fontSize: 11, fontWeight: 700, letterSpacing: 1 }}>
              CLASIFICACIÓN RESULTANTE
            </div>
            <div>
              <strong>Óptimo:</strong> score ≥ {form.success_score_min}% y fallos ≤{" "}
              {form.success_fail_rate_max}%
            </div>
            <div style={{ marginTop: 4 }}>
              <strong>Requiere atención:</strong> score ≥ {form.warning_score_min}% y fallos ≤{" "}
              {form.warning_fail_rate_max}%
            </div>
            <div style={{ marginTop: 4 }}>
              <strong>Acción prioritaria:</strong> por debajo de alguno de esos umbrales.
            </div>
            <div style={{ marginTop: 8, opacity: 0.55, fontSize: 12 }}>
              La tasa de fallos es el % de ítems de auditoría respondidos como no conformes sobre el total evaluado.
            </div>
          </div>

          {validation ? (
            <div style={{ marginTop: 14, color: "#fca5a5", fontWeight: 800 }}>{validation}</div>
          ) : null}

          {error ? (
            <div style={{ marginTop: 14, color: "#fca5a5", fontWeight: 800 }}>{error}</div>
          ) : null}

          {okMsg ? (
            <div style={{ marginTop: 14, color: "#86efac", fontWeight: 800 }}>{okMsg}</div>
          ) : null}

          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 16 }}>
            <button onClick={save} style={btnStyle(true)} disabled={saving}>
              {saving ? "Guardando..." : "Guardar umbrales"}
            </button>

            <button onClick={resetDefaults} style={btnStyle(false)} disabled={saving}>
              Restaurar valores por defecto
            </button>
          </div>
        </>
      )}
    </section>
  );
}