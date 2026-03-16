"use client";

import { useEffect, useMemo, useState } from "react";
import type { CSSProperties } from "react";
import QRCode from "react-qr-code";
import { supabase } from "@/lib/supabaseClient";
import type {
  TrainingAttendance,
  TrainingHistoryDetailResponse,
  TrainingHistoryResponse,
  TrainingHistorySession,
  TrainingTopic,
  TrainingTopicsResponse,
} from "../_lib/trainingTypes";

function panelStyle(): CSSProperties {
  return {
    border: "1px solid #e5e7eb",
    background: "#fff",
    padding: 16,
    borderRadius: 12,
  };
}

function inputStyle(): CSSProperties {
  return {
    border: "1px solid #d1d5db",
    borderRadius: 10,
    padding: "10px 12px",
    width: "100%",
    background: "#fff",
  };
}

function buttonStyle(disabled = false): CSSProperties {
  return {
    border: "1px solid #d1d5db",
    background: disabled ? "#f3f4f6" : "#111827",
    color: disabled ? "#9ca3af" : "#fff",
    padding: "10px 12px",
    borderRadius: 10,
    fontWeight: 700,
    cursor: disabled ? "not-allowed" : "pointer",
  };
}

function secondaryButtonStyle(disabled = false): CSSProperties {
  return {
    border: "1px solid #d1d5db",
    background: disabled ? "#f9fafb" : "#fff",
    color: "#111827",
    padding: "10px 12px",
    borderRadius: 10,
    fontWeight: 700,
    cursor: disabled ? "not-allowed" : "pointer",
  };
}

function formatDateTime(value: string | null) {
  if (!value) return "—";

  try {
    return new Date(value).toLocaleString("es-MX", {
      dateStyle: "short",
      timeStyle: "short",
    });
  } catch {
    return value;
  }
}

async function getAccessToken() {
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token ?? "";
}

function normalizeTrainingsErrorMessage(message: string | null | undefined, fallback: string) {
  const safeMessage = String(message ?? "").trim();
  const lowered = safeMessage.toLowerCase();

  if (
    lowered.includes("could not find the table") ||
    lowered.includes("schema cache") ||
    lowered.includes("relation") && lowered.includes("does not exist") ||
    lowered.includes("training_topics") ||
    lowered.includes("training_sessions") ||
    lowered.includes("training_attendances")
  ) {
    return "El modulo de formaciones aun no esta instalado en la base de datos. Ejecuta las migraciones de Supabase.";
  }

  return safeMessage || fallback;
}

function sanitizeTopics(input: TrainingTopic[] | null | undefined): TrainingTopic[] {
  return (input ?? [])
    .filter((topic) => {
      return (
        !!topic?.id &&
        !!String(topic.title ?? "").trim() &&
        !!String(topic.qr_token ?? "").trim() &&
        topic.is_active !== false
      );
    })
    .map((topic) => ({
      ...topic,
      sessions: (topic.sessions ?? []).filter((session) => {
        return (
          !!session?.id &&
          session.topic_id === topic.id &&
          (session.status === "open" || session.status === "closed")
        );
      }).map((session) => ({
        ...session,
        attendances: (session.attendances ?? []).filter((attendance) => !!attendance?.id),
      })),
    }));
}

function sanitizeHistorySessions(
  input: TrainingHistorySession[] | null | undefined
): TrainingHistorySession[] {
  return (input ?? []).filter((session) => {
    return !!session?.id && !!session.topic_id && !!String(session.topic_title ?? "").trim();
  });
}

