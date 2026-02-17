"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useRouter } from "next/navigation";

type Profile = {
  role: "superadmin" | "admin" | "manager" | "auditor";
  hotel_id: string | null;
  active: boolean;
};

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

    try {
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (signInError) {
        setError(signInError.message);
        return;
      }

      // ✅ Espera a que la sesión esté disponible
      const { data: sessData, error: sessErr } = await supabase.auth.getSession();
      const session = sessData?.session;

      if (sessErr || !session) {
        setError(
          "Login OK, pero no se pudo leer la sesión. Recarga la página e inténtalo otra vez."
        );
        return;
      }

      // ✅ Lee el perfil para decidir ruta
      const { data: profile, error: profErr } = await supabase
        .from("profiles")
        .select("role, hotel_id, active")
        .eq("id", session.user.id)
        .single<Profile>();

      if (profErr || !profile) {
        // Fallback seguro (evita quedarte bloqueada)
        router.replace("/dashboard");
        return;
      }

      if (!profile.active) {
        setError("Tu usuario está inactivo. Contacta con un administrador.");
        await supabase.auth.signOut();
        return;
      }

      if (profile.role === "superadmin") {
        router.replace("/superadmin/hotels");
        return;
      }

      router.replace("/dashboard");
    } catch (err: any) {
      setError(err?.message ?? "Error inesperado al iniciar sesión.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "#f5f5f5",
        padding: "24px",
      }}
    >
      <div
        style={{
          backgroundColor: "white",
          padding: "22px",
          borderRadius: "10px",
          boxShadow: "0 2px 10px rgba(0,0,0,0.10)",
          width: "min(420px, 100%)",
        }}
      >
        <h1 style={{ fontSize: "22px", fontWeight: "800", marginBottom: "6px" }}>
          ServiceControl
        </h1>
        <p style={{ opacity: 0.7, marginBottom: "18px" }}>Inicia sesión en tu cuenta</p>

        <form onSubmit={handleLogin}>
          <div style={{ marginBottom: "12px" }}>
            <label style={{ display: "block", marginBottom: "4px", fontSize: "14px" }}>
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              style={{
                width: "100%",
                padding: "10px 12px",
                border: "1px solid #ddd",
                borderRadius: "8px",
                fontSize: "14px",
              }}
            />
          </div>

          <div style={{ marginBottom: "12px" }}>
            <label style={{ display: "block", marginBottom: "4px", fontSize: "14px" }}>
              Contraseña
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              style={{
                width: "100%",
                padding: "10px 12px",
                border: "1px solid #ddd",
                borderRadius: "8px",
                fontSize: "14px",
              }}
            />
          </div>

          {error && (
            <div
              style={{
                padding: "10px",
                backgroundColor: "#fee",
                border: "1px solid #fcc",
                borderRadius: "8px",
                marginBottom: "12px",
                fontSize: "14px",
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
              padding: "12px",
              backgroundColor: loading ? "#ccc" : "#000",
              color: "white",
              border: "none",
              borderRadius: "10px",
              fontSize: "14px",
              fontWeight: "800",
              cursor: loading ? "not-allowed" : "pointer",
            }}
          >
            {loading ? "Iniciando sesión..." : "Iniciar sesión"}
          </button>
        </form>
      </div>
    </div>
  );
}
