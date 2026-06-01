"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import { useToast } from "@/app/providers/ToastProvider";
import { getAssignableRoles, ROLE_LABELS } from "@/lib/auth/permissions";
import { supabase } from "@/lib/supabaseClient";
import type { Profile, Role } from "@/lib/types";

type UserProfile = {
  id: string;
  hotel_id: string;
  role: Role;
  active: boolean;
  full_name: string | null;
  email?: string | null;
};

type AreaRow = { id: string; name: string; type: string | null; active: boolean };

export default function UserDetailPageClient({
  userId,
  initialProfile,
  scopedHotelId,
}: {
  userId: string;
  initialProfile: Profile;
  scopedHotelId: string;
}) {
  const router = useRouter();
  const toast  = useToast();

  const [loading, setLoading]   = useState(true);
  const [userRow, setUserRow]   = useState<UserProfile | null>(null);
  const [fullName, setFullName] = useState("");
  const [role, setRole]         = useState<Role>("auditor");
  const [active, setActive]     = useState(true);
  const [saving, setSaving]     = useState(false);

  const [areasLoading, setAreasLoading]     = useState(true);
  const [areas, setAreas]                   = useState<AreaRow[]>([]);
  const [selectedAreaIds, setSelectedAreaIds] = useState<string[]>([]);

  const [newPassword, setNewPassword]       = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPasswords, setShowPasswords]   = useState(false);

  const [showDelete, setShowDelete]         = useState(false);
  const [deleteConfirm, setDeleteConfirm]   = useState("");
  const [deleting, setDeleting]             = useState(false);

  const assignableRoles = useMemo(
    () => getAssignableRoles(initialProfile.role).filter((r) => r !== "superadmin"),
    [initialProfile.role]
  );
  const availableRoleOptions = useMemo(() => {
    if (!userRow) return assignableRoles;
    return (assignableRoles as Role[]).includes(userRow.role)
      ? assignableRoles
      : [userRow.role, ...assignableRoles];
  }, [assignableRoles, userRow]);

  async function getToken() {
    const { data } = await supabase.auth.getSession();
    const t = data?.session?.access_token;
    if (!t) throw new Error("Sesión inválida.");
    return t;
  }

  useEffect(() => {
    const init = async () => {
      setLoading(true);
      try {
        const token = await getToken();
        const res = await fetch(`/api/admin/users/${userId}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const payload = await res.json().catch(() => ({}));
        if (!res.ok || !payload?.user) {
          toast.error(payload?.error ?? "No se encontró el usuario.");
          router.push("/users");
          return;
        }
        const target = payload.user as UserProfile;
        if (target.hotel_id !== scopedHotelId) { router.push("/users"); return; }

        setUserRow(target);
        setFullName(target.full_name ?? "");
        setRole(target.role);
        setActive(target.active);

        setAreasLoading(true);
        const [{ data: areasData }, { data: accessData }] = await Promise.all([
          supabase.from("areas").select("id,name,type,active").eq("hotel_id", scopedHotelId).eq("active", true).order("name"),
          supabase.from("user_area_access").select("area_id").eq("user_id", target.id).eq("hotel_id", scopedHotelId),
        ]);
        setAreas((areasData ?? []) as AreaRow[]);
        setSelectedAreaIds((accessData ?? []).map((r: { area_id: string }) => r.area_id));
        setAreasLoading(false);
      } catch (e: any) {
        toast.error(e?.message ?? "Error cargando usuario.");
      } finally {
        setLoading(false);
      }
    };
    void init();
  }, [userId, scopedHotelId, router]);

  async function save() {
    if (!userRow) return;
    if (userRow.id === initialProfile.id && active === false) {
      toast.error("No puedes desactivarte a ti mismo.");
      return;
    }
    if (newPassword && newPassword.length < 8) { toast.error("La contraseña debe tener al menos 8 caracteres."); return; }
    if (newPassword && newPassword !== confirmPassword) { toast.error("Las contraseñas no coinciden."); return; }

    setSaving(true);
    try {
      const token = await getToken();
      const res = await fetch(`/api/admin/users/${userRow.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          full_name: fullName.trim() || null,
          role,
          active,
          ...(newPassword ? { password: newPassword } : {}),
        }),
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(payload?.error ?? "No se pudo guardar.");

      const areaRes = await fetch("/api/admin/user-area-access/set", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ user_id: userRow.id, area_ids: selectedAreaIds }),
      });
      const areaPayload = await areaRes.json().catch(() => ({}));
      if (!areaRes.ok) throw new Error(areaPayload?.error ?? "No se pudieron guardar las áreas.");

      setNewPassword("");
      setConfirmPassword("");
      toast.success("Cambios guardados.");
    } catch (e: any) {
      toast.error(e?.message ?? "Error guardando.");
    } finally {
      setSaving(false);
    }
  }

  async function deleteUser() {
    if (!userRow) return;
    if (userRow.id === initialProfile.id) { toast.error("No puedes borrarte a ti mismo."); return; }
    if (deleteConfirm.trim().toUpperCase() !== "BORRAR") { toast.error("Escribe BORRAR para confirmar."); return; }

    setDeleting(true);
    try {
      const token = await getToken();
      const res = await fetch(`/api/admin/users/${userRow.id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(payload?.error ?? "No se pudo borrar.");
      toast.success("Usuario eliminado.");
      router.push("/users");
    } catch (e: any) {
      toast.error(e?.message ?? "Error borrando.");
    } finally {
      setDeleting(false);
      setShowDelete(false);
      setDeleteConfirm("");
    }
  }

  if (loading) {
    return (
      <main className="p-6">
        <div className="opacity-70 font-[800]">Cargando...</div>
      </main>
    );
  }

  if (!userRow) return null;

  const isSelf = userRow.id === initialProfile.id;

  return (
    <main className="p-4 sm:p-6">
      {/* Header */}
      <button
        onClick={() => router.push("/users")}
        className="text-sm font-[950] opacity-60 hover:opacity-100 cursor-pointer mb-4"
      >
        ← Usuarios
      </button>

      <div className="flex justify-between items-start gap-3 flex-wrap mb-6">
        <div>
          <h1 className="text-[clamp(24px,6vw,48px)] font-[950] leading-tight">
            {userRow.full_name?.trim() || "Sin nombre"}
          </h1>
          <div className="text-sm opacity-60 font-[800] mt-1">{userRow.email ?? "—"}</div>
        </div>
        <div className="flex gap-2.5 flex-wrap items-center">
          <button
            onClick={save}
            disabled={saving}
            className="h-11 px-5 rounded-xl bg-black text-white font-[950] cursor-pointer disabled:opacity-50"
          >
            {saving ? "Guardando..." : "Guardar"}
          </button>
          <button
            onClick={() => setShowDelete((v) => !v)}
            className="h-11 px-4 rounded-xl border border-[rgba(220,20,60,0.5)] bg-[rgba(220,20,60,0.07)] text-[crimson] font-[950] cursor-pointer"
          >
            Borrar
          </button>
        </div>
      </div>

      {/* Delete confirmation */}
      {showDelete && (
        <div className="mb-5 p-4 rounded-[18px] border border-[rgba(220,20,60,0.3)] bg-[rgba(220,20,60,0.05)]">
          <div className="font-[950] text-[crimson] mb-2">Borrado permanente</div>
          <p className="text-sm opacity-80 mb-3">
            Esta acción no se puede deshacer. Escribe <strong>BORRAR</strong> para confirmar.
          </p>
          <div className="flex gap-2.5 flex-wrap">
            <input
              value={deleteConfirm}
              onChange={(e) => setDeleteConfirm(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") void deleteUser(); }}
              placeholder="Escribe BORRAR"
              className="h-11 px-3 rounded-xl border border-[rgba(220,20,60,0.4)] font-[800] text-sm flex-1 min-w-[160px]"
              autoFocus
            />
            <button
              onClick={() => void deleteUser()}
              disabled={deleting || deleteConfirm.trim().toUpperCase() !== "BORRAR"}
              className="h-11 px-5 rounded-xl bg-[crimson] text-white font-[950] cursor-pointer disabled:opacity-40"
            >
              {deleting ? "Borrando..." : "Confirmar"}
            </button>
            <button
              onClick={() => { setShowDelete(false); setDeleteConfirm(""); }}
              className="h-11 px-4 rounded-xl border border-black/20 bg-white font-[950] cursor-pointer"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}

      {/* Two-column layout */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_1fr] gap-4 items-start">

        {/* Left column */}
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
              <span className="font-[950] text-sm">Rol</span>
              <select
                value={role}
                onChange={(e) => setRole(e.target.value as Role)}
                className="h-11 px-3 rounded-xl border border-black/20 font-[950] text-sm bg-white cursor-pointer"
              >
                {availableRoleOptions.map((r) => (
                  <option key={r} value={r}>{ROLE_LABELS[r as Role] ?? r}</option>
                ))}
              </select>
            </label>

            <label className="flex items-center gap-2.5 cursor-pointer">
              <input
                type="checkbox"
                checked={active}
                onChange={(e) => setActive(e.target.checked)}
                disabled={isSelf}
                className="cursor-pointer disabled:cursor-default"
              />
              <span className="font-[950] text-sm">Usuario activo</span>
              {isSelf && <span className="text-xs opacity-50 font-[800]">(no puedes desactivarte)</span>}
            </label>
          </div>

          {/* Contraseña */}
          <div className="rounded-[18px] border border-black/[0.08] bg-white/75 p-5 grid gap-4">
            <div className="font-[950] text-sm opacity-60 uppercase tracking-wider">
              Cambiar contraseña
              <span className="ml-2 text-xs normal-case font-[800]">(vacío = sin cambios)</span>
            </div>

            <label className="grid gap-1.5">
              <span className="font-[950] text-sm">Nueva contraseña</span>
              <input
                type={showPasswords ? "text" : "password"}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Mínimo 8 caracteres"
                autoComplete="new-password"
                className="h-11 px-3 rounded-xl border border-black/20 font-[800] text-sm bg-white"
              />
            </label>

            <label className="grid gap-1.5">
              <span className="font-[950] text-sm">Confirmar contraseña</span>
              <input
                type={showPasswords ? "text" : "password"}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Repite la nueva contraseña"
                autoComplete="new-password"
                className={`h-11 px-3 rounded-xl border font-[800] text-sm bg-white ${confirmPassword.length > 0 && confirmPassword !== newPassword ? "border-[crimson]" : "border-black/20"}`}
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

          <button
            onClick={save}
            disabled={saving}
            className="h-12 rounded-xl bg-black text-white font-[950] cursor-pointer disabled:opacity-40"
          >
            {saving ? "Guardando..." : "Guardar cambios"}
          </button>
        </div>

        {/* Right column — Áreas */}
        <div className="rounded-[18px] border border-black/[0.08] bg-white/75 p-5 grid gap-3">
          <div className="font-[950] text-sm opacity-60 uppercase tracking-wider">Áreas de acceso</div>
          {areasLoading ? (
            <div className="text-sm opacity-60">Cargando áreas...</div>
          ) : areas.length === 0 ? (
            <div className="text-sm opacity-60">No hay áreas activas en este hotel.</div>
          ) : (
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
          )}
        </div>

      </div>
    </main>
  );
}