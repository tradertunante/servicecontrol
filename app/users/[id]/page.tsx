"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { canManageUsers } from "@/lib/auth/permissions";

type Role = "admin" | "manager" | "auditor";

type Profile = {
  id: string;
  hotel_id: string;
  role: Role;
  active: boolean;
  full_name?: string | null;
};

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

export default function UserDetailPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const userId = params?.id;

  const [loading, setLoading] = useState(true);
  const [me, setMe] = useState<Profile | null>(null);

  const [userRow, setUserRow] = useState<UserProfile | null>(null);
  const [fullName, setFullName] = useState<string>("");
  const [role, setRole] = useState<Role>("auditor");
  const [active, setActive] = useState<boolean>(true);

  const [areasLoading, setAreasLoading] = useState(true);
  const [areas, setAreas] = useState<AreaRow[]>([]);
  const [selectedAreaIds, setSelectedAreaIds] = useState<string[]>([]);

  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const [showDelete, setShowDelete] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState("");
  const [deleting, setDeleting] = useState(false);

  const invalidId = useMemo(() => !userId || typeof userId !== "string", [userId]);

  function toggleArea(areaId: string) {
    setSelectedAreaIds((prev) =>
      prev.includes(areaId) ? prev.filter((x) => x !== areaId) : [...prev, areaId]
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

    setSelectedAreaIds((accessData ?? []).map((r: any) => r.area_id));
    setAreasLoading(false);
  }

  useEffect(() => {
    const init = async () => {
      setLoading(true);
      setMsg(null);

      if (invalidId) {
        router.push("/users");
        return;
      }

      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        router.push("/login");
        return;
      }

      const { data: myProfile, error: meErr } = await supabase
        .from("profiles")
        .select("id, hotel_id, role, active, full_name")
        .eq("id", user.id)
        .single();

      if (meErr || !myProfile || myProfile.active === false) {
        router.push("/login");
        return;
      }

      const myP = myProfile as Profile;
      setMe(myP);

      if (!canManageUsers(myP.role)) {
        router.push("/");
        return;
      }

      const { data: target, error: tErr } = await supabase
        .from("profiles")
        .select("id, hotel_id, role, active, full_name, email")
        .eq("id", userId)
        .single();

      if (tErr || !target) {
        setMsg("No se encontró el usuario.");
        setLoading(false);
        return;
      }

      const t = target as UserProfile;

      if (t.hotel_id !== myP.hotel_id) {
        router.push("/users");
        return;
      }

      setUserRow(t);
      setFullName(t.full_name ?? "");
      setRole(t.role);
      setActive(t.active);

      try {
        await loadAreasAndAccess(t.id, myP.hotel_id);
      } catch (e: any) {
        setMsg(`❌ Error cargando áreas: ${e?.message ?? "desconocido"}`);
      }

      setLoading(false);
    };

    init();
  }, [router, userId, invalidId]);

  const save = async () => {
    if (!me || !userRow) return;

    setSaving(true);
    setMsg(null);

    if (userRow.id === me.id && active === false) {
      setMsg("No puedes desactivarte a ti mismo.");
      setSaving(false);
      return;
    }

    const { error } = await supabase
      .from("profiles")
      .update({
        full_name: fullName.trim() || null,
        role,
        active,
      })
      .eq("id", userRow.id);

    if (error) {
      setMsg(`❌ Error: ${error.message}`);
      setSaving(false);
      return;
    }

    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData?.session?.access_token;
      if (!accessToken) throw new Error("Sesión inválida. Vuelve a iniciar sesión.");

      const res = await fetch("/api/admin/user-area-access", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          user_id: userRow.id,
          area_ids: selectedAreaIds,
        }),
      });

      const payload = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(payload?.error ?? "No se pudo guardar accesos de áreas.");
    } catch (e: any) {
      setMsg(`❌ Error guardando áreas: ${e?.message ?? "desconocido"}`);
      setSaving(false);
      return;
    }

    setMsg("✅ Guardado.");
    setSaving(false);
  };

  const deleteUser = async () => {
    if (!me || !userRow) return;

    setMsg(null);

    if (userRow.id === me.id) {
      setMsg("No puedes borrarte a ti mismo.");
      return;
    }

    if (deleteConfirm.trim().toUpperCase() !== "BORRAR") {
      setMsg("Para borrar, escribe BORRAR en el campo de confirmación.");
      return;
    }

    try {
      setDeleting(true);

      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData?.session?.access_token;
      if (!accessToken) throw new Error("Sesión inválida. Vuelve a iniciar sesión.");

      const res = await fetch("/api/admin/delete-user", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ user_id: userRow.id }),
      });

      const text = await res.text();
      let payload: any = null;
      try {
        payload = JSON.parse(text);
      } catch {
        payload = { error: text?.slice(0, 200) || "Respuesta no-JSON del servidor." };
      }

      if (!res.ok) throw new Error(payload?.error ?? "No se pudo borrar el usuario.");

      router.push("/users");
    } catch (e: any) {
      setMsg(`❌ Error borrando: ${e?.message ?? "desconocido"}`);
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
        <button
          onClick={() => router.push("/users")}
          style={{
            marginTop: 12,
            padding: "10px 14px",
            borderRadius: 10,
            border: "1px solid #000",
            background: "#fff",
            cursor: "pointer",
            fontWeight: 800,
          }}
        >
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
          <div style={{ marginTop: 8, opacity: 0.75 }}>
            <span style={{ fontWeight: 900 }}>Email:</span> {userRow.email ?? "—"}
          </div>
          <div style={{ marginTop: 6, opacity: 0.7 }}>
            ID: <span style={{ fontFamily: "monospace" }}>{userRow.id}</span>
          </div>
          <div style={{ marginTop: 6, opacity: 0.7 }}>
            Hotel: <span style={{ fontFamily: "monospace" }}>{userRow.hotel_id}</span>
          </div>
        </div>

        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <button
            onClick={() => router.push("/users")}
            style={{
              padding: "10px 14px",
              borderRadius: 10,
              border: "1px solid #ddd",
              background: "#fff",
              cursor: "pointer",
              fontWeight: 900,
            }}
          >
            Volver
          </button>

          <button
            onClick={save}
            disabled={saving}
            style={{
              padding: "10px 14px",
              borderRadius: 10,
              border: "1px solid #000",
              background: "#000",
              color: "#fff",
              cursor: "pointer",
              fontWeight: 950,
              opacity: saving ? 0.6 : 1,
            }}
          >
            {saving ? "Guardando..." : "Guardar"}
          </button>

          <button
            onClick={() => setShowDelete((v) => !v)}
            style={{
              padding: "10px 14px",
              borderRadius: 10,
              border: "1px solid rgba(220, 20, 60, 0.6)",
              background: "rgba(220, 20, 60, 0.08)",
              color: "crimson",
              cursor: "pointer",
              fontWeight: 950,
            }}
          >
            Borrar usuario
          </button>
        </div>
      </div>

      {msg && (
        <div
          style={{
            marginTop: 14,
            padding: 12,
            borderRadius: 12,
            border: msg.startsWith("✅") ? "1px solid #0a0" : "1px solid crimson",
            background: "#fff",
          }}
        >
          {msg}
        </div>
      )}

      {showDelete && (
        <div
          style={{
            marginTop: 14,
            padding: 14,
            borderRadius: 14,
            border: "1px solid rgba(220,20,60,0.35)",
            background: "rgba(220,20,60,0.06)",
          }}
        >
          <div style={{ fontWeight: 950, color: "crimson" }}>⚠️ Borrado permanente</div>
          <div style={{ marginTop: 6, opacity: 0.85 }}>
            Para confirmar, escribe <span style={{ fontWeight: 950 }}>BORRAR</span>.
          </div>

          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 10 }}>
            <input
              value={deleteConfirm}
              onChange={(e) => setDeleteConfirm(e.target.value)}
              placeholder="Escribe BORRAR"
              style={{
                padding: 12,
                borderRadius: 10,
                border: "1px solid rgba(220,20,60,0.4)",
                minWidth: 240,
                fontWeight: 900,
              }}
            />

            <button
              onClick={deleteUser}
              disabled={deleting}
              style={{
                padding: "12px 14px",
                borderRadius: 10,
                border: "1px solid crimson",
                background: "crimson",
                color: "#fff",
                fontWeight: 950,
                cursor: "pointer",
                opacity: deleting ? 0.6 : 1,
              }}
            >
              {deleting ? "Borrando..." : "Confirmar borrado"}
            </button>

            <button
              onClick={() => {
                setShowDelete(false);
                setDeleteConfirm("");
              }}
              style={{
                padding: "12px 14px",
                borderRadius: 10,
                border: "1px solid rgba(0,0,0,0.2)",
                background: "#fff",
                fontWeight: 900,
                cursor: "pointer",
              }}
            >
              Cancelar
            </button>
          </div>
        </div>
      )}

      <div style={{ marginTop: 18, display: "grid", gap: 14 }}>
        <label style={{ display: "grid", gap: 6 }}>
          <span style={{ fontWeight: 900 }}>Nombre</span>
          <input
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            placeholder="Nombre y apellidos"
            style={{ padding: 12, borderRadius: 10, border: "1px solid #ddd" }}
          />
        </label>

        <label style={{ display: "grid", gap: 6 }}>
          <span style={{ fontWeight: 900 }}>Rol</span>
          <select
            value={role}
            onChange={(e) => setRole(e.target.value as Role)}
            style={{ padding: 12, borderRadius: 10, border: "1px solid #ddd" }}
          >
            <option value="auditor">auditor</option>
            <option value="manager">manager</option>
            <option value="admin">admin</option>
          </select>
        </label>

        <label style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} />
          <span style={{ fontWeight: 900 }}>Usuario activo</span>
        </label>

        {me && userRow.id === me.id && (
          <p style={{ margin: 0, fontSize: 12, opacity: 0.7 }}>Nota: no puedes desactivarte ni borrarte a ti mismo.</p>
        )}
      </div>

      <div style={{ marginTop: 22 }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
          <h2 style={{ fontSize: 18, fontWeight: 950, margin: 0 }}>Áreas habilitadas para auditar</h2>
          <div style={{ fontSize: 13, opacity: 0.75 }}>Marca las áreas que este usuario puede auditar.</div>
        </div>

        <div style={{ marginTop: 12 }}>
          {areasLoading ? (
            <div style={{ opacity: 0.8 }}>Cargando áreas…</div>
          ) : areas.length === 0 ? (
            <div style={{ opacity: 0.8 }}>No hay áreas activas en este hotel.</div>
          ) : (
            <div style={{ display: "grid", gap: 10, gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))" }}>
              {areas.map((a) => {
                const checked = selectedAreaIds.includes(a.id);
                return (
                  <label
                    key={a.id}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 10,
                      padding: 12,
                      borderRadius: 12,
                      border: "1px solid rgba(0,0,0,0.18)",
                      background: "rgba(255,255,255,0.55)",
                      cursor: "pointer",
                      userSelect: "none",
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggleArea(a.id)}
                      style={{ width: 18, height: 18 }}
                    />
                    <div style={{ display: "flex", flexDirection: "column" }}>
                      <span style={{ fontWeight: 950 }}>{a.name}</span>
                      <span style={{ opacity: 0.75, fontSize: 13 }}>{a.type ?? "—"}</span>
                    </div>
                  </label>
                );
              })}
            </div>
          )}
        </div>

        <div style={{ marginTop: 10, fontSize: 13, opacity: 0.8 }}>
          Si el rol es <b>auditor</b> y no marcas ninguna, ese auditor verá <b>0 áreas</b> (modo seguro).
        </div>
      </div>
    </main>
  );
}
