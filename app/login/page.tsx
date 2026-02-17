"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

export default function LoginPage() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>("");

  async function waitForSession(maxMs = 1500) {
    const start = Date.now();
    while (Date.now() - start < maxMs) {
      const { data } = await supabase.auth.getSession();
      if (data.session) return data.session;
      await new Promise((r) => setTimeout(r, 120));
    }
    return null;
  }

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });

      if (error) throw error;

      // ✅ si por timing la session aún no está, esperamos un poquito
      const session = data.session ?? (await waitForSession());
      if (!session) throw new Error("No se pudo establecer la sesión. Intenta de nuevo.");

      // ✅ La home (app/page.tsx) redirige según rol
      router.replace("/");
      router.refresh();
    } catch (e: any) {
      setError(e?.message ?? "No se pudo iniciar sesión.");
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
          Inicia sesión para continuar
        </p>

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
          <label style={{ display: "block", fontWeight: 900, marginBottom: 6, color: "#111" }}>
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

          <div style={{ height: 14 }} />

          <label style={{ display: "block", fontWeight: 900, marginBottom: 6, color: "#111" }}>
            Contraseña
          </label>
          <input
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            type="password"
            autoComplete="current-password"
            placeholder="••••••••"
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
            {loading ? "Entrando…" : "Iniciar sesión"}
          </button>
        </form>

        <style jsx global>{`
          input::placeholder {
            color: rgba(0, 0, 0, 0.45);
          }
        `}</style>
      </div>
    </main>
  );
}
