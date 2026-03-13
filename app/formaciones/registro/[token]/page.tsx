"use client";

import { useEffect, useMemo, useState } from "react";
import type { CSSProperties } from "react";
import type { TrainingPublicTopicResponse, TrainingSession } from "@/app/(app)/formaciones/_lib/trainingTypes";

function cardStyle(): CSSProperties {
  return {
    border: "1px solid #e5e7eb",
    background: "#fff",
    borderRadius: 12,
    padding: 16,
  };
}

function inputStyle(): CSSProperties {
  return {
    border: "1px solid #d1d5db",
    borderRadius: 10,
    padding: "12px 14px",
    width: "100%",
    background: "#fff",
  };
}

function buttonStyle(active = true): CSSProperties {
  return {
    border: "1px solid #d1d5db",
    borderRadius: 10,
    padding: "12px 14px",
    fontWeight: 700,
    cursor: active ? "pointer" : "not-allowed",
    background: active ? "#111827" : "#f3f4f6",
    color: active ? "#fff" : "#9ca3af",
  };
}

function formatDateTime(value: string) {
  try {
    return new Date(value).toLocaleString("es-MX", {
      dateStyle: "short",
      timeStyle: "short",
    });
  } catch {
    return value;
  }
}

export default function TrainingRegistrationPage({ params }: { params: { token: string } }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [topic, setTopic] = useState<TrainingPublicTopicResponse["topic"] | null>(null);
  const [sessions, setSessions] = useState<TrainingSession[]>([]);
  const [selectedSessionId, setSelectedSessionId] = useState<string>("");
  const [employeeNameInput, setEmployeeNameInput] = useState("");
  const [employeeNumber, setEmployeeNumber] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState<string | null>(null);

  async function loadTopic() {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch(`/api/trainings/sessions?token=${encodeURIComponent(params.token)}`);
      const payload = (await res.json().catch(() => null)) as TrainingPublicTopicResponse | { error?: string } | null;

      if (!res.ok) {
        throw new Error(payload && "error" in payload ? payload.error ?? "No se pudo cargar el tema." : "No se pudo cargar el tema.");
      }

      const nextTopic = payload && "topic" in payload ? payload.topic : null;
      const nextSessions = payload && "sessions" in payload ? payload.sessions : [];

      setTopic(nextTopic);
      setSessions(nextSessions);
      setSelectedSessionId((current) => {
        if (current && nextSessions.some((session) => session.id === current)) {
          return current;
        }

        return nextSessions[0]?.id ?? "";
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo cargar el tema.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadTopic();
  }, [params.token]);

  const selectedSession = useMemo(
    () => sessions.find((session) => session.id === selectedSessionId) ?? null,
    [selectedSessionId, sessions]
  );

  async function handleSubmit() {
    if (!selectedSessionId) {
      setError("Selecciona una sesion.");
      return;
    }

    if (!employeeNumber.trim()) {
      setError("Ingresa tu numero de empleado.");
      return;
    }

    try {
      setSubmitting(true);
      setError(null);
      setSuccess(null);

      const res = await fetch("/api/trainings/attendances", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          session_id: selectedSessionId,
          employee_number: employeeNumber.trim(),
          employee_name_input: employeeNameInput.trim() || null,
        }),
      });

      const payload = (await res.json().catch(() => null)) as { error?: string } | null;

      if (!res.ok) {
        throw new Error(payload?.error ?? "No se pudo registrar la asistencia.");
      }

      setSuccess("Asistencia registrada.");
      setEmployeeNameInput("");
      setEmployeeNumber("");
      await loadTopic();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo registrar la asistencia.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div style={{ minHeight: "100vh", background: "#f3f4f6", padding: "24px 16px" }}>
      <div style={{ maxWidth: 720, margin: "0 auto", display: "grid", gap: 16 }}>
        <div style={cardStyle()}>
          <div style={{ fontSize: 26, fontWeight: 800 }}>Registro de formacion</div>
          <div style={{ marginTop: 6, color: "#4b5563" }}>
            Selecciona la sesion correcta antes de registrar tu asistencia.
          </div>
        </div>

        {loading ? (
          <div style={cardStyle()}>Cargando tema...</div>
        ) : error && !topic ? (
          <div style={{ ...cardStyle(), color: "#b91c1c", fontWeight: 600 }}>{error}</div>
        ) : topic ? (
          <>
            <div style={cardStyle()}>
              <div style={{ fontSize: 22, fontWeight: 800 }}>{topic.title}</div>
              {topic.description ? (
                <div style={{ marginTop: 8, color: "#4b5563", lineHeight: 1.5 }}>{topic.description}</div>
              ) : null}
            </div>

            <div style={cardStyle()}>
              <div style={{ fontWeight: 800, fontSize: 18 }}>Sesiones activas</div>
              <div style={{ marginTop: 10, display: "grid", gap: 10 }}>
                {sessions.length === 0 ? (
                  <div style={{ color: "#6b7280" }}>No hay sesiones activas para este tema en este momento.</div>
                ) : (
                  sessions.map((session) => {
                    const selected = session.id === selectedSessionId;

                    return (
                      <button
                        key={session.id}
                        type="button"
                        onClick={() => setSelectedSessionId(session.id)}
                        style={{
                          textAlign: "left",
                          border: selected ? "1px solid #111827" : "1px solid #e5e7eb",
                          borderRadius: 10,
                          padding: 12,
                          background: selected ? "#f9fafb" : "#fff",
                          cursor: "pointer",
                        }}
                      >
                        <div style={{ fontWeight: 700 }}>
                          {session.session_label?.trim() || "Sesion sin label"}
                        </div>
                        <div style={{ marginTop: 4, color: "#4b5563", fontSize: 14 }}>
                          Supervisor: {session.supervisor_name_snapshot || "Sin nombre"}
                        </div>
                        <div style={{ marginTop: 4, color: "#6b7280", fontSize: 13 }}>
                          Inicio: {formatDateTime(session.opened_at)} · Asistencias: {session.attendance_count}
                        </div>
                      </button>
                    );
                  })
                )}
              </div>
            </div>

            <div style={cardStyle()}>
              <div style={{ fontWeight: 800, fontSize: 18 }}>Registro</div>
              {selectedSession ? (
                <div style={{ marginTop: 8, color: "#4b5563" }}>
                  Sesion seleccionada: <b>{selectedSession.session_label?.trim() || "Sesion sin label"}</b> con{" "}
                  <b>{selectedSession.supervisor_name_snapshot || "Supervisor"}</b>.
                </div>
              ) : null}

              <div style={{ marginTop: 14, display: "grid", gap: 10 }}>
                <input
                  value={employeeNameInput}
                  onChange={(event) => setEmployeeNameInput(event.target.value)}
                  placeholder="Nombre"
                  style={inputStyle()}
                />
                <input
                  value={employeeNumber}
                  onChange={(event) => setEmployeeNumber(event.target.value)}
                  placeholder="Numero de empleado"
                  style={inputStyle()}
                />
                <button
                  type="button"
                  onClick={() => void handleSubmit()}
                  disabled={submitting || !selectedSession}
                  style={buttonStyle(!submitting && !!selectedSession)}
                >
                  {submitting ? "Registrando..." : "Registrar asistencia"}
                </button>
                {error ? <div style={{ color: "#b91c1c", fontWeight: 600 }}>{error}</div> : null}
                {success ? <div style={{ color: "#047857", fontWeight: 600 }}>{success}</div> : null}
              </div>
            </div>
          </>
        ) : null}
      </div>
    </div>
  );
}
