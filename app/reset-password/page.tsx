"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";

export default function ResetPasswordPage() {
  const router = useRouter();

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [sessionReady, setSessionReady] = useState(false);
  const [sessionError, setSessionError] = useState(false);

  // Supabase redirects here with #access_token=...&type=recovery
  // The client SDK auto-detects this via detectSessionInUrl: true
  // and fires a PASSWORD_RECOVERY event
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event) => {
        if (event === "PASSWORD_RECOVERY") {
          setSessionReady(true);
        }
      }
    );

    // Fallback: if the user already has a valid session (e.g. page refresh)
    const timeout = setTimeout(async () => {
      const { data } = await supabase.auth.getSession();
      if (data.session) {
        setSessionReady(true);
      } else {
        setSessionError(true);
      }
    }, 3000);

    return () => {
      subscription.unsubscribe();
      clearTimeout(timeout);
    };
  }, []);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

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

      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;

      setSuccess(true);

      // Redirect to login after 3 seconds
      setTimeout(() => {
        router.replace("/login");
      }, 3000);
    } catch (e: any) {
      setError(e?.message ?? "No se pudo actualizar la contraseña.");
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
          Establece tu nueva contraseña
        </p>

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
          {success ? (
            <>
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
                Contraseña actualizada correctamente. Redirigiendo al inicio de
                sesión...
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
                Ir al inicio de sesión
              </Link>
            </>
          ) : sessionError ? (
            <>
              <div
                style={{
                  padding: 14,
                  borderRadius: 12,
                  background: "#fee",
                  border: "1px solid #fcc",
                  color: "#7a0b0b",
                  fontWeight: 700,
                }}
              >
                El enlace de recuperación ha expirado o no es válido. Solicita
                uno nuevo.
              </div>
              <Link
                href="/forgot-password"
                style={{
                  display: "block",
                  marginTop: 16,
                  textAlign: "center",
                  fontWeight: 900,
                  color: "#111",
                  textDecoration: "underline",
                }}
              >
                Solicitar nuevo enlace
              </Link>
            </>
          ) : !sessionReady ? (
            <div
              style={{
                textAlign: "center",
                padding: 20,
                fontWeight: 700,
                opacity: 0.6,
              }}
            >
              Verificando enlace de recuperación...
            </div>
          ) : (
            <form onSubmit={onSubmit}>
              <label
                style={{
                  display: "block",
                  fontWeight: 900,
                  marginBottom: 6,
                  color: "#111",
                }}
              >
                Nueva contraseña
              </label>
              <input
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                type="password"
                autoComplete="new-password"
                placeholder="Mínimo 8 caracteres"
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

              <div style={{ height: 14 }} />

              <label
                style={{
                  display: "block",
                  fontWeight: 900,
                  marginBottom: 6,
                  color: "#111",
                }}
              >
                Confirmar contraseña
              </label>
              <input
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                type="password"
                autoComplete="new-password"
                placeholder="Repite la contraseña"
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
                {loading ? "Actualizando…" : "Actualizar contraseña"}
              </button>
            </form>
          )}
        </div>

        <style jsx global>{`
          input::placeholder {
            color: rgba(0, 0, 0, 0.45);
          }
        `}</style>
      </div>
    </main>
  );
}
