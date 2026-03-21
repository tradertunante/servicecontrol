"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import { getAssignableRoles } from "@/lib/auth/permissions";
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
    return assignableRoles.includes(userRow.role) ? assignableRoles : [userRow.role, ...assignableRoles];
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

  if (loading) return <p style={{ padding: 24, fontFamily: "system-ui" }}>Cargando...</p>;

  if (!userRow) {
    return (
      <main style={{ padding: 24, fontFamily: "system-ui" }}>
        <h1 style={{ fontSize: 22, fontWeight: 900 }}>Editar usuario</h1>
        <p style={{ marginTop: 12 }}>{msg ?? "No disponible."}</p>
        <button onClick={() => router.push("/users")} style={{ marginTop: 12, padding: "10px 14px", borderRadius: 10, border: "1px solid #000", background: "#fff", cursor: "pointer", fontWeight: 800 }}>
          Volver
        </button>
      </main>
    );
  }

  return (
    <main style={{ padding: 24, fontFamily: "system-ui" }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 950, margin: 0 }}>Editar usuario</h1>
          <div style={{ marginTop: 8, opacity: 0.75 }}><span style={{ fontWeight: 900 }}>Email:</span> {userRow.email ?? "—"}</div>
          <div style={{ marginTop: 6, opacity: 0.7 }}>ID: <span style={{ fontFamily: "monospace" }}>{userRow.id}</span></div>
          <div style={{ marginTop: 6, opacity: 0.7 }}>Hotel: <span style={{ fontFamily: "monospace" }}>{userRow.hotel_id}</span></div>
        </div>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <button onClick={() => router.push("/users")} style={{ padding: "10px 14px", borderRadius: 10, border: "1px solid #ddd", background: "#fff", cursor: "pointer", fontWeight: 900 }}>Volver</button>
          <button onClick={save} disabled={saving} style={{ padding: "10px 14px", borderRadius: 10, border: "1px solid #000", background: "#000", color: "#fff", cursor: "pointer", fontWeight: 950, opacity: saving ? 0.6 : 1 }}>{saving ? "Guardando..." : "Guardar"}</button>
          <button onClick={() => setShowDelete((value) => !value)} style={{ padding: "10px 14px", borderRadius: 10, border: "1px solid rgba(220,20,60,0.6)", background: "rgba(220,20,60,0.08)", color: "crimson", cursor: "pointer", fontWeight: 950 }}>Borrar usuario</button>
        </div>
      </div>

      {msg ? <div style={{ marginTop: 14, padding: 12, borderRadius: 12, border: "1px solid rgba(0,0,0,0.2)", background: "#fff" }}>{msg}</div> : null}

      {showDelete ? (
        <div style={{ marginTop: 14, padding: 14, borderRadius: 14, border: "1px solid rgba(220,20,60,0.35)", background: "rgba(220,20,60,0.06)" }}>
          <div style={{ fontWeight: 950, color: "crimson" }}>Borrado permanente</div>
          <div style={{ marginTop: 6, opacity: 0.85 }}>Para confirmar, escribe <span style={{ fontWeight: 950 }}>BORRAR</span>.</div>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 10 }}>
            <input value={deleteConfirm} onChange={(e) => setDeleteConfirm(e.target.value)} placeholder="Escribe BORRAR" style={{ padding: 12, borderRadius: 10, border: "1px solid rgba(220,20,60,0.4)", minWidth: 240, fontWeight: 900 }} />
            <button onClick={deleteUser} disabled={deleting} style={{ padding: "12px 14px", borderRadius: 10, border: "1px solid crimson", background: "crimson", color: "#fff", fontWeight: 950, cursor: "pointer", opacity: deleting ? 0.6 : 1 }}>{deleting ? "Borrando..." : "Confirmar borrado"}</button>
            <button onClick={() => { setShowDelete(false); setDeleteConfirm(""); }} style={{ padding: "12px 14px", borderRadius: 10, border: "1px solid rgba(0,0,0,0.2)", background: "#fff", fontWeight: 900, cursor: "pointer" }}>Cancelar</button>
          </div>
        </div>
      ) : null}

      <div style={{ marginTop: 18, display: "grid", gap: 14 }}>
        <label style={{ display: "grid", gap: 6 }}>
          <span style={{ fontWeight: 900 }}>Nombre</span>
          <input value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Nombre y apellidos" style={{ padding: 12, borderRadius: 10, border: "1px solid #ddd" }} />
        </label>

        <label style={{ display: "grid", gap: 6 }}>
          <span style={{ fontWeight: 900 }}>Rol</span>
          <select value={role} onChange={(e) => setRole(e.target.value as Role)} style={{ padding: 12, borderRadius: 10, border: "1px solid #ddd" }}>
            {availableRoleOptions.map((candidateRole) => (
              <option key={candidateRole} value={candidateRole}>
                {candidateRole}
              </option>
            ))}
          </select>
        </label>

        <label style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} />
          <span style={{ fontWeight: 900 }}>Usuario activo</span>
        </label>
      </div>

      <div style={{ marginTop: 22 }}>
        <h2 style={{ fontSize: 18, fontWeight: 950, margin: 0 }}>Areas habilitadas</h2>
        <div style={{ marginTop: 12 }}>
          {areasLoading ? <div style={{ opacity: 0.8 }}>Cargando areas...</div> : areas.length === 0 ? <div style={{ opacity: 0.8 }}>No hay areas activas en este hotel.</div> : (
            <div style={{ display: "grid", gap: 10 }}>
              {areas.map((area) => (
                <label key={area.id} style={{ display: "flex", gap: 10, alignItems: "center", padding: 12, borderRadius: 12, border: "1px solid #ddd" }}>
                  <input type="checkbox" checked={selectedAreaIds.includes(area.id)} onChange={() => toggleArea(area.id)} />
                  <span style={{ fontWeight: 900 }}>{area.name}</span>
                  <span style={{ opacity: 0.7 }}>{area.type ?? "Sin tipo"}</span>
                </label>
              ))}
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
