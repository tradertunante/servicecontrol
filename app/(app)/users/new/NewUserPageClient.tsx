"use client";

import { useMemo, useState } from "react";

import BackButton from "@/app/components/BackButton";
import { getAssignableRoles } from "@/lib/auth/permissions";
import { supabase } from "@/lib/supabaseClient";
import type { Profile, Role } from "@/lib/types";

export default function NewUserPageClient({
  initialProfile,
  hotelId,
}: {
  initialProfile: Profile;
  hotelId: string;
}) {
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<Role>("auditor");
  const [password, setPassword] = useState("");
  const [password2, setPassword2] = useState("");
  const [showPasswords, setShowPasswords] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  const assignableRoles = useMemo(
    () => getAssignableRoles(initialProfile.role).filter((candidate) => candidate !== "superadmin"),
    [initialProfile.role]
  );
  const effectiveRole = assignableRoles.includes(role) ? role : assignableRoles[0] ?? "auditor";
  const passwordStrongEnough = password.length >= 8;
  const passwordsMatch = password.length > 0 && password === password2;
  const canSubmit = !busy && email.trim().length > 0 && passwordStrongEnough && passwordsMatch;

  async function handleCreate() {
    setError(null);
    setOk(null);

    if (!email.trim()) return setError("El email es obligatorio.");
    if (!passwordStrongEnough) return setError("La contrasena debe tener al menos 8 caracteres.");
    if (!passwordsMatch) return setError("Las contrasenas no coinciden.");

    try {
      setBusy(true);
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData?.session?.access_token;
      if (!accessToken) {
        setError("Sesion invalida.");
        return;
      }

      const res = await fetch("/api/admin/users", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          full_name: fullName.trim() || null,
          email: email.trim().toLowerCase(),
          password,
          role: effectiveRole,
        }),
      });
      const text = await res.text();
      let payload: any = null;
      try {
        payload = JSON.parse(text);
      } catch {
        payload = { error: text?.slice(0, 200) || "Respuesta no-JSON." };
      }
      if (!res.ok) throw new Error(payload?.error ?? "No se pudo crear el usuario.");
      setOk("Usuario creado correctamente.");
      setFullName("");
      setEmail("");
      setPassword("");
      setPassword2("");
      setRole("auditor");
    } catch (e: any) {
      setError(e?.message ?? "Error creando el usuario.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ padding: 24 }}>
      <h1 style={{ fontSize: 44, fontWeight: 800, margin: 0 }}>Crear usuario</h1>
      <p style={{ marginTop: 10, opacity: 0.85 }}>
        {initialProfile.role}. El usuario se creara dentro del hotel activo {hotelId}.
      </p>
      {error ? <div style={{ color: "#b00020", fontWeight: 800, marginTop: 8 }}>{error}</div> : null}
      {ok ? <div style={{ color: "rgba(0,0,0,0.8)", fontWeight: 800, marginTop: 8 }}>{ok}</div> : null}
      <div style={{ display: "grid", gap: 12, marginTop: 16 }}>
        <input value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Nombre completo (opcional)" style={{ padding: 12 }} />
        <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email *" type="email" style={{ padding: 12 }} />
        <input value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Password * (minimo 8)" type={showPasswords ? "text" : "password"} style={{ padding: 12 }} />
        <input value={password2} onChange={(e) => setPassword2(e.target.value)} placeholder="Repetir password *" type={showPasswords ? "text" : "password"} style={{ padding: 12 }} />
        <button type="button" onClick={() => setShowPasswords((value) => !value)} style={{ padding: 12, fontWeight: 900 }}>
          {showPasswords ? "Ocultar contrasenas" : "Mostrar contrasenas"}
        </button>
        <select value={effectiveRole} onChange={(e) => setRole(e.target.value as Role)} style={{ padding: 12 }}>
          {assignableRoles.map((candidateRole) => (
            <option key={candidateRole} value={candidateRole}>
              {candidateRole}
            </option>
          ))}
        </select>
        <button onClick={handleCreate} disabled={!canSubmit} style={{ padding: 14, fontWeight: 900, opacity: canSubmit ? 1 : 0.5, cursor: canSubmit ? "pointer" : "not-allowed" }}>
          {busy ? "Creando..." : "Crear usuario"}
        </button>
        <BackButton />
      </div>
    </div>
  );
}
