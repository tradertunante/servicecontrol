"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const { error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (signInError) {
      setError(signInError.message);
      setLoading(false);
      return;
    }

    router.replace("/dashboard");
    router.refresh();
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "grid",
        placeItems: "center",
        background: "linear-gradient(180deg, #f6f7f8 0%, #ffffff 100%)",
        padding: 24,
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: 420,
          background: "#fff",
          borderRadius: 14,
          border: "1px solid rgba(0,0,0,0.08)",
          boxShadow: "0 18px 50px rgba(0,0,0,0.08)",
          padding: 28,
        }}
      >
        <div style={{ marginBottom: 18 }}>
          <div style={{ fontSize: 26, fontWeight: 900, letterSpacing: -0.3 }}>ServiceControl</div>
          <div style={{ marginTop: 6, opacity: 0.65, fontSize: 14 }}>Inicia sesión en tu cuenta</div>
        </div>

        <form onSubmit={handleLogin}>
          <div style={{ marginBottom: 12 }}>
            <label style={{ display: "block", marginBottom: 6, fontSize: 13, fontWeight: 800, opacity: 0.8 }}>
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
              style={{
                width: "100%",
                padding: "12px 12px",
                border: "1px solid rgba(0,0,0,0.14)",
                borderRadius: 10,
                fontSize: 14,
                outline: "none",
              }}
            />
          </div>

          <div style={{ marginBottom: 14 }}>
            <label style={{ display: "block", marginBottom: 6, fontSize: 13, fontWeight: 800, opacity: 0.8 }}>
              Contraseña
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="current-password"
              style={{
                width: "100%",
                padding: "12px 12px",
                border: "1px solid rgba(0,0,0,0.14)",
                borderRadius: 10,
                fontSize: 14,
                outline: "none",
              }}
            />
          </div>

          {error && (
            <div
              style={{
                padding: 12,
                backgroundColor: "#fff1f1",
                border: "1px solid rgba(180, 0, 0, 0.25)",
                borderRadius: 10,
                marginBottom: 14,
                fontSize: 13,
                fontWeight: 700,
                color: "#8b0000",
                whiteSpace: "pre-wrap",
              }}
            >
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            style={{
              width: "100%",
              padding: "12px 14px",
              backgroundColor: loading ? "#bdbdbd" : "#000",
              color: "white",
              border: "none",
              borderRadius: 12,
              fontSize: 14,
              fontWeight: 900,
              cursor: loading ? "not-allowed" : "pointer",
            }}
          >
            {loading ? "Iniciando sesión..." : "Iniciar sesión"}
          </button>
        </form>

        <div style={{ marginTop: 16, fontSize: 13, textAlign: "center", opacity: 0.85 }}>
          ¿No tienes cuenta?{" "}
          <a href="/register" style={{ color: "#000", fontWeight: 900, textDecoration: "none" }}>
            Regístrate
          </a>
        </div>
      </div>
    </div>
  );
}


