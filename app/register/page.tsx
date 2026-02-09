"use client";

import { useState } from "react";
import { supabase } from "../../lib/supabaseClient";

export default function RegisterPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    if (password !== confirmPassword) {
      setError("Las contraseñas no coinciden");
      setLoading(false);
      return;
    }

    if (password.length < 6) {
      setError("La contraseña debe tener al menos 6 caracteres");
      setLoading(false);
      return;
    }

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
    });

    if (error) {
      setError(error.message);
      setLoading(false);
    } else {
      setSuccess(true);
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div style={{ 
        minHeight: "100vh", 
        display: "flex", 
        alignItems: "center", 
        justifyContent: "center",
        backgroundColor: "#f5f5f5"
      }}>
        <div style={{ 
          backgroundColor: "white", 
          padding: "32px", 
          borderRadius: "8px",
          boxShadow: "0 2px 8px rgba(0,0,0,0.1)",
          width: "100%",
          maxWidth: "400px",
          textAlign: "center"
        }}>
          <h2 style={{ fontSize: "20px", fontWeight: "700", marginBottom: "12px" }}>
            ✅ Registro exitoso
          </h2>
          <p style={{ opacity: 0.7, marginBottom: "24px" }}>
            Te hemos enviado un email de confirmación. 
            Por favor revisa tu bandeja de entrada y confirma tu cuenta.
          </p>
          <a 
            href="/login"
            style={{
              display: "inline-block",
              padding: "10px 20px",
              backgroundColor: "#000",
              color: "white",
              textDecoration: "none",
              borderRadius: "4px",
              fontSize: "14px",
              fontWeight: "600"
            }}
          >
            Ir al login
          </a>
        </div>
      </div>
    );
  }

  return (
    <div style={{ 
      minHeight: "100vh", 
      display: "flex", 
      alignItems: "center", 
      justifyContent: "center",
      backgroundColor: "#f5f5f5"
    }}>
      <div style={{ 
        backgroundColor: "white", 
        padding: "32px", 
        borderRadius: "8px",
        boxShadow: "0 2px 8px rgba(0,0,0,0.1)",
        width: "100%",
        maxWidth: "400px"
      }}>
        <h1 style={{ fontSize: "24px", fontWeight: "700", marginBottom: "8px" }}>
          ServiceControl
        </h1>
        <p style={{ opacity: 0.7, marginBottom: "24px" }}>
          Crea tu cuenta
        </p>

        <form onSubmit={handleRegister}>
          <div style={{ marginBottom: "16px" }}>
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
                padding: "8px 12px",
                border: "1px solid #ddd",
                borderRadius: "4px",
                fontSize: "14px"
              }}
            />
          </div>

          <div style={{ marginBottom: "16px" }}>
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
                padding: "8px 12px",
                border: "1px solid #ddd",
                borderRadius: "4px",
                fontSize: "14px"
              }}
            />
          </div>

          <div style={{ marginBottom: "16px" }}>
            <label style={{ display: "block", marginBottom: "4px", fontSize: "14px" }}>
              Confirmar contraseña
            </label>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              style={{
                width: "100%",
                padding: "8px 12px",
                border: "1px solid #ddd",
                borderRadius: "4px",
                fontSize: "14px"
              }}
            />
          </div>

          {error && (
            <div style={{ 
              padding: "12px", 
              backgroundColor: "#fee", 
              border: "1px solid #fcc",
              borderRadius: "4px",
              marginBottom: "16px",
              fontSize: "14px"
            }}>
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            style={{
              width: "100%",
              padding: "10px",
              backgroundColor: loading ? "#ccc" : "#000",
              color: "white",
              border: "none",
              borderRadius: "4px",
              fontSize: "14px",
              fontWeight: "600",
              cursor: loading ? "not-allowed" : "pointer"
            }}
          >
            {loading ? "Creando cuenta..." : "Crear cuenta"}
          </button>
        </form>

        <p style={{ marginTop: "16px", fontSize: "14px", textAlign: "center" }}>
          ¿Ya tienes cuenta?{" "}
          <a href="/login" style={{ color: "#000", fontWeight: "600" }}>
            Inicia sesión
          </a>
        </p>
      </div>
    </div>
  );
}