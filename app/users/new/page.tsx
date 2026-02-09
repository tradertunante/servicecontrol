"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import BackButton from "@/app/components/BackButton";

type Role = "admin" | "manager" | "auditor";

type Profile = {
  id: string;
  hotel_id: string;
  role: Role;
  active: boolean;
  full_name?: string | null;
};

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

  const canSubmit =
    !busy &&
    !loadingProfile &&
    !!profile &&
    email.trim().length > 0 &&
    passwordStrongEnough &&
    passwordsMatch;

  useEffect(() => {
    let mounted = true;

    async function loadProfile() {
      try {
        setLoadingProfile(true);
        setError(null);

        const { data: authData, error: authErr } = await supabase.auth.getUser();
        if (authErr || !authData?.user) {
          router.replace("/login");
          return;
        }

        const { data: prof, error: profErr } = await supabase
          .from("profiles")
          .select("id, hotel_id, role, active, full_name")
          .eq("id", authData.user.id)
          .single();

        if (!mounted) return;

        if (profErr || !prof) throw profErr;

        if (!prof.active || prof.role !== "admin") {
          router.replace("/");
          return;
        }

        setProfile(prof as Profile);
      } catch (e: any) {
        if (!mounted) return;
        setError(e?.message ?? "No se pudo cargar el perfil.");
      } finally {
        if (!mounted) return;
        setLoadingProfile(false);
      }
    }

    loadProfile();
    return () => {
      mounted = false;
    };
  }, [router]);

  async function handleCreate() {
    setError(null);
    setOk(null);

    if (!email.trim()) return setError("El email es obligatorio.");
    if (!passwordStrongEnough) return setError("La contraseña debe tener al menos 8 caracteres.");
    if (!passwordsMatch) return setError("Las contraseñas no coinciden.");

    try {
      setBusy(true);

      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData?.session?.access_token;

      if (!accessToken) {
        setError("Sesión inválida. Vuelve a iniciar sesión.");
        return;
      }

      const res = await fetch("/api/admin/create-user", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          full_name: fullName.trim() || null,
          email: email.trim().toLowerCase(),
          password,
          role,
        }),
      });

      // 🔥 Manejo robusto: si devuelve HTML, lo mostramos como error legible
      const text = await res.text();
      let payload: any = null;
      try {
        payload = JSON.parse(text);
      } catch {
        payload = { error: text?.slice(0, 200) || "Respuesta no-JSON del servidor." };
      }

      if (!res.ok) {
        throw new Error(payload?.error ?? "No se pudo crear el usuario.");
      }

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
        Solo admin. El usuario se creará en el mismo hotel.
      </p>

      {error && (
        <div style={{ color: "#b00020", fontWeight: 800, marginTop: 8 }}>
          {error}
        </div>
      )}
      {ok && (
        <div style={{ color: "rgba(0,0,0,0.8)", fontWeight: 800, marginTop: 8 }}>
          ✅ {ok}
        </div>
      )}

      <div style={{ display: "grid", gap: 12, marginTop: 16 }}>
        <input
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
          placeholder="Nombre completo (opcional)"
          style={{ padding: 12 }}
        />

        <input
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Email *"
          type="email"
          style={{ padding: 12 }}
        />

        <input
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Password * (mínimo 8)"
          type={showPasswords ? "text" : "password"}
          style={{ padding: 12 }}
        />

        <input
          value={password2}
          onChange={(e) => setPassword2(e.target.value)}
          placeholder="Repetir password *"
          type={showPasswords ? "text" : "password"}
          style={{ padding: 12 }}
        />

        <button
          type="button"
          onClick={() => setShowPasswords((v) => !v)}
          style={{ padding: 12, fontWeight: 900 }}
        >
          {showPasswords ? "Ocultar contraseñas" : "Mostrar contraseñas"}
        </button>

        {!passwordStrongEnough && password.length > 0 && (
          <div style={{ color: "#b00020", fontWeight: 800 }}>
            La contraseña debe tener al menos 8 caracteres.
          </div>
        )}

        {password2.length > 0 && !passwordsMatch && (
          <div style={{ color: "#b00020", fontWeight: 800 }}>
            Las contraseñas no coinciden.
          </div>
        )}

        <select
          value={role}
          onChange={(e) => setRole(e.target.value as Role)}
          style={{ padding: 12 }}
        >
          <option value="auditor">auditor</option>
          <option value="manager">manager</option>
          <option value="admin">admin</option>
        </select>

        <button
          onClick={handleCreate}
          disabled={!canSubmit}
          style={{
            padding: 14,
            fontWeight: 900,
            opacity: canSubmit ? 1 : 0.5,
            cursor: canSubmit ? "pointer" : "not-allowed",
          }}
        >
          {busy ? "Creando..." : "Crear usuario"}
        </button>

        <BackButton />
      </div>
    </div>
  );
}
