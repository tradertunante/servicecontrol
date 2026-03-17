"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getClientProfile } from "@/lib/auth/clientProfile";
import { supabase } from "@/lib/supabaseClient";
import { fetchActiveHotel } from "@/lib/auth/activeHotelClient";
import BackButton from "@/app/components/BackButton";
import { canManageUsers, getAssignableRoles } from "@/lib/auth/permissions";
import type { Role, Profile } from "@/lib/types";

export default function NewUserPage() {
  const router = useRouter();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loadingProfile, setLoadingProfile] = useState(true);
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<Role>("auditor");
  const [password, setPassword] = useState("");
  const [password2, setPassword2] = useState("");
  const [showPasswords, setShowPasswords] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  const passwordStrongEnough = password.length >= 8;
  const passwordsMatch = password.length > 0 && password === password2;
  const canSubmit = !busy && !loadingProfile && !!profile && email.trim().length > 0 && passwordStrongEnough && passwordsMatch;
  const assignableRoles = getAssignableRoles(profile?.role).filter((candidate) => candidate !== "superadmin");

  useEffect(() => {
    let mounted = true;
    async function loadProfile() {
      try {
        setLoadingProfile(true); setError(null);
        const prof = await getClientProfile();
        if (!mounted) return;
        if (!prof) throw new Error("No se pudo cargar el perfil.");
        if (!canManageUsers(prof.role)) throw new Error("No tienes permisos para crear usuarios.");
        setProfile(prof as Profile);
      } catch (e: any) { if (!mounted) return; setError(e?.message ?? "No se pudo cargar el perfil."); }
      finally { if (!mounted) return; setLoadingProfile(false); }
    }
    loadProfile();
    return () => { mounted = false; };
  }, []);

  useEffect(() => {
    if (assignableRoles.length === 0) return;
    if (!assignableRoles.includes(role)) {
      setRole(assignableRoles[0]);
    }
  }, [assignableRoles, role]);

  async function handleCreate() {
    setError(null); setOk(null);
    if (!email.trim()) return setError("El email es obligatorio.");
    if (!passwordStrongEnough) return setError("La contraseña debe tener al menos 8 caracteres.");
    if (!passwordsMatch) return setError("Las contraseñas no coinciden.");
    try {
      setBusy(true);
      const hotelId =
        profile?.role === "superadmin"
          ? (await fetchActiveHotel()).hotel_id
          : profile?.hotel_id ?? null;

      if (!hotelId) {
        throw new Error("Selecciona un hotel antes de crear usuarios.");
      }

      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData?.session?.access_token;
      if (!accessToken) { setError("Sesión inválida."); return; }
      const res = await fetch("/api/admin/create-user", { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` }, body: JSON.stringify({ full_name: fullName.trim() || null, email: email.trim().toLowerCase(), password, role }) });
      const text = await res.text();
      let payload: any = null;
      try { payload = JSON.parse(text); } catch { payload = { error: text?.slice(0, 200) || "Respuesta no-JSON." }; }
      if (!res.ok) throw new Error(payload?.error ?? "No se pudo crear el usuario.");
      setOk("Usuario creado correctamente.");
      setFullName(""); setEmail(""); setPassword(""); setPassword2(""); setRole("auditor");
    } catch (e: any) { setError(e?.message ?? "Error creando el usuario."); }
    finally { setBusy(false); }
  }

  return (
    <div style={{ padding: 24 }}>
      <h1 style={{ fontSize: 44, fontWeight: 800, margin: 0 }}>Crear usuario</h1>
      <p style={{ marginTop: 10, opacity: 0.85 }}>Admin / Superadmin. El usuario se creará dentro del hotel activo.</p>
      {error && <div style={{ color: "#b00020", fontWeight: 800, marginTop: 8 }}>{error}</div>}
      {ok && <div style={{ color: "rgba(0,0,0,0.8)", fontWeight: 800, marginTop: 8 }}>✅ {ok}</div>}
      <div style={{ display: "grid", gap: 12, marginTop: 16 }}>
        <input value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Nombre completo (opcional)" style={{ padding: 12 }} />
        <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email *" type="email" style={{ padding: 12 }} />
        <input value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Password * (mínimo 8)" type={showPasswords ? "text" : "password"} style={{ padding: 12 }} />
        <input value={password2} onChange={(e) => setPassword2(e.target.value)} placeholder="Repetir password *" type={showPasswords ? "text" : "password"} style={{ padding: 12 }} />
        <button type="button" onClick={() => setShowPasswords((v) => !v)} style={{ padding: 12, fontWeight: 900 }}>{showPasswords ? "Ocultar contraseñas" : "Mostrar contraseñas"}</button>
        {!passwordStrongEnough && password.length > 0 && <div style={{ color: "#b00020", fontWeight: 800 }}>La contraseña debe tener al menos 8 caracteres.</div>}
        {password2.length > 0 && !passwordsMatch && <div style={{ color: "#b00020", fontWeight: 800 }}>Las contraseñas no coinciden.</div>}
        <select value={role} onChange={(e) => setRole(e.target.value as Role)} style={{ padding: 12 }}>
          {assignableRoles.map((candidateRole) => (
            <option key={candidateRole} value={candidateRole}>
              {candidateRole}
            </option>
          ))}
        </select>
        {role === "quality" && (
          <div style={{ padding: "8px 12px", borderRadius: 10, background: "rgba(147,51,234,0.06)", border: "1px solid rgba(147,51,234,0.2)", fontSize: 13, fontWeight: 700, color: "rgb(126,34,206)" }}>
            Sus auditorías se registrarán como canal <strong>Quality</strong>, separadas de las auditorías internas del equipo.
          </div>
        )}
        <button onClick={handleCreate} disabled={!canSubmit} style={{ padding: 14, fontWeight: 900, opacity: canSubmit ? 1 : 0.5, cursor: canSubmit ? "pointer" : "not-allowed" }}>{busy ? "Creando..." : "Crear usuario"}</button>
        <BackButton />
      </div>
    </div>
  );
}
