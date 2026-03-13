"use client";

import { useEffect, useMemo, useState } from "react";
import type { CSSProperties } from "react";
import QRCode from "react-qr-code";
import { supabase } from "@/lib/supabaseClient";
import type { TrainingTopic, TrainingTopicsResponse } from "../_lib/trainingTypes";

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

export default function TrainingsModule() {
  const [topics, setTopics] = useState<TrainingTopic[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [creating, setCreating] = useState(false);
  const [sessionLabels, setSessionLabels] = useState<Record<string, string>>({});
  const [sessionBusyKey, setSessionBusyKey] = useState<string | null>(null);
  const [copiedTopicId, setCopiedTopicId] = useState<string | null>(null);
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

      setTopics(payload && "topics" in payload ? payload.topics : []);
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

  useEffect(() => {
    void loadTopics();
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
      await loadTopics();
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
      await loadTopics();
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

      await loadTopics();
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

  const sortedTopics = useMemo(
    () =>
      [...topics].sort((a, b) => {
        const aOpen = a.sessions.filter((session) => session.status === "open").length;
        const bOpen = b.sessions.filter((session) => session.status === "open").length;

        if (aOpen !== bOpen) {
          return bOpen - aOpen;
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

      <div style={{ display: "grid", gap: 12 }}>
        {loading ? (
          <div style={panelStyle()}>Cargando formaciones...</div>
        ) : sortedTopics.length === 0 ? (
          <div style={panelStyle()}>No hay temas registrados todavia.</div>
        ) : (
          sortedTopics.map((topic) => {
            const activeSessions = topic.sessions.filter((session) => session.status === "open");
            const publicLink = origin ? `${origin}/formaciones/registro/${topic.qr_token}` : `/formaciones/registro/${topic.qr_token}`;

            return (
              <div key={topic.id} style={panelStyle()}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                  <div style={{ display: "grid", gap: 10, flex: 1, minWidth: 280 }}>
                    <div style={{ fontSize: 20, fontWeight: 800 }}>{topic.title}</div>
                    {topic.description ? (
                      <div style={{ marginTop: 6, color: "#4b5563", lineHeight: 1.5 }}>{topic.description}</div>
                    ) : null}
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
                      <b>Sesiones activas:</b> {activeSessions.length}
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
                  {topic.sessions.length === 0 ? (
                    <div style={{ color: "#6b7280" }}>Sin sesiones todavia.</div>
                  ) : (
                    topic.sessions.map((session) => (
                      <div
                        key={session.id}
                        style={{
                          border: "1px solid #e5e7eb",
                          borderRadius: 10,
                          padding: 12,
                          background: session.status === "open" ? "#ecfdf5" : "#f9fafb",
                        }}
                      >
                        <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                          <div style={{ display: "grid", gap: 4 }}>
                            <div style={{ fontWeight: 700 }}>
                              {session.session_label?.trim() || "Sesion sin label"} · {session.status === "open" ? "Abierta" : "Cerrada"}
                            </div>
                            <div style={{ fontSize: 14, color: "#4b5563" }}>
                              Supervisor: {session.supervisor_name_snapshot || "Sin nombre"}
                            </div>
                            <div style={{ fontSize: 13, color: "#6b7280" }}>
                              Inicio: {formatDateTime(session.opened_at)}
                              {session.closed_at ? ` · Cierre: ${formatDateTime(session.closed_at)}` : ""}
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
                            {session.status === "open" ? (
                              <button
                                onClick={() => void handleCloseSession(session.id)}
                                disabled={sessionBusyKey === `close:${session.id}`}
                                style={secondaryButtonStyle(sessionBusyKey === `close:${session.id}`)}
                              >
                                {sessionBusyKey === `close:${session.id}` ? "Cerrando..." : "Cerrar sesion"}
                              </button>
                            ) : null}
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
