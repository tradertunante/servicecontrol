"use client";

import { useEffect, useMemo, useState } from "react";
import type { CSSProperties } from "react";
import { supabase } from "@/lib/supabaseClient";

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

      const { data, error } = await supabase
        .from("hotel_quality_thresholds")
        .select(
          "success_score_min, warning_score_min, success_fail_rate_max, warning_fail_rate_max"
        )
        .eq("hotel_id", hotelId)
        .maybeSingle();

      if (error) {
        setError(error.message);
        setLoading(false);
        return;
      }

      if (data) {
        setForm({
          success_score_min: Number(data.success_score_min ?? DEFAULTS.success_score_min),
          warning_score_min: Number(data.warning_score_min ?? DEFAULTS.warning_score_min),
          success_fail_rate_max: Number(
            data.success_fail_rate_max ?? DEFAULTS.success_fail_rate_max
          ),
          warning_fail_rate_max: Number(
            data.warning_fail_rate_max ?? DEFAULTS.warning_fail_rate_max
          ),
        });
      } else {
        setForm(DEFAULTS);
      }

      setLoading(false);
    })();
  }, [hotelId]);

  const validation = useMemo(() => {
    if (form.warning_score_min > form.success_score_min) {
      return "Warning score min no puede ser mayor que Strong score min.";
    }
    if (form.success_fail_rate_max > form.warning_fail_rate_max) {
      return "Strong fail rate max no puede ser mayor que Attention fail rate max.";
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

    const payload = {
      hotel_id: hotelId,
      success_score_min: form.success_score_min,
      warning_score_min: form.warning_score_min,
      success_fail_rate_max: form.success_fail_rate_max,
      warning_fail_rate_max: form.warning_fail_rate_max,
      updated_at: new Date().toISOString(),
    };

    const { error } = await supabase
      .from("hotel_quality_thresholds")
      .upsert(payload, { onConflict: "hotel_id" });

    setSaving(false);

    if (error) {
      setError(error.message);
      return;
    }

    setOkMsg("Umbrales guardados correctamente.");
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
          <h3 style={{ margin: 0, fontSize: 22 }}>Quality Thresholds</h3>
          <div style={{ marginTop: 6, opacity: 0.75 }}>
            Configura cómo se interpreta el resultado de auditorías para este hotel.
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
              <div style={labelStyle()}>Strong score min</div>
              <input
                type="number"
                min={0}
                max={100}
                step="0.1"
                value={form.success_score_min}
                onChange={(e) => updateField("success_score_min", e.target.value)}
                style={inputStyle()}
              />
            </div>

            <div>
              <div style={labelStyle()}>Attention score min</div>
              <input
                type="number"
                min={0}
                max={100}
                step="0.1"
                value={form.warning_score_min}
                onChange={(e) => updateField("warning_score_min", e.target.value)}
                style={inputStyle()}
              />
            </div>

            <div>
              <div style={labelStyle()}>Strong fail rate max (%)</div>
              <input
                type="number"
                min={0}
                max={100}
                step="0.1"
                value={form.success_fail_rate_max}
                onChange={(e) => updateField("success_fail_rate_max", e.target.value)}
                style={inputStyle()}
              />
            </div>

            <div>
              <div style={labelStyle()}>Attention fail rate max (%)</div>
              <input
                type="number"
                min={0}
                max={100}
                step="0.1"
                value={form.warning_fail_rate_max}
                onChange={(e) => updateField("warning_fail_rate_max", e.target.value)}
                style={inputStyle()}
              />
            </div>
          </div>

          <div style={{ marginTop: 16, ...helpBoxStyle() }}>
            <div>
              <strong>Strong:</strong> score ≥ {form.success_score_min}% y FAIL ≤{" "}
              {form.success_fail_rate_max}%
            </div>
            <div style={{ marginTop: 4 }}>
              <strong>Needs attention:</strong> score ≥ {form.warning_score_min}% y FAIL ≤{" "}
              {form.warning_fail_rate_max}%
            </div>
            <div style={{ marginTop: 4 }}>
              <strong>Priority action:</strong> por debajo de esos umbrales.
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