"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import BackButton from "@/app/components/BackButton";
import { useToast } from "@/app/providers/ToastProvider";
import { getAssignableRoles, ROLE_LABELS } from "@/lib/auth/permissions";
import { supabase } from "@/lib/supabaseClient";
import type { Profile, Role } from "@/lib/types";

type AreaRow = { id: string; name: string; type: string | null };

export default function NewUserPageClient({
  initialProfile,
  hotelId,
}: {
  initialProfile: Profile;
  hotelId: string;
}) {
  const router = useRouter();
  const toast = useToast();

  const [fullName, setFullName]                   = useState("");
  const [email, setEmail]                         = useState("");
  const [role, setRole]                           = useState<Role>("auditor");
  const [setPasswordManually, setSetPasswordManually] = useState(false);
  const [password, setPassword]                   = useState("");
  const [password2, setPassword2]                 = useState("");
  const [showPasswords, setShowPasswords]         = useState(false);
  const [busy, setBusy]                           = useState(false);
  const [areas, setAreas]                         = useState<AreaRow[]>([]);
  const [selectedAreaIds, setSelectedAreaIds]     = useState<string[]>([]);

  useEffect(() => {
    supabase
      .from("areas")
      .select("id,name,type")
      .eq("hotel_id", hotelId)
      .eq("active", true)
      .order("name")
      .then(({ data }) => setAreas((data ?? []) as AreaRow[]));
  }, [hotelId]);

  const assignableRoles = useMemo(
    () => getAssignableRoles(initialProfile.role).filter((r) => r !== "superadmin"),
    [initialProfile.role]
  );
  const effectiveRole = (assignableRoles as string[]).includes(role)
    ? role
    : (assignableRoles[0] ?? "auditor");

  const passwordOk    = password.length >= 8;
  const passwordMatch = password.length > 0 && password === password2;
  const canSubmit =
    !busy &&
    email.trim().length > 0 &&
    (!setPasswordManually || (passwordOk && passwordMatch));

  async function handleCreate() {
    if (!email.trim()) { toast.error("El email es obligatorio."); return; }
    if (setPasswordManually && !passwordOk) { toast.error("La contraseña debe tener al menos 8 caracteres."); return; }
    if (setPasswordManually && !passwordMatch) { toast.error("Las contraseñas no coinciden."); return; }

    setBusy(true);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData?.session?.access_token;
      if (!token) throw new Error("Sesión inválida.");

      const res = await fetch("/api/admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          full_name: fullName.trim() || null,
          email: email.trim().toLowerCase(),
          role: effectiveRole,
          ...(setPasswordManually ? { password } : {}),
        }),
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(payload?.error ?? "No se pudo crear el usuario.");

      if (selectedAreaIds.length > 0 && payload?.user_id) {
        const areaRes = await fetch("/api/admin/user-area-access/set", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify({ user_id: payload.user_id, area_ids: selectedAreaIds }),
        });
        if (!areaRes.ok) {
          const ap = await areaRes.json().catch(() => ({}));
          throw new Error(ap?.error ?? "Usuario creado, pero error asignando áreas.");
        }
      }

      toast.success(
        setPasswordManually
          ? "Usuario creado correctamente."
          : "Usuario creado. Se ha enviado un email con el enlace de activación."
      );
      router.push("/users");
    } catch (e: any) {
      toast.error(e?.message ?? "Error creando el usuario.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="p-4 sm:p-6 max-w-xl">
      <BackButton fallback="/users" />

      <h1 className="text-[clamp(28px,8vw,48px)] font-[950] mt-1 mb-6">Crear usuario</h1>

      <div className="grid gap-4">
        {/* Datos básicos */}
        <div className="rounded-[18px] border border-black/[0.08] bg-white/75 p-5 grid gap-4">
          <div className="font-[950] text-sm opacity-60 uppercase tracking-wider">Datos básicos</div>

          <label className="grid gap-1.5">
            <span className="font-[950] text-sm">Nombre completo</span>
            <input
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="Nombre y apellidos"
              className="h-11 px-3 rounded-xl border border-black/20 font-[800] text-sm bg-white"
            />
          </label>

          <label className="grid gap-1.5">
            <span className="font-[950] text-sm">Email <span className="text-[crimson]">*</span></span>
            <input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="usuario@hotel.com"
              type="email"
              autoComplete="off"
              className="h-11 px-3 rounded-xl border border-black/20 font-[800] text-sm bg-white"
            />
          </label>

          <label className="grid gap-1.5">
            <span className="font-[950] text-sm">Rol</span>
            <select
              value={effectiveRole}
              onChange={(e) => setRole(e.target.value as Role)}
              className="h-11 px-3 rounded-xl border border-black/20 font-[950] text-sm bg-white cursor-pointer"
            >
              {assignableRoles.map((r) => (
                <option key={r} value={r}>{ROLE_LABELS[r] ?? r}</option>
              ))}
            </select>
          </label>
        </div>

        {/* Contraseña */}
        <div className="rounded-[18px] border border-black/[0.08] bg-white/75 p-5 grid gap-4">
          <div className="font-[950] text-sm opacity-60 uppercase tracking-wider">Acceso</div>

          <label className="flex items-start gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={setPasswordManually}
              onChange={(e) => {
                setSetPasswordManually(e.target.checked);
                setPassword("");
                setPassword2("");
              }}
              className="mt-0.5 cursor-pointer"
            />
            <div>
              <div className="font-[950] text-sm">Asignar contraseña ahora</div>
              <div className="text-xs opacity-60 font-[800] mt-0.5">
                Si no, el usuario recibirá un email con un enlace para crear su contraseña
              </div>
            </div>
          </label>

          {setPasswordManually && (
            <div className="grid gap-3">
              <label className="grid gap-1.5">
                <span className="font-[950] text-sm">Contraseña <span className="text-[crimson]">*</span></span>
                <input
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Mínimo 8 caracteres"
                  type={showPasswords ? "text" : "password"}
                  autoComplete="new-password"
                  className={`h-11 px-3 rounded-xl border font-[800] text-sm bg-white ${password.length > 0 && !passwordOk ? "border-[crimson]" : "border-black/20"}`}
                />
              </label>
              <label className="grid gap-1.5">
                <span className="font-[950] text-sm">Repetir contraseña <span className="text-[crimson]">*</span></span>
                <input
                  value={password2}
                  onChange={(e) => setPassword2(e.target.value)}
                  placeholder="Repite la contraseña"
                  type={showPasswords ? "text" : "password"}
                  autoComplete="new-password"
                  className={`h-11 px-3 rounded-xl border font-[800] text-sm bg-white ${password2.length > 0 && !passwordMatch ? "border-[crimson]" : "border-black/20"}`}
                />
              </label>
              <button
                type="button"
                onClick={() => setShowPasswords((v) => !v)}
                className="text-sm font-[950] opacity-60 cursor-pointer text-left"
              >
                {showPasswords ? "Ocultar contraseñas" : "Mostrar contraseñas"}
              </button>
            </div>
          )}
        </div>

        {/* Áreas */}
        {areas.length > 0 && (
          <div className="rounded-[18px] border border-black/[0.08] bg-white/75 p-5 grid gap-3">
            <div className="font-[950] text-sm opacity-60 uppercase tracking-wider">Áreas de acceso</div>
            <div className="grid gap-2">
              {areas.map((area) => (
                <label
                  key={area.id}
                  className="flex items-center gap-2.5 p-3 rounded-xl border border-black/[0.08] cursor-pointer hover:bg-black/[0.02]"
                >
                  <input
                    type="checkbox"
                    checked={selectedAreaIds.includes(area.id)}
                    onChange={() =>
                      setSelectedAreaIds((prev) =>
                        prev.includes(area.id)
                          ? prev.filter((id) => id !== area.id)
                          : [...prev, area.id]
                      )
                    }
                    className="cursor-pointer"
                  />
                  <span className="font-[900] text-sm">{area.name}</span>
                  {area.type && <span className="opacity-50 text-xs">{area.type}</span>}
                </label>
              ))}
            </div>
          </div>
        )}

        {/* Acciones */}
        <div className="flex gap-3">
          <button
            onClick={handleCreate}
            disabled={!canSubmit}
            className="flex-1 h-12 rounded-xl bg-black text-white font-[950] cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {busy ? "Creando..." : "Crear usuario"}
          </button>
          <button
            onClick={() => router.push("/users")}
            className="h-12 px-6 rounded-xl border border-black/20 bg-white font-[950] cursor-pointer"
          >
            Cancelar
          </button>
        </div>
      </div>
    </main>
  );
}