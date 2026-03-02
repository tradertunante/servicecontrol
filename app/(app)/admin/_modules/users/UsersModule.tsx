"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import type { Role } from "@/lib/types";

type UserRow = { id: string; full_name: string | null; role: Role; hotel_id: string | null; active: boolean | null; email?: string | null; created_at?: string | null };
type AreaRow = { id: string; name: string; type: string | null; hotel_id: string | null; active?: boolean | null; sort_order?: number | null };

const HOTEL_KEY = "sc_hotel_id";
const HOTEL_CHANGED_EVENT = "sc-hotel-changed";
const EDITABLE_ROLES = ["admin", "manager", "auditor"] as const;
type EditableRole = (typeof EDITABLE_ROLES)[number];
function isEditableRole(x: any): x is EditableRole { return EDITABLE_ROLES.includes(x); }

export default function UsersModule() {
  const [activeHotelId, setActiveHotelId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string>("");
  const [message, setMessage] = useState<string>("");
  const [users, setUsers] = useState<UserRow[]>([]);
  const [q, setQ] = useState("");
  const [roleFilter, setRoleFilter] = useState<"all" | Role>("all");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "inactive">("all");
  const [createOpen, setCreateOpen] = useState(false);
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [createRole, setCreateRole] = useState<"auditor" | "manager" | "admin">("auditor");
  const [createLoading, setCreateLoading] = useState(false);
  const [areasOpen, setAreasOpen] = useState(false);
  const [areasLoading, setAreasLoading] = useState(false);
  const [areasSaving, setAreasSaving] = useState(false);
  const [areasQ, setAreasQ] = useState("");
  const [areas, setAreas] = useState<AreaRow[]>([]);
  const [selectedAreaIds, setSelectedAreaIds] = useState<Set<string>>(new Set());
  const [areasUser, setAreasUser] = useState<UserRow | null>(null);

  useEffect(() => {
    const readHotel = () => { try { setActiveHotelId(localStorage.getItem(HOTEL_KEY)); } catch { setActiveHotelId(null); } };
    readHotel();
    window.addEventListener(HOTEL_CHANGED_EVENT, readHotel);
    window.addEventListener("storage", readHotel);
    return () => { window.removeEventListener(HOTEL_CHANGED_EVENT, readHotel); window.removeEventListener("storage", readHotel); };
  }, []);

  async function getBearer() { const { data } = await supabase.auth.getSession(); return data.session?.access_token ?? null; }

  async function loadUsers() {
    setError(""); setMessage("");
    if (!activeHotelId) { setUsers([]); setLoading(false); setError("No hay hotel seleccionado."); return; }
    setLoading(true);
    try {
      const { data, error: err } = await supabase.from("profiles").select("id, full_name, role, hotel_id, active, email, created_at").eq("hotel_id", activeHotelId).order("full_name", { ascending: true });
      if (err) throw err;
      setUsers((data ?? []) as any); setLoading(false);
    } catch (e: any) { setLoading(false); setError(e?.message || "Error cargando usuarios."); }
  }

  useEffect(() => { loadUsers(); }, [activeHotelId]);

  const filtered = useMemo(() => {
    let list = [...users];
    const needle = q.trim().toLowerCase();
    if (needle) list = list.filter((u) => [(u.full_name ?? ""), (u.id ?? ""), (u.role ?? ""), (u.email ?? "")].some((s) => s.toLowerCase().includes(needle)));
    if (roleFilter !== "all") list = list.filter((u) => u.role === roleFilter);
    if (statusFilter !== "all") list = statusFilter === "active" ? list.filter((u) => (u.active ?? true) === true) : list.filter((u) => (u.active ?? true) === false);
    return list;
  }, [users, q, roleFilter, statusFilter]);

  async function updateUserRole(userId: string, nextRole: EditableRole) {
    setError(""); setMessage("");
    if (!activeHotelId) return setError("No hay hotel seleccionado.");
    const token = await getBearer(); if (!token) return setError("No autorizado.");
    setBusyId(userId);
    try {
      const res = await fetch("/api/admin/update-user-role", { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }, body: JSON.stringify({ user_id: userId, hotel_id: activeHotelId, role: nextRole }) });
      const json = await res.json().catch(() => ({} as any));
      if (!res.ok) throw new Error(json?.error || `Error (${res.status}).`);
      setUsers((prev) => prev.map((u) => (u.id === userId ? { ...u, role: nextRole } : u)));
      setMessage("Rol actualizado.");
    } catch (e: any) { setError(e?.message || "Error actualizando rol."); }
    finally { setBusyId(null); }
  }

  async function setActive(userId: string, nextActive: boolean) {
    setError(""); setMessage("");
    if (!activeHotelId) return setError("No hay hotel seleccionado.");
    const token = await getBearer(); if (!token) return setError("No autorizado.");
    setBusyId(userId);
    try {
      const res = await fetch("/api/admin/set-user-active", { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }, body: JSON.stringify({ user_id: userId, hotel_id: activeHotelId, active: nextActive }) });
      const json = await res.json().catch(() => ({} as any));
      if (!res.ok) throw new Error(json?.error || `Error (${res.status}).`);
      setUsers((prev) => prev.map((u) => (u.id === userId ? { ...u, active: nextActive } : u)));
      setMessage(nextActive ? "Usuario activado." : "Usuario desactivado.");
    } catch (e: any) { setError(e?.message || "Error actualizando estado."); }
    finally { setBusyId(null); }
  }

  async function softDelete(userId: string) {
    setError(""); setMessage("");
    if (!activeHotelId) return setError("No hay hotel seleccionado.");
    const token = await getBearer(); if (!token) return setError("No autorizado.");
    setBusyId(userId);
    try {
      const res = await fetch("/api/admin/delete-user", { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }, body: JSON.stringify({ user_id: userId, hotel_id: activeHotelId }) });
      const json = await res.json().catch(() => ({} as any));
      if (!res.ok) throw new Error(json?.error || `Error (${res.status}).`);
      setUsers((prev) => prev.map((u) => (u.id === userId ? { ...u, active: false } : u)));
      setMessage("Usuario desactivado (borrado lógico).");
    } catch (e: any) { setError(e?.message || "Error borrando usuario."); }
    finally { setBusyId(null); }
  }

  async function createUser(e: React.FormEvent) {
    e.preventDefault(); setError(""); setMessage("");
    if (!activeHotelId) { setError("No hay hotel seleccionado."); return; }
    setCreateLoading(true);
    try {
      const token = await getBearer(); if (!token) throw new Error("No autorizado.");
      const res = await fetch("/api/admin/create-user", { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }, body: JSON.stringify({ full_name: fullName || null, email, password, role: createRole, hotel_id: activeHotelId }) });
      const json = await res.json().catch(() => ({} as any));
      if (!res.ok) throw new Error(json?.error || `Error (${res.status}).`);
      setMessage(`Usuario creado. ID: ${json?.user_id ?? "??"}`);
      setFullName(""); setEmail(""); setPassword(""); setCreateRole("auditor"); setCreateOpen(false);
      await loadUsers();
    } catch (e: any) { setError(e?.message || "Error creando usuario."); }
    finally { setCreateLoading(false); }
  }

  async function loadAreasForHotel(hotelId: string) {
    const { data, error: err } = await supabase.from("areas").select("id, name, type, hotel_id, active, sort_order").eq("hotel_id", hotelId).order("sort_order", { ascending: true }).order("name", { ascending: true });
    if (err) throw err;
    return (data ?? []) as any as AreaRow[];
  }

  async function openAreasModal(user: UserRow) {
    setError(""); setMessage("");
    if (!activeHotelId) { setError("No hay hotel seleccionado."); return; }
    const token = await getBearer(); if (!token) { setError("No autorizado."); return; }
    setAreasUser(user); setAreasQ(""); setAreasLoading(true); setSelectedAreaIds(new Set()); setAreas([]); setAreasOpen(true);
    try {
      const hotelAreas = await loadAreasForHotel(activeHotelId);
      setAreas(hotelAreas);
      const res = await fetch("/api/admin/user-area-access/get", { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }, body: JSON.stringify({ user_id: user.id, hotel_id: activeHotelId }) });
      const json = await res.json().catch(() => ({} as any));
      if (!res.ok) throw new Error(json?.error || `Error (${res.status}).`);
      setSelectedAreaIds(new Set(Array.isArray(json?.area_ids) ? json.area_ids as string[] : []));
    } catch (e: any) { setError(e?.message || "Error cargando áreas."); }
    finally { setAreasLoading(false); }
  }

  async function saveAreas() {
    setError(""); setMessage("");
    if (!activeHotelId) return setError("No hay hotel seleccionado.");
    if (!areasUser) return setError("No hay usuario seleccionado.");
    const token = await getBearer(); if (!token) return setError("No autorizado.");
    setAreasSaving(true);
    try {
      const res = await fetch("/api/admin/user-area-access/set", { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }, body: JSON.stringify({ user_id: areasUser.id, hotel_id: activeHotelId, area_ids: Array.from(selectedAreaIds) }) });
      const json = await res.json().catch(() => ({} as any));
      if (!res.ok) throw new Error(json?.error || `Error (${res.status}).`);
      setMessage("Accesos por área actualizados."); setAreasOpen(false); setAreasUser(null);
    } catch (e: any) { setError(e?.message || "Error guardando accesos."); }
    finally { setAreasSaving(false); }
  }

  const filteredAreas = useMemo(() => { const needle = areasQ.trim().toLowerCase(); if (!needle) return areas; return areas.filter((a) => [(a.name ?? ""), (a.type ?? "")].some((s) => s.toLowerCase().includes(needle))); }, [areas, areasQ]);

  const s = { btn: { padding: "10px 14px", borderRadius: 12, border: "1px solid var(--border)", background: "var(--card-bg)", fontWeight: 900, cursor: "pointer" } as React.CSSProperties };

  return (
    <div>
      <div style={{ padding: 14, borderRadius: 14, background: "rgba(0,0,0,0.03)", border: "1px solid var(--border)", display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
        <div style={{ fontSize: 13, color: "var(--muted)", fontWeight: 900 }}>Hotel: <span style={{ color: "var(--text)" }}>{activeHotelId ?? "—"}</span></div>
        <button onClick={() => { setError(""); setMessage(""); setCreateOpen(true); }} style={{ ...s.btn, background: "black", color: "white" }}>+ Crear usuario</button>
        <button onClick={loadUsers} style={s.btn}>Recargar</button>
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar por nombre, email, rol o ID..." style={{ flex: 1, minWidth: 260, padding: "10px 12px", borderRadius: 12, border: "1px solid var(--border)", background: "var(--card-bg)" }} />
        <select value={roleFilter} onChange={(e) => setRoleFilter(e.target.value as any)} style={{ ...s.btn }}><option value="all">Todos los roles</option><option value="admin">admin</option><option value="manager">manager</option><option value="auditor">auditor</option></select>
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as any)} style={{ ...s.btn }}><option value="all">Todos</option><option value="active">Activos</option><option value="inactive">Inactivos</option></select>
      </div>

      {error && <div style={{ marginTop: 14, padding: 12, borderRadius: 12, border: "1px solid rgba(220,0,0,0.35)", background: "rgba(220,0,0,0.06)", color: "crimson", fontWeight: 900 }}>{error}</div>}
      {message && <div style={{ marginTop: 14, padding: 12, borderRadius: 12, border: "1px solid var(--border)", background: "rgba(0,200,0,0.10)", color: "green", fontWeight: 900 }}>{message}</div>}

      <div style={{ marginTop: 16 }}>
        {loading ? <div style={{ fontWeight: 900 }}>Cargando…</div> : filtered.length === 0 ? (
          <div style={{ background: "var(--card-bg)", border: "1px solid var(--border)", borderRadius: 16, padding: 18 }}>
            <div style={{ fontWeight: 900 }}>No hay usuarios</div>
            <div style={{ marginTop: 6, color: "var(--muted)" }}>No hay usuarios en este hotel (o no coinciden con el filtro).</div>
          </div>
        ) : filtered.map((u) => {
          const disabled = busyId === u.id;
          const isActive = (u.active ?? true) === true;
          return (
            <div key={u.id} style={{ background: "var(--card-bg)", border: "1px solid var(--border)", borderRadius: 16, boxShadow: "var(--shadow-sm)", padding: 16, marginBottom: 12, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
              <div style={{ minWidth: 260 }}>
                <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
                  <div style={{ fontWeight: 900 }}>{u.full_name ?? "Sin nombre"}</div>
                  <span style={{ fontSize: 12, fontWeight: 900, padding: "4px 8px", borderRadius: 999, border: "1px solid var(--border)", background: "rgba(0,0,0,0.03)" }}>{u.role}</span>
                  <span style={{ fontSize: 12, fontWeight: 900, padding: "4px 8px", borderRadius: 999, border: "1px solid var(--border)", background: isActive ? "rgba(0,200,0,0.10)" : "rgba(0,0,0,0.04)", color: isActive ? "green" : "var(--muted)" }}>{isActive ? "ACTIVO" : "INACTIVO"}</span>
                </div>
                <div style={{ marginTop: 6, fontSize: 12, color: "var(--muted)" }}>ID: {u.id}{u.email ? <> · {u.email}</> : null}</div>
              </div>
              <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
                {u.role === "superadmin" ? (
                  <span style={{ padding: "8px 10px", borderRadius: 10, border: "1px solid var(--border)", background: "rgba(0,0,0,0.03)", fontWeight: 900, opacity: 0.8 }}>superadmin 🔒</span>
                ) : (
                  <select value={isEditableRole(u.role) ? u.role : "admin"} disabled={disabled} onChange={(e) => { const next = e.target.value; if (!isEditableRole(next)) { setError("No se puede asignar superadmin."); return; } updateUserRole(u.id, next); }} style={{ ...s.btn, cursor: disabled ? "not-allowed" : "pointer", opacity: disabled ? 0.6 : 1 }}>
                    <option value="admin">admin</option><option value="manager">manager</option><option value="auditor">auditor</option>
                  </select>
                )}
                {(u.role === "manager" || u.role === "auditor") && <button disabled={disabled} onClick={() => openAreasModal(u)} style={{ ...s.btn, cursor: disabled ? "not-allowed" : "pointer", opacity: disabled ? 0.6 : 1 }}>Áreas</button>}
                <button disabled={disabled || u.role === "superadmin"} onClick={() => setActive(u.id, !isActive)} style={{ ...s.btn, cursor: disabled ? "not-allowed" : "pointer", opacity: disabled || u.role === "superadmin" ? 0.6 : 1 }}>{isActive ? "Desactivar" : "Activar"}</button>
                <button disabled={disabled || u.role === "superadmin"} onClick={() => softDelete(u.id)} style={{ ...s.btn, border: "1px solid rgba(220,0,0,0.35)", background: "rgba(220,0,0,0.06)", color: "crimson", cursor: disabled ? "not-allowed" : "pointer", opacity: disabled || u.role === "superadmin" ? 0.6 : 1 }}>Borrar</button>
              </div>
            </div>
          );
        })}
      </div>

      {createOpen && (
        <div onClick={() => !createLoading && setCreateOpen(false)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.35)", display: "flex", alignItems: "center", justifyContent: "center", padding: 18, zIndex: 50 }}>
          <div onClick={(e) => e.stopPropagation()} style={{ width: "100%", borderRadius: 16, border: "1px solid var(--border)", background: "var(--card-bg)", boxShadow: "var(--shadow-sm)", padding: 18 }}>
            <h2 style={{ margin: "6px 0 0", fontSize: 22, fontWeight: 900 }}>Crear usuario</h2>
            <form onSubmit={createUser} style={{ marginTop: 14 }}>
              <div style={{ display: "grid", gap: 12 }}>
                {[["Nombre completo", "text", fullName, setFullName, "Opcional", false], ["Email", "email", email, setEmail, "correo@hotel.com", true], ["Password", "password", password, setPassword, "mínimo 8 caracteres", true]].map(([label, type, value, setter, placeholder, required]) => (
                  <div key={label as string}>
                    <label style={{ fontWeight: 800, fontSize: 13 }}>{label as string}</label>
                    <input type={type as string} required={required as boolean} value={value as string} onChange={(e) => (setter as any)(e.target.value)} placeholder={placeholder as string} style={{ width: "100%", marginTop: 6, padding: 10, borderRadius: 10, border: "1px solid var(--border)", background: "var(--card-bg)" }} />
                  </div>
                ))}
                <div>
                  <label style={{ fontWeight: 800, fontSize: 13 }}>Rol</label>
                  <select value={createRole} onChange={(e) => setCreateRole(e.target.value as any)} style={{ width: "100%", marginTop: 6, padding: 10, borderRadius: 10, border: "1px solid var(--border)", background: "var(--card-bg)", fontWeight: 900 }}>
                    <option value="auditor">Auditor</option><option value="manager">Manager</option><option value="admin">Admin</option>
                  </select>
                </div>
                <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
                  <button type="button" disabled={createLoading} onClick={() => setCreateOpen(false)} style={{ ...s.btn, background: "rgba(0,0,0,0.03)", opacity: createLoading ? 0.6 : 1 }}>Cancelar</button>
                  <button type="submit" disabled={createLoading} style={{ ...s.btn, background: "black", color: "white", opacity: createLoading ? 0.7 : 1 }}>{createLoading ? "Creando…" : "Crear usuario"}</button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {areasOpen && (
        <div onClick={() => !areasSaving && setAreasOpen(false)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.35)", display: "flex", alignItems: "center", justifyContent: "center", padding: 18, zIndex: 60 }}>
          <div onClick={(e) => e.stopPropagation()} style={{ width: "100%", borderRadius: 16, border: "1px solid var(--border)", background: "var(--card-bg)", padding: 18 }}>
            <h2 style={{ margin: "6px 0 0", fontSize: 22, fontWeight: 900 }}>{areasUser?.full_name ?? "Usuario"} · {areasUser?.role}</h2>
            <div style={{ marginTop: 10, display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
              <input value={areasQ} onChange={(e) => setAreasQ(e.target.value)} placeholder="Buscar área…" style={{ flex: 1, minWidth: 260, padding: "10px 12px", borderRadius: 12, border: "1px solid var(--border)", background: "var(--card-bg)" }} />
              <button type="button" disabled={areasLoading || areasSaving} onClick={() => setSelectedAreaIds(new Set())} style={{ ...s.btn, background: "rgba(0,0,0,0.03)", opacity: areasLoading || areasSaving ? 0.6 : 1 }}>Limpiar</button>
            </div>
            <div style={{ marginTop: 12, border: "1px solid var(--border)", borderRadius: 14, background: "rgba(0,0,0,0.02)", padding: 12, maxHeight: "55vh", overflow: "auto" }}>
              {areasLoading ? <div style={{ fontWeight: 900 }}>Cargando áreas…</div> : filteredAreas.length === 0 ? <div style={{ fontWeight: 900, color: "var(--muted)" }}>No hay áreas</div> : filteredAreas.map((a) => {
                const checked = selectedAreaIds.has(a.id);
                const inactive = a.active === false;
                return (
                  <label key={a.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 10px", borderRadius: 12, border: "1px solid var(--border)", background: "var(--card-bg)", marginBottom: 10, cursor: areasSaving ? "not-allowed" : "pointer", opacity: inactive ? 0.6 : 1 }}>
                    <input type="checkbox" checked={checked} disabled={areasSaving || inactive} onChange={() => setSelectedAreaIds((prev) => { const next = new Set(prev); if (next.has(a.id)) next.delete(a.id); else next.add(a.id); return next; })} style={{ width: 18, height: 18 }} />
                    <div style={{ display: "flex", flexDirection: "column", gap: 4, flex: 1 }}>
                      <div style={{ fontWeight: 900 }}>{a.name}</div>
                      <div style={{ fontSize: 12, color: "var(--muted)" }}>{a.type ?? "—"} · {a.id}</div>
                    </div>
                    <span style={{ fontSize: 12, fontWeight: 900, padding: "4px 8px", borderRadius: 999, border: "1px solid var(--border)", background: inactive ? "rgba(0,0,0,0.03)" : "rgba(0,200,0,0.10)", color: inactive ? "var(--muted)" : "green" }}>{inactive ? "INACTIVA" : "OK"}</span>
                  </label>
                );
              })}
            </div>
            <div style={{ marginTop: 12, display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
              <div style={{ fontSize: 13, color: "var(--muted)", fontWeight: 900 }}>Seleccionadas: <span style={{ color: "var(--text)" }}>{selectedAreaIds.size}</span></div>
              <div style={{ display: "flex", gap: 10 }}>
                <button type="button" disabled={areasSaving} onClick={() => setAreasOpen(false)} style={{ ...s.btn, background: "rgba(0,0,0,0.03)", opacity: areasSaving ? 0.6 : 1 }}>Cancelar</button>
                <button type="button" disabled={areasSaving || areasLoading} onClick={saveAreas} style={{ ...s.btn, background: "black", color: "white", opacity: areasSaving || areasLoading ? 0.7 : 1 }}>{areasSaving ? "Guardando…" : "Guardar áreas"}</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}