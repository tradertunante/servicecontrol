"use client";

import { useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    const trimmed = email.trim();
    if (!trimmed) {
      setError("Ingresa tu email.");
      return;
    }

    try {
      setLoading(true);

      const { error } = await supabase.auth.resetPasswordForEmail(trimmed, {
        redirectTo: `${window.location.origin}/reset-password`,
      });

      if (error) throw error;
      setSent(true);
    } catch (e: any) {
      setError(e?.message ?? "No se pudo enviar el email. Intenta de nuevo.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main
      style={{
        minHeight: "100vh",
        display: "grid",
        placeItems: "center",
        padding: 24,
      }}
    >
      <div style={{ width: "100%", maxWidth: 520 }}>
        <h1 style={{ fontSize: 34, fontWeight: 950, marginBottom: 10 }}>
          ServiceControl
        </h1>
        <p style={{ opacity: 0.75, marginBottom: 18 }}>
          Recupera el acceso a tu cuenta
        </p>

        {sent ? (
          <div
            style={{
              width: "100%",
              background: "#fff",
              borderRadius: 18,
              padding: 18,
              border: "1px solid rgba(0,0,0,0.12)",
              boxShadow: "0 10px 40px rgba(0,0,0,0.18)",
            }}
          >
            <div
              style={{
                padding: 14,
                borderRadius: 12,
                background: "rgba(15, 118, 110, 0.08)",
                border: "1px solid rgba(15, 118, 110, 0.3)",
                color: "#0f766e",
                fontWeight: 700,
              }}
            >
              Te hemos enviado un email con instrucciones para restablecer tu
              contraseña. Revisa tu bandeja de entrada y spam.
            </div>

            <Link
              href="/login"
              style={{
                display: "block",
                marginTop: 16,
                textAlign: "center",
                fontWeight: 900,
                color: "#111",
                textDecoration: "underline",
              }}
            >
              Volver al inicio de sesión
            </Link>
          </div>
        ) : (
          <form
            onSubmit={onSubmit}
            style={{
              width: "100%",
              background: "#fff",
              borderRadius: 18,
              padding: 18,
              border: "1px solid rgba(0,0,0,0.12)",
              boxShadow: "0 10px 40px rgba(0,0,0,0.18)",
            }}
          >
            <label
              style={{
                display: "block",
                fontWeight: 900,
                marginBottom: 6,
                color: "#111",
              }}
            >
              Email
            </label>
            <input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              type="email"
              autoComplete="email"
              placeholder="tu@email.com"
              style={{
                width: "100%",
                height: 46,
                borderRadius: 12,
                border: "1px solid rgba(0,0,0,0.18)",
                padding: "0 12px",
                outline: "none",
                background: "#fff",
                color: "#111",
              }}
            />

            {!!error && (
              <div
                style={{
                  marginTop: 12,
                  padding: 10,
                  borderRadius: 12,
                  background: "#fee",
                  border: "1px solid #fcc",
                  color: "#7a0b0b",
                  whiteSpace: "pre-wrap",
                  fontWeight: 700,
                }}
              >
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              style={{
                marginTop: 14,
                width: "100%",
                height: 48,
                borderRadius: 14,
                border: "1px solid rgba(0,0,0,0.2)",
                background: loading ? "#222" : "#000",
                color: "#fff",
                fontWeight: 950,
                cursor: loading ? "not-allowed" : "pointer",
              }}
            >
              {loading ? "Enviando…" : "Enviar email de recuperación"}
            </button>

            <Link
              href="/login"
              style={{
                display: "block",
                marginTop: 14,
                textAlign: "center",
                fontWeight: 900,
                color: "#111",
                textDecoration: "underline",
              }}
            >
              Volver al inicio de sesión
            </Link>
          </form>
        )}

        <style jsx global>{`
          input::placeholder {
            color: rgba(0, 0, 0, 0.45);
          }
        `}</style>
      </div>
    </main>
  );
}
