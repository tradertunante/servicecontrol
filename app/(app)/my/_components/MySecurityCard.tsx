"use client";

import { useMemo, useState } from "react";
import type { CSSProperties } from "react";
import { supabase } from "@/lib/supabaseClient";

function buildCard(): CSSProperties {
  return {
    border: "1px solid var(--border)",
    borderRadius: 14,
    padding: 14,
    background: "var(--card-bg)",
    width: "100%",
  };
}

function buildInput(): CSSProperties {
  return {
    width: "100%",
    padding: "10px 12px",
    borderRadius: 12,
    border: "1px solid var(--input-border)",
    background: "var(--input-bg)",
    color: "var(--input-text)",
    outline: "none",
  };
}

function buildBtn(): CSSProperties {
  return {
    border: "1px solid var(--input-border)",
    borderRadius: 12,
    padding: "10px 12px",
    background: "rgba(0, 0, 0, 0.04)",
    cursor: "pointer",
    color: "var(--text)",
  };
}

export default function MySecurityCard({
  email,
}: {
  email: string | null | undefined;
}) {
  const card = useMemo(() => buildCard(), []);
  const input = useMemo(() => buildInput(), []);
  const btn = useMemo(() => buildBtn(), []);

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [sendingReset, setSendingReset] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleUpdatePassword() {
    setMessage(null);
    setError(null);

    if (!password || !confirm) {
      setError("Completa ambos campos.");
      return;
    }

    if (password !== confirm) {
      setError("Las contraseñas no coinciden.");
      return;
    }

    if (password.length < 8) {
      setError("La contraseña debe tener al menos 8 caracteres.");
      return;
    }

    try {
      setLoading(true);

      const { error } = await supabase.auth.updateUser({
        password,
      });

      if (error) {
        setError(error.message);
        return;
      }

      setPassword("");
      setConfirm("");
      setMessage("Contraseña actualizada correctamente.");
    } finally {
      setLoading(false);
    }
  }

  async function handleSendResetEmail() {
    setMessage(null);
    setError(null);

    if (!email) {
      setError("No hay email disponible para enviar el restablecimiento.");
      return;
    }

    try {
      setSendingReset(true);

      const redirectTo =
        typeof window !== "undefined"
          ? `${window.location.origin}/my`
          : undefined;

      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo,
      });

      if (error) {
        setError(error.message);
        return;
      }

      setMessage("Te hemos enviado un email para restablecer la contraseña.");
    } finally {
      setSendingReset(false);
    }
  }

  return (
    <div style={card}>
      <div style={{ fontSize: 16, fontWeight: 900 }}>Seguridad</div>
      <div style={{ opacity: 0.82, fontSize: 13, marginTop: 4 }}>
        Cambia tu contraseña o solicita un email de restablecimiento.
      </div>

      {error ? (
        <div
          style={{
            marginTop: 12,
            padding: 10,
            borderRadius: 12,
            border: "1px solid var(--danger)",
            background: "rgba(198, 40, 40, 0.08)",
            color: "var(--danger)",
          }}
        >
          {error}
        </div>
      ) : null}

      {message ? (
        <div
          style={{
            marginTop: 12,
            padding: 10,
            borderRadius: 12,
            border: "1px solid var(--ok)",
            background: "rgba(15, 118, 110, 0.08)",
            color: "var(--ok)",
          }}
        >
          {message}
        </div>
      ) : null}

      <div
        style={{
          marginTop: 12,
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
          gap: 12,
        }}
      >
        <div>
          <div style={{ opacity: 0.8, fontSize: 12, marginBottom: 6 }}>
            Nueva contraseña
          </div>
          <input
            style={input}
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Mínimo 8 caracteres"
          />
        </div>

        <div>
          <div style={{ opacity: 0.8, fontSize: 12, marginBottom: 6 }}>
            Confirmar contraseña
          </div>
          <input
            style={input}
            type="password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            placeholder="Repite la contraseña"
          />
        </div>
      </div>

      <div style={{ marginTop: 12, display: "flex", gap: 10, flexWrap: "wrap" }}>
        <button style={btn} onClick={handleUpdatePassword} disabled={loading}>
          {loading ? "Actualizando..." : "Actualizar contraseña"}
        </button>

        <button style={btn} onClick={handleSendResetEmail} disabled={sendingReset}>
          {sendingReset ? "Enviando..." : "Enviar email de restablecimiento"}
        </button>
      </div>
    </div>
  );
}