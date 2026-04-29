"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

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

type AreaRow = {
  id: string;
  name: string;
  type: string | null;
  active: boolean;
};

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
  const [loading, setLoading] = useState(true);
  const [userRow, setUserRow] = useState<UserProfile | null>(null);
  const [fullName, setFullName] = useState("");
  const [role, setRole] = useState<Role>("auditor");
  const [active, setActive] = useState(true);
  const [areasLoading, setAreasLoading] = useState(true);
  const [areas, setAreas] = useState<AreaRow[]>([]);
  const [selectedAreaIds, setSelectedAreaIds] = useState<string[]>([]);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [showDelete, setShowDelete] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState("");
  const [deleting, setDeleting] = useState(false);

  const assignableRoles = useMemo(
    () => getAssignableRoles(initialProfile.role).filter((candidate) => candidate !== "superadmin"),
    [initialProfile.role]
  );
  const availableRoleOptions = useMemo(() => {
    if (!userRow) return assignableRoles;
    return (assignableRoles as Role[]).includes(userRow.role) ? assignableRoles : [userRow.role, ...assignableRoles];
  }, [assignableRoles, userRow]);

  function toggleArea(areaId: string) {
    setSelectedAreaIds((prev) =>
      prev.includes(areaId) ? prev.filter((value) => value !== areaId) : [...prev, areaId]
    );
  }

  async function loadAreasAndAccess(targetUserId: string, hotelId: string) {
    setAreasLoading(true);
    const { data: areasData, error: areasErr } = await supabase
      .from("areas")
      .select("id,name,type,active")
      .eq("hotel_id", hotelId)
      .eq("active", true)
      .order("name", { ascending: true });
    if (areasErr) throw areasErr;
    setAreas((areasData ?? []) as AreaRow[]);

    const { data: accessData, error: accessErr } = await supabase
      .from("user_area_access")
      .select("area_id")
      .eq("user_id", targetUserId)
      .eq("hotel_id", hotelId);
    if (accessErr) throw accessErr;
    setSelectedAreaIds((accessData ?? []).map((row: { area_id: string }) => row.area_id));
    setAreasLoading(false);
  }

  useEffect(() => {
    const init = async () => {
      setLoading(true);
      setMsg(null);

      try {
        const { data: sessionData } = await supabase.auth.getSession();
        const accessToken = sessionData?.session?.access_token;
        if (!accessToken) {
          setMsg("Sesion invalida.");
          setLoading(false);
          return;
        }

        const response = await fetch(`/api/admin/users/${userId}`, {
          headers: { Authorization: `Bearer ${accessToken}` },
        });
        const payload = await response.json().catch(() => ({}));
        if (!response.ok || !payload?.user) {
          setMsg(payload?.error ?? "No se encontro el usuario.");
          setLoading(false);
          return;
        }

        const targetUser = payload.user as UserProfile;
        if (targetUser.hotel_id !== scopedHotelId) {
          router.push("/users");
          return;
        }

        setUserRow(targetUser);
        setFullName(targetUser.full_name ?? "");
        setRole(targetUser.role);
        setActive(targetUser.active);

        try {
          await loadAreasAndAccess(targetUser.id, scopedHotelId);
        } catch (e: unknown) {
          setMsg(`Error cargando areas: ${e instanceof Error ? e.message : "desconocido"}`);
        }
      } finally {
        setLoading(false);
      }
    };

    void init();
  }, [router, scopedHotelId, userId]);

  const save = async () => {
    if (!userRow) return;
    setSaving(true);
    setMsg(null);

    if (userRow.id === initialProfile.id && active === false) {
      setMsg("No puedes desactivarte a ti mismo.");
      setSaving(false);
      return;
    }

    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData?.session?.access_token;
      if (!accessToken) throw new Error("Sesion invalida.");

      if (newPassword) {
        if (newPassword.length < 8) {
          setMsg("La contraseña debe tener al menos 8 caracteres.");
          setSaving(false);
          return;
        }
        if (newPassword !== confirmPassword) {
          setMsg("Las contraseñas no coinciden.");
          setSaving(false);
          return;
        }
      }

      const updateRes = await fetch(`/api/admin/users/${userRow.id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          full_name: fullName.trim() || null,
          role,
          active,
          ...(newPassword ? { password: newPassword } : {}),
        }),
      });
      const updatePayload = await updateRes.json().catch(() => ({}));
      if (!updateRes.ok) throw new Error(updatePayload?.error ?? "No se pudo guardar el usuario.");

      const res = await fetch("/api/admin/user-area-access/set", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ user_id: userRow.id, area_ids: selectedAreaIds }),
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(payload?.error ?? "No se pudo guardar accesos de areas.");
      setNewPassword("");
      setConfirmPassword("");
      setMsg("Guardado.");
    } catch (e: unknown) {
      setMsg(`Error guardando areas: ${e instanceof Error ? e.message : "desconocido"}`);
    } finally {
      setSaving(false);
    }
  };

  const deleteUser = async () => {
    if (!userRow) return;
    setMsg(null);

    if (userRow.id === initialProfile.id) {
      setMsg("No puedes borrarte a ti mismo.");
      return;
    }

    if (deleteConfirm.trim().toUpperCase() !== "BORRAR") {
      setMsg("Para borrar, escribe BORRAR en el campo de confirmacion.");
      return;
    }

    try {
      setDeleting(true);
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData?.session?.access_token;
      if (!accessToken) throw new Error("Sesion invalida.");

      const res = await fetch(`/api/admin/users/${userRow.id}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });
      const text = await res.text();
      let payload: { error?: string } | null = null;
      try {
        payload = JSON.parse(text) as { error?: string };
      } catch {
        payload = { error: text?.slice(0, 200) || "Respuesta no-JSON." };
      }
      if (!res.ok) throw new Error(payload?.error ?? "No se pudo borrar el usuario.");
      router.push("/users");
    } catch (e: unknown) {
      setMsg(`Error borrando: ${e instanceof Error ? e.message : "desconocido"}`);
    } finally {
      setDeleting(false);
      setShowDelete(false);
      setDeleteConfirm("");
    }
  };

  if (loading) return <p className="p-6 font-[system-ui]">Cargando...</p>;

  if (!userRow) {
    return (
      <main className="p-6 font-[system-ui]">
        <h1 className="text-[22px] font-black">Editar usuario</h1>
        <p className="mt-3">{msg ?? "No disponible."}</p>
        <button
          onClick={() => router.push("/users")}
          className="mt-3 px-[14px] py-2.5 rounded-[10px] border border-black bg-white cursor-pointer font-extrabold"
        >
          Volver
        </button>
      </main>
    );
  }

  return (
    <main className="p-6 font-[system-ui]">
      <div className="flex justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-black m-0">Editar usuario</h1>
          <div className="mt-2 opacity-75"><span className="font-black">Email:</span> {userRow.email ?? "—"}</div>
          <div className="mt-1.5 opacity-70">ID: <span className="font-mono">{userRow.id}</span></div>
          <div className="mt-1.5 opacity-70">Hotel: <span className="font-mono">{userRow.hotel_id}</span></div>
        </div>
        <div className="flex gap-2.5 flex-wrap">
          <button
            onClick={() => router.push("/users")}
            className="px-[14px] py-2.5 rounded-[10px] border border-[#ddd] bg-white cursor-pointer font-black"
          >
            Volver
          </button>
          <button
            onClick={save}
            disabled={saving}
            className={`px-[14px] py-2.5 rounded-[10px] border border-black bg-black text-white cursor-pointer font-black ${saving ? "opacity-60" : "opacity-100"}`}
          >
            {saving ? "Guardando..." : "Guardar"}
          </button>
          <button
            onClick={() => setShowDelete((value) => !value)}
            className="px-[14px] py-2.5 rounded-[10px] border border-[rgba(220,20,60,0.6)] bg-[rgba(220,20,60,0.08)] text-[crimson] cursor-pointer font-black"
          >
            Borrar usuario
          </button>
        </div>
      </div>

      {msg ? (
        <div className="mt-[14px] p-3 rounded-xl border border-black/20 bg-white">{msg}</div>
      ) : null}

      {showDelete ? (
        <div className="mt-[14px] p-[14px] rounded-[14px] border border-[rgba(220,20,60,0.35)] bg-[rgba(220,20,60,0.06)]">
          <div className="font-black text-[crimson]">Borrado permanente</div>
          <div className="mt-1.5 opacity-85">Para confirmar, escribe <span className="font-black">BORRAR</span>.</div>
          <div className="flex gap-2.5 flex-wrap mt-2.5">
            <input
              value={deleteConfirm}
              onChange={(e) => setDeleteConfirm(e.target.value)}
              placeholder="Escribe BORRAR"
              className="p-3 rounded-[10px] border border-[rgba(220,20,60,0.4)] min-w-[240px] font-black"
            />
            <button
              onClick={deleteUser}
              disabled={deleting}
              className={`px-[14px] py-3 rounded-[10px] border border-[crimson] bg-[crimson] text-white font-black cursor-pointer ${deleting ? "opacity-60" : "opacity-100"}`}
            >
              {deleting ? "Borrando..." : "Confirmar borrado"}
            </button>
            <button
              onClick={() => { setShowDelete(false); setDeleteConfirm(""); }}
              className="px-[14px] py-3 rounded-[10px] border border-black/20 bg-white font-black cursor-pointer"
            >
              Cancelar
            </button>
          </div>
        </div>
      ) : null}

      <div className="mt-[18px] grid gap-[14px]">
        <label className="grid gap-1.5">
          <span className="font-black">Nombre</span>
          <input
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            placeholder="Nombre y apellidos"
            className="p-3 rounded-[10px] border border-[#ddd]"
          />
        </label>

        <label className="grid gap-1.5">
          <span className="font-black">Rol</span>
          <select
            value={role}
            onChange={(e) => setRole(e.target.value as Role)}
            className="p-3 rounded-[10px] border border-[#ddd]"
          >
            {availableRoleOptions.map((candidateRole) => (
              <option key={candidateRole} value={candidateRole}>
                {ROLE_LABELS[candidateRole] ?? candidateRole}
              </option>
            ))}
          </select>
        </label>

        <label className="flex items-center gap-2.5">
          <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} />
          <span className="font-black">Usuario activo</span>
        </label>

        <div className="mt-[10px] pt-[18px] border-t border-[#eee] grid gap-[14px]">
          <div className="font-black">Cambiar contraseña <span className="font-normal opacity-60 text-sm">(dejar vacío para no cambiar)</span></div>
          <label className="grid gap-1.5">
            <span className="font-black text-sm">Nueva contraseña</span>
            <input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="Mínimo 8 caracteres"
              className="p-3 rounded-[10px] border border-[#ddd]"
              autoComplete="new-password"
            />
          </label>
          <label className="grid gap-1.5">
            <span className="font-black text-sm">Confirmar contraseña</span>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Repite la nueva contraseña"
              className="p-3 rounded-[10px] border border-[#ddd]"
              autoComplete="new-password"
            />
          </label>
        </div>
      </div>

      <div className="mt-[22px]">
        <h2 className="text-lg font-black m-0">Areas habilitadas</h2>
        <div className="mt-3">
          {areasLoading ? (
            <div className="opacity-80">Cargando areas...</div>
          ) : areas.length === 0 ? (
            <div className="opacity-80">No hay areas activas en este hotel.</div>
          ) : (
            <div className="grid gap-2.5">
              {areas.map((area) => (
                <label key={area.id} className="flex gap-2.5 items-center p-3 rounded-xl border border-[#ddd]">
                  <input type="checkbox" checked={selectedAreaIds.includes(area.id)} onChange={() => toggleArea(area.id)} />
                  <span className="font-black">{area.name}</span>
                  <span className="opacity-70">{area.type ?? "Sin tipo"}</span>
                </label>
              ))}
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
