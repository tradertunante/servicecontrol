"use client";

import { useEffect, useMemo, useState } from "react";

import BackButton from "@/app/components/BackButton";
import { getAssignableRoles } from "@/lib/auth/permissions";
import { supabase } from "@/lib/supabaseClient";
import type { Profile, Role } from "@/lib/types";

type AreaRow = {
  id: string;
  name: string;
  type: string | null;
};

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
  const [setPasswordManually, setSetPasswordManually] = useState(false);
  const [password, setPassword] = useState("");
  const [password2, setPassword2] = useState("");
  const [showPasswords, setShowPasswords] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const [areas, setAreas] = useState<AreaRow[]>([]);
  const [selectedAreaIds, setSelectedAreaIds] = useState<string[]>([]);

  useEffect(() => {
    supabase
      .from("areas")
      .select("id,name,type")
      .eq("hotel_id", hotelId)
      .eq("active", true)
      .order("name", { ascending: true })
      .then(({ data }) => setAreas((data ?? []) as AreaRow[]));
  }, [hotelId]);

  function toggleArea(areaId: string) {
    setSelectedAreaIds((prev) =>
      prev.includes(areaId) ? prev.filter((value) => value !== areaId) : [...prev, areaId]
    );
  }

  const assignableRoles = useMemo(
    () => getAssignableRoles(initialProfile.role).filter((candidate) => candidate !== "superadmin"),
    [initialProfile.role]
  );
  const effectiveRole = (assignableRoles as string[]).includes(role) ? role : assignableRoles[0] ?? "auditor";
  const passwordStrongEnough = password.length >= 8;
  const passwordsMatch = password.length > 0 && password === password2;
  const canSubmit =
    !busy &&
    email.trim().length > 0 &&
    (!setPasswordManually || (passwordStrongEnough && passwordsMatch));

  async function handleCreate() {
    setError(null);
    setOk(null);

    if (!email.trim()) return setError("El email es obligatorio.");
    if (setPasswordManually && !passwordStrongEnough) return setError("La contrasena debe tener al menos 8 caracteres.");
    if (setPasswordManually && !passwordsMatch) return setError("Las contrasenas no coinciden.");

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
          ...(setPasswordManually ? { password } : {}),
          role: effectiveRole,
        }),
      });
      const text = await res.text();
      let payload: { ok?: boolean; user_id?: string; error?: string } | null = null;
      try {
        payload = JSON.parse(text) as { ok?: boolean; user_id?: string; error?: string };
      } catch {
        payload = { error: text?.slice(0, 200) || "Respuesta no-JSON." };
      }
      if (!res.ok) throw new Error(payload?.error ?? "No se pudo crear el usuario.");

      if (selectedAreaIds.length > 0 && payload?.user_id) {
        const areaRes = await fetch("/api/admin/user-area-access/set", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${accessToken}`,
          },
          body: JSON.stringify({ user_id: payload.user_id, area_ids: selectedAreaIds }),
        });
        if (!areaRes.ok) {
          const areaPayload = await areaRes.json().catch(() => ({})) as { error?: string };
          throw new Error(areaPayload?.error ?? "Usuario creado, pero no se pudieron asignar las areas.");
        }
      }

      setOk(
        setPasswordManually
          ? "Usuario creado correctamente."
          : "Usuario creado. Se ha enviado un email con el link para que establezca su contraseña."
      );
      setFullName("");
      setEmail("");
      setPassword("");
      setPassword2("");
      setSetPasswordManually(false);
      setRole("auditor");
      setSelectedAreaIds([]);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Error creando el usuario.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="p-6">
      <h1 className="text-[44px] font-[800] m-0">Crear usuario</h1>
      <p className="mt-2.5 opacity-85">
        {initialProfile.role}. El usuario se creara dentro del hotel activo {hotelId}.
      </p>
      {error ? <div className="text-[#b00020] font-[800] mt-2">{error}</div> : null}
      {ok ? <div className="text-black/80 font-[800] mt-2">{ok}</div> : null}
      <div className="grid gap-3 mt-4">
        <input value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Nombre completo (opcional)" className="p-3" />
        <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email *" type="email" className="p-3" />

        <label className="flex items-center gap-2.5 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={setPasswordManually}
            onChange={(e) => {
              setSetPasswordManually(e.target.checked);
              setPassword("");
              setPassword2("");
            }}
          />
          <span className="font-[900]">Asignar contraseña ahora</span>
          <span className="opacity-60 font-normal text-sm">(si no, el usuario recibirá un link para crearla)</span>
        </label>

        {setPasswordManually && (
          <>
            <input value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Password * (minimo 8)" type={showPasswords ? "text" : "password"} className="p-3" />
            <input value={password2} onChange={(e) => setPassword2(e.target.value)} placeholder="Repetir password *" type={showPasswords ? "text" : "password"} className="p-3" />
            <button type="button" onClick={() => setShowPasswords((value) => !value)} className="p-3 font-[900]">
              {showPasswords ? "Ocultar contrasenas" : "Mostrar contrasenas"}
            </button>
          </>
        )}
        <select value={effectiveRole} onChange={(e) => setRole(e.target.value as Role)} className="p-3">
          {assignableRoles.map((candidateRole) => (
            <option key={candidateRole} value={candidateRole}>
              {candidateRole}
            </option>
          ))}
        </select>
        {areas.length > 0 && (
          <div className="grid gap-2">
            <div className="font-[900]">Areas habilitadas</div>
            {areas.map((area) => (
              <label key={area.id} className="flex gap-2.5 items-center p-3 rounded-xl border border-[#ddd] cursor-pointer">
                <input type="checkbox" checked={selectedAreaIds.includes(area.id)} onChange={() => toggleArea(area.id)} />
                <span className="font-[800]">{area.name}</span>
                {area.type ? <span className="opacity-60">{area.type}</span> : null}
              </label>
            ))}
          </div>
        )}
        <button
          onClick={handleCreate}
          disabled={!canSubmit}
          className="p-[14px] font-[900]"
          style={{ opacity: canSubmit ? 1 : 0.5, cursor: canSubmit ? "pointer" : "not-allowed" }}
        >
          {busy ? "Creando..." : "Crear usuario"}
        </button>
        <BackButton />
      </div>
    </div>
  );
}