export default function TrainingsModule() {
  const [topics, setTopics] = useState<TrainingTopic[]>([]);
  const [historySessions, setHistorySessions] = useState<TrainingHistorySession[]>([]);
  const [loading, setLoading] = useState(true);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [creating, setCreating] = useState(false);
  const [sessionLabels, setSessionLabels] = useState<Record<string, string>>({});
  const [sessionBusyKey, setSessionBusyKey] = useState<string | null>(null);
  const [copiedTopicId, setCopiedTopicId] = useState<string | null>(null);
  const [expandedActiveSessionIds, setExpandedActiveSessionIds] = useState<Record<string, boolean>>({});
  const [expandedHistorySessionId, setExpandedHistorySessionId] = useState<string | null>(null);
  const [historyDetailBusyId, setHistoryDetailBusyId] = useState<string | null>(null);
  const [historyDetails, setHistoryDetails] = useState<
    Record<string, TrainingHistoryDetailResponse["attendances"]>
  >({});
  const [origin, setOrigin] = useState("");

  useEffect(() => {
    if (typeof window !== "undefined") {
      setOrigin(window.location.origin);
    }
  }, []);

  async function loadTopics() {
    try {
      setLoading(true);
      setError(null);
      const token = await getAccessToken();

      if (!token) {
        throw new Error("Sesion invalida.");
      }

      const res = await fetch("/api/trainings/topics", {
        cache: "no-store",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      const payload = (await res.json().catch(() => null)) as TrainingTopicsResponse | { error?: string } | null;

      if (!res.ok) {
        throw new Error(
          normalizeTrainingsErrorMessage(
            payload && "error" in payload ? payload.error ?? null : null,
            "No se pudo cargar formaciones."
          )
        );
      }

      setTopics(
        sanitizeTopics(payload && "topics" in payload ? payload.topics : [])
      );
    } catch (err) {
      setError(
        normalizeTrainingsErrorMessage(
          err instanceof Error ? err.message : null,
          "No se pudo cargar formaciones."
        )
      );
    } finally {
      setLoading(false);
    }
  }

  async function loadHistory() {
    try {
      setHistoryLoading(true);
      setError(null);
      const token = await getAccessToken();

      if (!token) {
        throw new Error("Sesion invalida.");
      }

      const res = await fetch("/api/trainings/history", {
        cache: "no-store",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      const payload = (await res.json().catch(() => null)) as TrainingHistoryResponse | { error?: string } | null;

      if (!res.ok) {
        throw new Error(
          normalizeTrainingsErrorMessage(
            payload && "error" in payload ? payload.error ?? null : null,
            "No se pudo cargar el historico."
          )
        );
      }

      setHistorySessions(
        sanitizeHistorySessions(payload && "sessions" in payload ? payload.sessions : [])
      );
    } catch (err) {
      setError(
        normalizeTrainingsErrorMessage(
          err instanceof Error ? err.message : null,
          "No se pudo cargar el historico."
        )
      );
    } finally {
      setHistoryLoading(false);
    }
  }

  useEffect(() => {
    void loadTopics();
    void loadHistory();
  }, []);

  async function handleCreateTopic() {
    const safeTitle = title.trim();

    if (!safeTitle) {
      setError("El titulo del tema es obligatorio.");
      return;
    }

    try {
      setCreating(true);
      setError(null);
      const token = await getAccessToken();

      if (!token) {
        throw new Error("Sesion invalida.");
      }

      const res = await fetch("/api/trainings/topics", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          title: safeTitle,
          description: description.trim() || null,
        }),
      });

      const payload = (await res.json().catch(() => null)) as { error?: string } | null;

      if (!res.ok) {
        throw new Error(
          normalizeTrainingsErrorMessage(payload?.error ?? null, "No se pudo crear el tema.")
        );
      }

      setTitle("");
      setDescription("");
      await Promise.all([loadTopics(), loadHistory()]);
    } catch (err) {
      setError(
        normalizeTrainingsErrorMessage(
          err instanceof Error ? err.message : null,
          "No se pudo crear el tema."
        )
      );
    } finally {
      setCreating(false);
    }
  }

  async function handleOpenSession(topicId: string) {
    try {
      setSessionBusyKey(`open:${topicId}`);
      setError(null);
      const token = await getAccessToken();

      if (!token) {
        throw new Error("Sesion invalida.");
      }

      const res = await fetch("/api/trainings/sessions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          topic_id: topicId,
          session_label: sessionLabels[topicId]?.trim() || null,
        }),
      });

      const payload = (await res.json().catch(() => null)) as { error?: string } | null;

      if (!res.ok) {
        throw new Error(
          normalizeTrainingsErrorMessage(payload?.error ?? null, "No se pudo abrir la sesion.")
        );
      }

      setSessionLabels((current) => ({ ...current, [topicId]: "" }));
      await Promise.all([loadTopics(), loadHistory()]);
    } catch (err) {
      setError(
        normalizeTrainingsErrorMessage(
          err instanceof Error ? err.message : null,
          "No se pudo abrir la sesion."
        )
      );
    } finally {
      setSessionBusyKey(null);
    }
  }

  async function handleCloseSession(sessionId: string) {
    try {
      setSessionBusyKey(`close:${sessionId}`);
      setError(null);
      const closedAt = new Date().toISOString();
      const sessionToClose =
        topics.flatMap((topic) =>
          topic.sessions.map((session) => ({
            topic,
            session,
          }))
        ).find((entry) => entry.session.id === sessionId) ?? null;
      const token = await getAccessToken();

      if (!token) {
        throw new Error("Sesion invalida.");
      }

      const res = await fetch("/api/trainings/sessions", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          session_id: sessionId,
        }),
      });

      const payload = (await res.json().catch(() => null)) as { error?: string } | null;

      if (!res.ok) {
        throw new Error(
          normalizeTrainingsErrorMessage(payload?.error ?? null, "No se pudo cerrar la sesion.")
        );
      }

      setTopics((current) =>
        current.map((topic) => ({
          ...topic,
          sessions: topic.sessions.map((session) =>
            session.id === sessionId
              ? {
                  ...session,
                  status: "closed",
                  closed_at: closedAt,
                }
              : session
          ),
        }))
      );
      if (sessionToClose) {
        setHistorySessions((current) =>
          [
            {
              id: sessionToClose.session.id,
              topic_id: sessionToClose.session.topic_id,
              topic_title: sessionToClose.topic.title,
              hotel_id: sessionToClose.session.hotel_id,
              opened_at: sessionToClose.session.opened_at,
              closed_at: closedAt,
              supervisor_name_snapshot: sessionToClose.session.supervisor_name_snapshot,
              session_label: sessionToClose.session.session_label,
              attendance_count: sessionToClose.session.attendance_count,
            },
            ...current.filter((session) => session.id !== sessionId),
          ].sort((a, b) => {
            const aTime = a.closed_at ? new Date(a.closed_at).getTime() : 0;
            const bTime = b.closed_at ? new Date(b.closed_at).getTime() : 0;
            return bTime - aTime;
          })
        );
      }
      await Promise.all([loadTopics(), loadHistory()]);
    } catch (err) {
      setError(
        normalizeTrainingsErrorMessage(
          err instanceof Error ? err.message : null,
          "No se pudo cerrar la sesion."
        )
      );
    } finally {
      setSessionBusyKey(null);
    }
  }

  async function handleCopyLink(topicId: string, publicLink: string) {
    try {
      await navigator.clipboard.writeText(publicLink);
      setCopiedTopicId(topicId);
      window.setTimeout(() => {
        setCopiedTopicId((current) => (current === topicId ? null : current));
      }, 1600);
    } catch {
      setError("No se pudo copiar el link.");
    }
  }

  async function handleDeleteSession(sessionId: string) {
    if (typeof window !== "undefined") {
      const confirmed = window.confirm("Esta accion eliminara la sesion cerrada y sus asistencias registradas. ¿Continuar?");
      if (!confirmed) return;
    }

    try {
      setSessionBusyKey(`delete:${sessionId}`);
      setError(null);
      const token = await getAccessToken();

      if (!token) {
        throw new Error("Sesion invalida.");
      }

      const res = await fetch("/api/trainings/sessions", {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          session_id: sessionId,
        }),
      });

      const payload = (await res.json().catch(() => null)) as { error?: string } | null;

      if (!res.ok) {
        throw new Error(
          normalizeTrainingsErrorMessage(payload?.error ?? null, "No se pudo eliminar la sesion.")
        );
      }

      setTopics((current) =>
        current.map((topic) => ({
          ...topic,
          sessions: topic.sessions.filter((session) => session.id !== sessionId),
        }))
      );
      setHistorySessions((current) => current.filter((session) => session.id !== sessionId));
      setHistoryDetails((current) => {
        const next = { ...current };
        delete next[sessionId];
        return next;
      });
      setExpandedHistorySessionId((current) => (current === sessionId ? null : current));
      await Promise.all([loadTopics(), loadHistory()]);
    } catch (err) {
      setError(
        normalizeTrainingsErrorMessage(
          err instanceof Error ? err.message : null,
          "No se pudo eliminar la sesion."
        )
      );
    } finally {
      setSessionBusyKey(null);
    }
  }

  async function handleToggleHistoryDetail(sessionId: string) {
    if (expandedHistorySessionId === sessionId) {
      setExpandedHistorySessionId(null);
      return;
    }

    setExpandedHistorySessionId(sessionId);

    if (historyDetails[sessionId]) {
      return;
    }

    try {
      setHistoryDetailBusyId(sessionId);
      setError(null);
      const token = await getAccessToken();

      if (!token) {
        throw new Error("Sesion invalida.");
      }

      const res = await fetch(`/api/trainings/history?session_id=${encodeURIComponent(sessionId)}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      const payload = (await res.json().catch(() => null)) as TrainingHistoryDetailResponse | { error?: string } | null;

      if (!res.ok) {
        throw new Error(
          normalizeTrainingsErrorMessage(
            payload && "error" in payload ? payload.error ?? null : null,
            "No se pudo cargar el detalle historico."
          )
        );
      }

      setHistoryDetails((current) => ({
        ...current,
        [sessionId]: payload && "attendances" in payload ? payload.attendances : [],
      }));
    } catch (err) {
      setError(
        normalizeTrainingsErrorMessage(
          err instanceof Error ? err.message : null,
          "No se pudo cargar el detalle historico."
        )
      );
    } finally {
      setHistoryDetailBusyId(null);
    }
  }

  function toggleActiveSessionDetail(sessionId: string) {
    setExpandedActiveSessionIds((current) => ({
      ...current,
      [sessionId]: !current[sessionId],
    }));
  }

  function getAttendanceDisplayName(attendance: TrainingAttendance) {
    const validated = String(attendance.validated_member_name ?? "").trim();
    if (validated) return validated;
    const inputName = String(attendance.employee_name_input ?? "").trim();
    if (inputName) return inputName;
    return "Sin nombre capturado";
  }

  function renderAttendanceList(attendances: TrainingAttendance[]) {
    if (attendances.length === 0) {
      return <div style={{ color: "#6b7280" }}>Sin asistencias registradas.</div>;
    }

    return attendances.map((attendance) => (
      <div
        key={attendance.id}
        style={{
          border: "1px solid #e5e7eb",
          borderRadius: 10,
          padding: 10,
          background: "#fff",
          display: "grid",
          gap: 8,
          alignItems: "center",
          gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
        }}
      >
        <div style={{ fontWeight: 700 }}>{getAttendanceDisplayName(attendance)}</div>
        <div style={{ marginTop: 4, fontSize: 13, color: "#4b5563" }}>
          Numero: {attendance.employee_number || "Sin numero"}
        </div>
        <div style={{ marginTop: 4, fontSize: 13, color: "#6b7280" }}>
          Registro: {formatDateTime(attendance.checked_in_at)}
        </div>
      </div>
    ));
  }

  const topicsWithActiveSessions = useMemo(
    () =>
      topics
        .map((topic) => ({
          ...topic,
          sessions: topic.sessions.filter((session) => session.status === "open"),
        }))
        .filter((topic) => topic.sessions.length > 0)
        .sort((a, b) => {
          if (a.sessions.length !== b.sessions.length) {
            return b.sessions.length - a.sessions.length;
          }

          return a.title.localeCompare(b.title, "es");
        }),
    [topics]
  );

  return (
    <div style={{ display: "grid", gap: 16, padding: "24px 0" }}>
      <div style={panelStyle()}>
        <div style={{ fontSize: 24, fontWeight: 800 }}>Formaciones</div>
        <div style={{ marginTop: 6, color: "#4b5563", lineHeight: 1.5 }}>
          Crea temas con link fijo de registro, abre sesiones cuando realmente se impartan y revisa el conteo de asistencia por sesion.
        </div>
        <div style={{ marginTop: 14, display: "grid", gap: 10 }}>
          <input
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder="Titulo del tema"
            style={inputStyle()}
          />
          <textarea
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            placeholder="Descripcion opcional"
            style={{ ...inputStyle(), minHeight: 88, resize: "vertical" }}
          />
          <div>
            <button onClick={() => void handleCreateTopic()} disabled={creating} style={buttonStyle(creating)}>
              {creating ? "Creando..." : "Crear tema"}
            </button>
          </div>
          {error ? <div style={{ color: "#b91c1c", fontWeight: 600 }}>{error}</div> : null}
        </div>
      </div>

      <div style={panelStyle()}>
        <div style={{ fontSize: 22, fontWeight: 800 }}>Temas creados</div>
        <div style={{ marginTop: 6, color: "#4b5563", lineHeight: 1.5 }}>
          Solo se muestran temas que actualmente tienen al menos una sesion activa.
        </div>

        <div style={{ marginTop: 14, display: "grid", gap: 12 }}>
          {loading ? (
            <div style={{ color: "#6b7280" }}>Cargando temas...</div>
          ) : topicsWithActiveSessions.length === 0 ? (
            <div style={{ color: "#6b7280" }}>No hay temas con sesiones activas.</div>
          ) : (
            topicsWithActiveSessions.map((topic) => {
              const openSessions = topic.sessions;
              const publicLink = origin ? `${origin}/formaciones/registro/${topic.qr_token}` : `/formaciones/registro/${topic.qr_token}`;

              return (
                <div key={topic.id} style={{ border: "1px solid #e5e7eb", borderRadius: 12, padding: 16, background: "#fff" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                    <div style={{ display: "grid", gap: 10, flex: 1, minWidth: 280 }}>
                      <div style={{ fontSize: 20, fontWeight: 800 }}>{topic.title}</div>
                      {topic.description ? (
                        <div style={{ marginTop: 6, color: "#4b5563", lineHeight: 1.5 }}>{topic.description}</div>
                      ) : null}
                      <div style={{ fontSize: 13, color: "#4b5563" }}>
                        <b>Area:</b> {topic.area_name || "Sin area"}
                      </div>
                      <div
                        style={{
                          border: "1px solid #e5e7eb",
                          borderRadius: 12,
                          padding: 14,
                          background: "#f9fafb",
                          width: "fit-content",
                        }}
                      >
                        <QRCode value={publicLink} size={160} bgColor="#FFFFFF" fgColor="#111827" />
                      </div>
                      <div style={{ fontSize: 13, color: "#4b5563", lineHeight: 1.5 }}>
                        <div style={{ fontWeight: 700, marginBottom: 4 }}>Link fijo del QR</div>
                        <a
                          href={publicLink}
                          target="_blank"
                          rel="noreferrer"
                          style={{ color: "#2563eb", wordBreak: "break-all" }}
                        >
                          {publicLink}
                        </a>
                      </div>
                      <div>
                        <button
                          type="button"
                          onClick={() => void handleCopyLink(topic.id, publicLink)}
                          style={secondaryButtonStyle(false)}
                        >
                          {copiedTopicId === topic.id ? "Link copiado" : "Copiar link"}
                        </button>
                      </div>
                    </div>

                    <div style={{ minWidth: 240, display: "grid", gap: 8 }}>
                      <div
                        style={{
                          border: "1px solid #e5e7eb",
                          borderRadius: 10,
                          padding: 12,
                          background: "#f9fafb",
                          fontSize: 14,
                        }}
                      >
                        <b>Sesiones activas:</b> {openSessions.length}
                      </div>
                      <input
                        value={sessionLabels[topic.id] ?? ""}
                        onChange={(event) =>
                          setSessionLabels((current) => ({ ...current, [topic.id]: event.target.value }))
                        }
                        placeholder="Label opcional, ej. 7 AM"
                        style={inputStyle()}
                      />
                      <button
                        onClick={() => void handleOpenSession(topic.id)}
                        disabled={sessionBusyKey === `open:${topic.id}`}
                        style={buttonStyle(sessionBusyKey === `open:${topic.id}`)}
                      >
                        {sessionBusyKey === `open:${topic.id}` ? "Abriendo..." : "Abrir sesion"}
                      </button>
                    </div>
                  </div>

                  <div style={{ marginTop: 16, display: "grid", gap: 10 }}>
                    <div style={{ fontWeight: 800, fontSize: 16 }}>Sesiones activas</div>
                    {openSessions.map((session) => (
                      <div
                        key={session.id}
                        style={{
                          border: "1px solid #e5e7eb",
                          borderRadius: 10,
                          padding: 12,
                          background: "#ecfdf5",
                        }}
                      >
                        <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                          <div style={{ display: "grid", gap: 4 }}>
                            <div style={{ fontWeight: 700 }}>
                              {session.session_label?.trim() || "Sesion sin label"} · Abierta
                            </div>
                            <div style={{ fontSize: 14, color: "#4b5563" }}>
                              Supervisor: {session.supervisor_name_snapshot || "Sin nombre"}
                            </div>
                            <div style={{ fontSize: 13, color: "#6b7280" }}>
                              Inicio: {formatDateTime(session.opened_at)}
                            </div>
                          </div>

                          <div style={{ display: "grid", gap: 8, justifyItems: "end" }}>
                            <div
                              style={{
                                border: "1px solid #d1d5db",
                                borderRadius: 999,
                                padding: "6px 10px",
                                fontSize: 13,
                                background: "#fff",
                              }}
                            >
                              Asistencias: <b>{session.attendance_count}</b>
                            </div>
                            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "flex-end" }}>
                              <button
                                type="button"
                                onClick={() => toggleActiveSessionDetail(session.id)}
                                style={secondaryButtonStyle(false)}
                              >
                                {expandedActiveSessionIds[session.id] ? "Ocultar asistentes" : "Ver asistentes"}
                              </button>
                              <button
                                onClick={() => void handleCloseSession(session.id)}
                                disabled={sessionBusyKey === `close:${session.id}`}
                                style={secondaryButtonStyle(sessionBusyKey === `close:${session.id}`)}
                              >
                                {sessionBusyKey === `close:${session.id}` ? "Cerrando..." : "Cerrar sesion"}
                              </button>
                            </div>
                          </div>
                        </div>

                        {expandedActiveSessionIds[session.id] ? (
                          <div
                            style={{
                              marginTop: 12,
                              borderTop: "1px solid #d1fae5",
                              paddingTop: 12,
                              display: "grid",
                              gap: 8,
                            }}
                          >
                            {renderAttendanceList(session.attendances ?? [])}
                          </div>
                        ) : null}
                      </div>
                    ))}
                  </div>

                </div>
              );
            })
          )}
        </div>
      </div>

      <div style={panelStyle()}>
        <div style={{ fontSize: 22, fontWeight: 800 }}>Historico</div>
        <div style={{ marginTop: 6, color: "#4b5563", lineHeight: 1.5 }}>
          Sesiones cerradas de todas las formaciones, ordenadas por cierre mas reciente.
        </div>

        <div style={{ marginTop: 14, display: "grid", gap: 10 }}>
          {historyLoading ? (
            <div style={{ color: "#6b7280" }}>Cargando historico...</div>
          ) : historySessions.length === 0 ? (
            <div style={{ color: "#6b7280" }}>No hay sesiones cerradas todavia.</div>
          ) : (
            historySessions.map((session) => (
              <div
                key={session.id}
                style={{
                  border: "1px solid #e5e7eb",
                  borderRadius: 10,
                  padding: 12,
                  background: "#f9fafb",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                  <div style={{ display: "grid", gap: 4 }}>
                    <div style={{ fontWeight: 800 }}>{session.topic_title}</div>
                    <div style={{ fontSize: 14, color: "#4b5563" }}>
                      Supervisor: {session.supervisor_name_snapshot || "Sin nombre"}
                    </div>
                    <div style={{ fontSize: 13, color: "#4b5563" }}>
                      Sesion: {session.session_label?.trim() || "Sesion sin label"}
                    </div>
                    <div style={{ fontSize: 13, color: "#6b7280" }}>
                      Inicio: {formatDateTime(session.opened_at)} · Cierre: {formatDateTime(session.closed_at)}
                    </div>
                  </div>

                  <div style={{ display: "grid", gap: 8, justifyItems: "end" }}>
                    <div
                      style={{
                        border: "1px solid #d1d5db",
                        borderRadius: 999,
                        padding: "6px 10px",
                        fontSize: 13,
                        background: "#fff",
                      }}
                    >
                      Asistencias: <b>{session.attendance_count}</b>
                    </div>
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "flex-end" }}>
                      <button
                        onClick={() => void handleToggleHistoryDetail(session.id)}
                        disabled={historyDetailBusyId === session.id}
                        style={secondaryButtonStyle(historyDetailBusyId === session.id)}
                      >
                        {expandedHistorySessionId === session.id ? "Ocultar detalle" : "Ver detalle"}
                      </button>
                      <button
                        onClick={() => void handleDeleteSession(session.id)}
                        disabled={sessionBusyKey === `delete:${session.id}`}
                        style={secondaryButtonStyle(sessionBusyKey === `delete:${session.id}`)}
                      >
                        {sessionBusyKey === `delete:${session.id}` ? "Eliminando..." : "Eliminar"}
                      </button>
                    </div>
                  </div>
                </div>

                {expandedHistorySessionId === session.id ? (
                  <div
                    style={{
                      marginTop: 12,
                      borderTop: "1px solid #e5e7eb",
                      paddingTop: 12,
                      display: "grid",
                      gap: 8,
                    }}
                  >
                    {historyDetailBusyId === session.id ? (
                      <div style={{ color: "#6b7280" }}>Cargando detalle...</div>
                    ) : (historyDetails[session.id] ?? []).length === 0 ? (
                      <div style={{ color: "#6b7280" }}>Sin asistencias registradas.</div>
                    ) : (
                      renderAttendanceList(historyDetails[session.id] ?? [])
                    )}
                  </div>
                ) : null}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
