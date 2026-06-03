"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/app/providers/ToastProvider";
import BackButton from "@/app/components/BackButton";
import { supabase } from "@/lib/supabaseClient";
import { getAssignableRoles, ROLE_LABELS } from "@/lib/auth/permissions";
import type { Profile, Role } from "@/lib/types";

type AreaRef = { id: string; name: string };

type UserRow = {
  id: string;
  full_name: string | null;
  email: string | null;
  role: Role;
  active: boolean;
  last_sign_in_at: string | null;
  email_confirmed_at: string | null;
  areas: AreaRef[];
  audit_run_count: number;
};

const ROLE_PILL: Record<string, string> = {
  superadmin:      "bg-red-100 text-red-700",
  admin:           "bg-violet-100 text-violet-700",
  general_manager: "bg-blue-100 text-blue-700",
  manager:         "bg-emerald-100 text-emerald-700",
  auditor:         "bg-orange-100 text-orange-700",
  quality:         "bg-cyan-100 text-cyan-700",
  engineering:     "bg-yellow-100 text-yellow-800",
  it:              "bg-pink-100 text-pink-700",
  systems:         "bg-slate-100 text-slate-700",
};

const AVATAR_BG: Record<string, string> = {
  superadmin:      "bg-red-500",
  admin:           "bg-violet-500",
  general_manager: "bg-blue-500",
  manager:         "bg-emerald-500",
  auditor:         "bg-orange-500",
  quality:         "bg-cyan-500",
  engineering:     "bg-yellow-500",
  it:              "bg-pink-500",
  systems:         "bg-slate-500",
};

function initials(name: string | null): string {
  if (!name?.trim()) return "?";
  const parts = name.trim().split(/\s+/);
  return parts.length === 1
    ? parts[0].slice(0, 2).toUpperCase()
    : (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function formatDate(iso: string | null): string {
  if (!iso) return "Nunca";
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
  if (diff === 0) return "Hoy";
  if (diff === 1) return "Ayer";
  if (diff < 7)  return `Hace ${diff} d.`;
  if (diff < 30) return `Hace ${Math.floor(diff / 7)} sem.`;
  if (diff < 365) return `Hace ${Math.floor(diff / 30)} m.`;
  return `Hace ${Math.floor(diff / 365)} a.`;
}

function exportCSV(rows: UserRow[]) {
  const header = ["Nombre", "Email", "Rol", "Estado", "Áreas", "Último acceso", "Auditorías"];
  const body = rows.map((u) => [
    u.full_name ?? "",
    u.email ?? "",
    ROLE_LABELS[u.role] ?? u.role,
    !u.last_sign_in_at ? "Sin acceso" : u.active ? "Activo" : "Inactivo",
    u.areas.map((a) => a.name).join("; "),
    u.last_sign_in_at ? new Date(u.last_sign_in_at).toLocaleDateString("es-ES") : "Nunca",
    String(u.audit_run_count),
  ]);
  const csv = [header, ...body]
    .map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(","))
    .join("\n");
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" }));
  a.download = `usuarios_${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(a.href);
}

const PAGE_SIZE = 20;

const ACTION_LABELS: Record<string, string> = {
  user_created:   "Usuario creado",
  role_changed:   "Rol cambiado",
  active_changed: "Estado cambiado",
  user_deleted:   "Usuario eliminado",
};

function TreeView({ users, onEditAreas, onEdit, onDelete, rolePill, avatarBg, initials: getInitials }: {
  users: UserRow[];
  onEditAreas: (u: UserRow) => void;
  onEdit: (u: UserRow) => void;
  onDelete: (u: UserRow) => void;
  rolePill: Record<string, string>;
  avatarBg: Record<string, string>;
  initials: (name: string | null) => string;
}) {
  const areaMap = useMemo(() => {
    const map = new Map<string, { areaName: string; users: UserRow[] }>();
    for (const user of users) {
      if (user.areas.length === 0) continue;
      for (const area of user.areas) {
        if (!map.has(area.id)) map.set(area.id, { areaName: area.name, users: [] });
        map.get(area.id)!.users.push(user);
      }
    }
    return [...map.values()].sort((a, b) => a.areaName.localeCompare(b.areaName, "es"));
  }, [users]);

  const unassigned = useMemo(() => users.filter((u) => u.areas.length === 0), [users]);

  const groups = [
    ...areaMap,
    ...(unassigned.length > 0 ? [{ areaName: "Sin área asignada", users: unassigned }] : []),
  ];

  if (groups.length === 0) {
    return (
      <div className="mt-[18px] p-6 rounded-[18px] border border-black/[0.08] bg-white/75 text-sm opacity-60 font-[800]">
        No hay usuarios para mostrar.
      </div>
    );
  }

  return (
    <div className="mt-[18px] grid gap-4">
      {groups.map(({ areaName, users: areaUsers }) => (
        <div key={areaName} className="rounded-[18px] border border-black/[0.08] bg-white/75 overflow-hidden">
          <div className="px-4 py-3 border-b border-black/[0.06] bg-white/85">
            <span className="font-[950]">{areaName}</span>
            <span className="ml-2 opacity-50 text-sm font-[800]">
              {areaUsers.length} usuario{areaUsers.length !== 1 ? "s" : ""}
            </span>
          </div>
          <div className="divide-y divide-black/[0.05]">
            {areaUsers.map((user) => (
              <div key={user.id} className="flex items-center gap-3 px-4 py-3 flex-wrap">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white text-[11px] font-[950] shrink-0 ${avatarBg[user.role] ?? "bg-slate-500"}`}>
                  {getInitials(user.full_name)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-[950] text-sm truncate">
                    {user.full_name?.trim() || <span className="opacity-40">Sin nombre</span>}
                  </div>
                  <div className="text-xs opacity-60 font-[800] truncate">{user.email ?? "—"}</div>
                </div>
                <span className={`text-[11px] font-[950] px-2 py-0.5 rounded-full shrink-0 ${rolePill[user.role] ?? "bg-gray-100 text-gray-700"}`}>
                  {ROLE_LABELS[user.role] ?? user.role}
                </span>
                {!user.last_sign_in_at && (
                  <span className="text-[11px] font-[950] px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 shrink-0">
                    Sin acceso
                  </span>
                )}
                <div className="flex gap-1.5 shrink-0">
                  <button onClick={() => onEditAreas(user)} className="px-2 py-1 rounded-lg border border-black/15 bg-white text-[11px] font-[950] cursor-pointer">Áreas</button>
                  <button onClick={() => onEdit(user)} className="px-2 py-1 rounded-lg border border-black/15 bg-white text-[11px] font-[950] cursor-pointer">Editar</button>
                  <button onClick={() => onDelete(user)} className="px-2 py-1 rounded-lg border border-[rgba(220,20,60,0.4)] bg-[rgba(220,20,60,0.06)] text-[crimson] text-[11px] font-[950] cursor-pointer">Borrar</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

export default function UsersPageClient({
  initialProfile,
  hotelId,
}: {
  initialProfile: Profile;
  hotelId: string;
}) {
  const router = useRouter();
  const toast = useToast();

  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState<string | null>(null);
  const [users, setUsers]       = useState<UserRow[]>([]);
  const [busyId, setBusyId]     = useState<string | null>(null);

  // Filters
  const [search, setSearch]           = useState("");
  const [filterRole, setFilterRole]   = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");

  // Pagination
  const [page, setPage] = useState(1);

  // Selection
  const [selected, setSelected] = useState<Set<string>>(new Set());

  // Delete modal
  const [deleteTarget, setDeleteTarget] = useState<UserRow | null>(null);
  const [deleteInput, setDeleteInput]   = useState("");
  const [deleting, setDeleting]         = useState(false);

  // Area modal
  const [areaTarget, setAreaTarget]     = useState<UserRow | null>(null);
  const [allAreas, setAllAreas]         = useState<{ id: string; name: string; type: string | null }[]>([]);
  const [areaSelected, setAreaSelected] = useState<string[]>([]);
  const [areaSaving, setAreaSaving]     = useState(false);

  // Activity modal
  const [activityTarget, setActivityTarget]   = useState<UserRow | null>(null);
  const [activityRuns, setActivityRuns]       = useState<any[]>([]);
  const [activityLoading, setActivityLoading] = useState(false);

  // Resend invite
  const [resendingId, setResendingId] = useState<string | null>(null);
  const [bulkSending, setBulkSending] = useState(false);
  const [bulkSendProgress, setBulkSendProgress] = useState<{ done: number; total: number } | null>(null);

  // Audit log modal (feature 18)
  const [logOpen, setLogOpen]           = useState(false);
  const [logEntries, setLogEntries]     = useState<any[]>([]);
  const [logLoading, setLogLoading]     = useState(false);

  // View mode: table | tree (feature 25)
  const [viewMode, setViewMode] = useState<"table" | "tree">("table");

  const assignableRoles = useMemo(
    () => getAssignableRoles(initialProfile.role).filter((r) => r !== "superadmin"),
    [initialProfile.role]
  );

  // ── Auth token ────────────────────────────────────────────────────────────

  async function getToken() {
    const { data } = await supabase.auth.getSession();
    const t = data?.session?.access_token;
    if (!t) throw new Error("Sesión inválida.");
    return t;
  }

  // ── Data loading ──────────────────────────────────────────────────────────

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const t = await getToken();
      const res = await fetch("/api/admin/users", {
        headers: { Authorization: `Bearer ${t}` },
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error ?? "No se pudieron cargar los usuarios.");
      setUsers((json?.users ?? []) as UserRow[]);
    } catch (e: any) {
      setError(e?.message ?? "Error cargando usuarios.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void load(); }, []);

  // ── Derived ───────────────────────────────────────────────────────────────

  const filtered = useMemo(() => {
    let r = users;
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      r = r.filter(
        (u) =>
          (u.full_name ?? "").toLowerCase().includes(q) ||
          (u.email ?? "").toLowerCase().includes(q)
      );
    }
    if (filterRole !== "all") r = r.filter((u) => u.role === filterRole);
    if (filterStatus === "active")   r = r.filter((u) => u.active && !!u.last_sign_in_at);
    if (filterStatus === "inactive") r = r.filter((u) => !u.active);
    if (filterStatus === "pending")  r = r.filter((u) => !u.last_sign_in_at);
    return r;
  }, [users, search, filterRole, filterStatus]);

  useEffect(() => setPage(1), [search, filterRole, filterStatus]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paged = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const roleSummary = useMemo(() => {
    const c: Record<string, number> = {};
    for (const u of users) c[u.role] = (c[u.role] ?? 0) + 1;
    return Object.entries(c).sort((a, b) => b[1] - a[1]);
  }, [users]);

  const allPageSelected =
    paged.length > 0 && paged.every((u) => selected.has(u.id));

  function toggleSelectAll() {
    setSelected((prev) => {
      const s = new Set(prev);
      if (allPageSelected) paged.forEach((u) => s.delete(u.id));
      else paged.forEach((u) => s.add(u.id));
      return s;
    });
  }

  // ── Inline edits ──────────────────────────────────────────────────────────

  async function patchUser(userId: string, body: Record<string, unknown>) {
    const t = await getToken();
    const res = await fetch(`/api/admin/users/${userId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${t}` },
      body: JSON.stringify(body),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(json?.error ?? "Error al guardar.");
  }

  async function inlineRole(user: UserRow, role: Role) {
    if (role === user.role) return;
    setBusyId(user.id);
    try {
      await patchUser(user.id, { role });
      setUsers((prev) => prev.map((u) => (u.id === user.id ? { ...u, role } : u)));
      toast.success("Rol actualizado.");
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setBusyId(null);
    }
  }

  async function inlineActive(user: UserRow) {
    if (user.id === initialProfile.id) {
      toast.error("No puedes desactivarte a ti mismo.");
      return;
    }
    const active = !user.active;
    setBusyId(user.id);
    try {
      await patchUser(user.id, { active });
      setUsers((prev) => prev.map((u) => (u.id === user.id ? { ...u, active } : u)));
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setBusyId(null);
    }
  }

  // ── Delete ────────────────────────────────────────────────────────────────

  async function confirmDelete() {
    if (!deleteTarget || deleteInput.trim().toUpperCase() !== "BORRAR") return;
    setDeleting(true);
    try {
      const t = await getToken();
      const res = await fetch(`/api/admin/users/${deleteTarget.id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${t}` },
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error ?? "No se pudo borrar.");
      setUsers((prev) => prev.filter((u) => u.id !== deleteTarget.id));
      setSelected((prev) => { const s = new Set(prev); s.delete(deleteTarget.id); return s; });
      toast.success("Usuario eliminado.");
      setDeleteTarget(null);
      setDeleteInput("");
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setDeleting(false);
    }
  }

  async function bulkDelete() {
    const ids = [...selected].filter((id) => id !== initialProfile.id);
    if (!ids.length) {
      toast.error("Sin usuarios seleccionables (o no puedes borrarte a ti mismo).");
      return;
    }
    if (!confirm(`¿Borrar permanentemente ${ids.length} usuario${ids.length !== 1 ? "s" : ""}?`)) return;
    for (const id of ids) {
      try {
        const t = await getToken();
        const res = await fetch(`/api/admin/users/${id}`, {
          method: "DELETE",
          headers: { Authorization: `Bearer ${t}` },
        });
        const json = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(json?.error ?? "Error");
        setUsers((prev) => prev.filter((u) => u.id !== id));
      } catch (e: any) {
        toast.error(`Error borrando ${id.slice(0, 8)}: ${e.message}`);
      }
    }
    setSelected(new Set());
    toast.success("Operación completada.");
  }

  // ── Resend invite (16) ───────────────────────────────────────────────────

  async function resendInvite(user: UserRow) {
    setResendingId(user.id);
    try {
      const t = await getToken();
      const res = await fetch(`/api/admin/users/${user.id}/resend-invite`, {
        method: "POST",
        headers: { Authorization: `Bearer ${t}` },
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error ?? "No se pudo reenviar.");
      toast.success("Invitación reenviada.");
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setResendingId(null);
    }
  }

  // ── Bulk resend invite ───────────────────────────────────────────────────

  async function bulkResendInvite(ids: string[]) {
    if (!ids.length) return;
    setBulkSending(true);
    setBulkSendProgress({ done: 0, total: ids.length });
    let ok = 0;
    let failed = 0;
    for (const id of ids) {
      try {
        const t = await getToken();
        const res = await fetch(`/api/admin/users/${id}/resend-invite`, {
          method: "POST",
          headers: { Authorization: `Bearer ${t}` },
        });
        if (res.ok) ok++;
        else failed++;
      } catch {
        failed++;
      }
      setBulkSendProgress((p) => p ? { done: p.done + 1, total: p.total } : null);
    }
    setBulkSending(false);
    setBulkSendProgress(null);
    if (failed === 0) toast.success(`Invitación enviada a ${ok} usuario${ok !== 1 ? "s" : ""}.`);
    else toast.error(`${ok} enviadas, ${failed} fallaron.`);
  }

  // ── Audit log (18) ───────────────────────────────────────────────────────

  async function openLog() {
    setLogOpen(true);
    setLogEntries([]);
    setLogLoading(true);
    try {
      const t = await getToken();
      const res = await fetch("/api/admin/audit-log", {
        headers: { Authorization: `Bearer ${t}` },
      });
      const json = await res.json().catch(() => ({}));
      if (res.ok) setLogEntries(json?.entries ?? []);
    } catch { /* silent */ } finally {
      setLogLoading(false);
    }
  }

  // ── Area modal ────────────────────────────────────────────────────────────

  async function openAreaModal(user: UserRow) {
    setAreaTarget(user);
    setAreaSelected(user.areas.map((a) => a.id));
    const { data } = await supabase
      .from("areas")
      .select("id,name,type,active")
      .eq("hotel_id", hotelId)
      .eq("active", true)
      .order("name");
    setAllAreas((data ?? []) as any);
  }

  async function saveAreas() {
    if (!areaTarget) return;
    setAreaSaving(true);
    try {
      const t = await getToken();
      const res = await fetch("/api/admin/user-area-access/set", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${t}` },
        body: JSON.stringify({ user_id: areaTarget.id, area_ids: areaSelected }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error ?? "Error guardando áreas.");
      const newAreas = allAreas
        .filter((a) => areaSelected.includes(a.id))
        .map((a) => ({ id: a.id, name: a.name }));
      setUsers((prev) =>
        prev.map((u) => (u.id === areaTarget.id ? { ...u, areas: newAreas } : u))
      );
      toast.success("Áreas actualizadas.");
      setAreaTarget(null);
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setAreaSaving(false);
    }
  }

  // ── Activity modal ────────────────────────────────────────────────────────

  async function openActivity(user: UserRow) {
    setActivityTarget(user);
    setActivityRuns([]);
    setActivityLoading(true);
    try {
      const t = await getToken();
      const res = await fetch(`/api/admin/users/${user.id}/activity`, {
        headers: { Authorization: `Bearer ${t}` },
      });
      const json = await res.json().catch(() => ({}));
      if (res.ok) setActivityRuns(json?.runs ?? []);
    } catch { /* silent */ } finally {
      setActivityLoading(false);
    }
  }

  const hasFilters = search || filterRole !== "all" || filterStatus !== "all";
  const pendingUsers = users.filter((u) => !u.last_sign_in_at);

  // ── Render ────────────────────────────────────────────────────────────────

  if (loading || error) {
    return (
      <main className="p-4 sm:p-6">
        <BackButton fallback="/home" />
        <h1 className="text-[clamp(28px,8vw,56px)] mb-1.5">Usuarios</h1>
        {loading
          ? <div className="opacity-80">Cargando...</div>
          : <div className="text-[crimson] font-[950]">{error}</div>
        }
      </main>
    );
  }

  return (
    <main className="p-4 sm:p-6">
      <BackButton fallback="/home" />

      {/* Header */}
      <div className="flex justify-between gap-3 flex-wrap items-start">
        <div>
          <h1 className="text-[clamp(28px,8vw,56px)] mb-2">Usuarios</h1>
          {/* Role summary — clickable to filter */}
          <div className="flex flex-wrap gap-1.5">
            {roleSummary.map(([role, count]) => (
              <button
                key={role}
                onClick={() => setFilterRole(filterRole === role ? "all" : role)}
                className={`px-2.5 py-1 rounded-full text-[12px] font-[950] cursor-pointer transition-all ${ROLE_PILL[role] ?? "bg-gray-100 text-gray-700"} ${filterRole === role ? "ring-2 ring-offset-1 ring-current" : ""}`}
              >
                {ROLE_LABELS[role as Role] ?? role} · {count}
              </button>
            ))}
          </div>
        </div>
        <div className="flex gap-2.5 items-center flex-wrap">
          <button
            onClick={openLog}
            className="px-4 py-2.5 rounded-xl border border-black/20 bg-white text-black font-[950] cursor-pointer h-11 whitespace-nowrap text-sm"
          >
            Log de cambios
          </button>
          <button
            onClick={() => exportCSV(filtered)}
            className="px-4 py-2.5 rounded-xl border border-black/20 bg-white text-black font-[950] cursor-pointer h-11 whitespace-nowrap text-sm"
          >
            Exportar CSV
          </button>
          {pendingUsers.length > 0 && (
            <button
              onClick={() => {
                if (!confirm(`Enviar email de bienvenida a ${pendingUsers.length} usuario${pendingUsers.length !== 1 ? "s" : ""} que aún no han accedido?`)) return;
                void bulkResendInvite(pendingUsers.map((u) => u.id));
              }}
              disabled={bulkSending}
              className="px-4 py-2.5 rounded-xl border border-amber-300 bg-amber-50 text-amber-800 font-[950] cursor-pointer h-11 whitespace-nowrap text-sm disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {bulkSending && bulkSendProgress
                ? `Enviando ${bulkSendProgress.done}/${bulkSendProgress.total}...`
                : `Enviar a pendientes (${pendingUsers.length})`}
            </button>
          )}
          <button
            onClick={() => router.push("/users/new")}
            className="px-4 py-3 rounded-xl border border-black/20 bg-black text-white font-[950] cursor-pointer h-11 whitespace-nowrap"
          >
            + Crear usuario
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="mt-4 flex gap-2.5 flex-wrap items-center">
        <input
          type="search"
          placeholder="Buscar nombre o email..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="h-10 px-3 rounded-xl border border-black/20 text-sm font-[800] min-w-[200px] flex-1 max-w-xs bg-white"
        />
        <select
          value={filterRole}
          onChange={(e) => setFilterRole(e.target.value)}
          className="h-10 px-3 rounded-xl border border-black/20 text-sm font-[800] bg-white cursor-pointer"
        >
          <option value="all">Todos los roles</option>
          {assignableRoles.map((r) => (
            <option key={r} value={r}>{ROLE_LABELS[r]}</option>
          ))}
        </select>
        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          className="h-10 px-3 rounded-xl border border-black/20 text-sm font-[800] bg-white cursor-pointer"
        >
          <option value="all">Todos los estados</option>
          <option value="active">Activos</option>
          <option value="inactive">Inactivos</option>
          <option value="pending">Sin acceso (nunca entraron)</option>
        </select>
        {hasFilters && (
          <button
            onClick={() => { setSearch(""); setFilterRole("all"); setFilterStatus("all"); }}
            className="h-10 px-3 rounded-xl border border-black/20 bg-white text-sm font-[950] cursor-pointer"
          >
            Limpiar ×
          </button>
        )}
        <div className="flex items-center gap-1 ml-auto">
          <span className="text-sm opacity-60 font-[800] mr-2">
            {filtered.length} usuario{filtered.length !== 1 ? "s" : ""}
          </span>
          <button
            onClick={() => setViewMode("table")}
            title="Vista tabla"
            className={`h-9 w-9 rounded-lg border font-[950] text-sm cursor-pointer flex items-center justify-center ${viewMode === "table" ? "bg-black text-white border-black" : "bg-white border-black/20"}`}
          >
            ☰
          </button>
          <button
            onClick={() => setViewMode("tree")}
            title="Vista árbol"
            className={`h-9 w-9 rounded-lg border font-[950] text-sm cursor-pointer flex items-center justify-center ${viewMode === "tree" ? "bg-black text-white border-black" : "bg-white border-black/20"}`}
          >
            ⊞
          </button>
        </div>
      </div>

      {/* Bulk action bar */}
      {selected.size > 0 && (
        <div className="mt-3 flex items-center gap-3 px-4 py-2.5 rounded-xl bg-black/[0.04] border border-black/10 flex-wrap">
          <span className="font-[950] text-sm">
            {selected.size} seleccionado{selected.size !== 1 ? "s" : ""}
          </span>
          <button
            onClick={() => {
              const ids = [...selected].filter((id) =>
                users.find((u) => u.id === id && !u.last_sign_in_at)
              );
              if (!ids.length) { toast.error("Ninguno de los seleccionados está pendiente de acceso."); return; }
              if (!confirm(`Enviar email de bienvenida a ${ids.length} usuario${ids.length !== 1 ? "s" : ""}?`)) return;
              void bulkResendInvite(ids);
            }}
            disabled={bulkSending}
            className="px-3 py-1.5 rounded-lg border border-amber-300 bg-amber-50 text-amber-800 font-[950] text-sm cursor-pointer disabled:opacity-50"
          >
            Enviar invitación
          </button>
          <button
            onClick={bulkDelete}
            className="px-3 py-1.5 rounded-lg border border-[rgba(220,20,60,0.4)] bg-[rgba(220,20,60,0.08)] text-[crimson] font-[950] text-sm cursor-pointer"
          >
            Borrar seleccionados
          </button>
          <button
            onClick={() => setSelected(new Set())}
            className="px-3 py-1.5 rounded-lg border border-black/20 bg-white font-[950] text-sm cursor-pointer"
          >
            Cancelar
          </button>
        </div>
      )}

      {/* ── Tree view (feature 25) ── */}
      {viewMode === "tree" && (
        <TreeView
          users={filtered}
          onEditAreas={openAreaModal}
          onEdit={(u: UserRow) => router.push(`/users/${u.id}`)}
          onDelete={(u: UserRow) => { setDeleteTarget(u); setDeleteInput(""); }}
          rolePill={ROLE_PILL}
          avatarBg={AVATAR_BG}
          initials={initials}
        />
      )}

      {/* Table */}
      {viewMode === "table" && <div className="mt-[18px] rounded-[18px] border border-black/[0.08] bg-white/75 overflow-x-auto">
        <div
          className="grid min-w-[780px]"
          style={{
            gridTemplateColumns: "40px minmax(160px,2fr) minmax(150px,2fr) 150px 90px minmax(90px,1fr) 110px auto",
          }}
        >
          {/* Header */}
          {(["", "Nombre", "Email", "Rol", "Estado", "Áreas", "Último acceso", ""] as const).map(
            (label, i) => (
              <div
                key={i}
                className="px-3 py-[13px] border-b border-black/[0.06] bg-white/85 font-[950] text-sm flex items-center"
              >
                {i === 0 ? (
                  <input
                    type="checkbox"
                    checked={allPageSelected}
                    onChange={toggleSelectAll}
                    className="cursor-pointer"
                  />
                ) : (
                  label
                )}
              </div>
            )
          )}

          {/* Rows */}
          {paged.map((user) => {
            const isSelf    = user.id === initialProfile.id;
            const isPending = !user.last_sign_in_at;
            const isBusy    = busyId === user.id;
            const roleOptions = (assignableRoles as Role[]).includes(user.role)
              ? (assignableRoles as Role[])
              : [user.role, ...(assignableRoles as Role[])];

            return (
              <div key={user.id} className={`contents ${isBusy ? "opacity-60 pointer-events-none" : ""}`}>
                {/* Checkbox */}
                <div className="px-3 py-[14px] border-b border-black/[0.05] flex items-center">
                  <input
                    type="checkbox"
                    checked={selected.has(user.id)}
                    onChange={() =>
                      setSelected((prev) => {
                        const s = new Set(prev);
                        s.has(user.id) ? s.delete(user.id) : s.add(user.id);
                        return s;
                      })
                    }
                    className="cursor-pointer"
                  />
                </div>

                {/* Avatar + Name */}
                <div className="px-3 py-[14px] border-b border-black/[0.05] flex items-center gap-2.5 min-w-0">
                  <div
                    className={`w-8 h-8 rounded-full flex items-center justify-center text-white text-[11px] font-[950] shrink-0 ${AVATAR_BG[user.role] ?? "bg-slate-500"}`}
                  >
                    {initials(user.full_name)}
                  </div>
                  <div className="min-w-0">
                    <div className="font-[950] truncate flex items-center gap-1.5">
                      {user.full_name?.trim() || (
                        <span className="opacity-40 font-[800]">Sin nombre</span>
                      )}
                      {isSelf && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-black text-white font-[950] shrink-0">
                          Tú
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Email */}
                <div className="px-3 py-[14px] border-b border-black/[0.05] flex items-center min-w-0">
                  <span className="font-[800] opacity-90 truncate text-sm">
                    {user.email ?? "—"}
                  </span>
                </div>

                {/* Rol — inline select */}
                <div className="px-3 py-[14px] border-b border-black/[0.05] flex items-center">
                  <select
                    value={user.role}
                    disabled={isBusy}
                    onChange={(e) => inlineRole(user, e.target.value as Role)}
                    className={`w-full h-8 px-2 rounded-lg border border-black/15 text-[12px] font-[950] cursor-pointer ${ROLE_PILL[user.role] ?? "bg-gray-100 text-gray-700"} disabled:opacity-60 disabled:cursor-default`}
                  >
                    {roleOptions.map((r) => (
                      <option key={r} value={r}>{ROLE_LABELS[r as Role] ?? r}</option>
                    ))}
                  </select>
                </div>

                {/* Estado — inline toggle */}
                <div className="px-3 py-[14px] border-b border-black/[0.05] flex items-center">
                  {isPending ? (
                    <span className="text-[11px] font-[950] px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 whitespace-nowrap">
                      Sin acceso
                    </span>
                  ) : (
                    <button
                      onClick={() => inlineActive(user)}
                      disabled={isBusy || isSelf}
                      className={`text-[11px] font-[950] px-2 py-0.5 rounded-full cursor-pointer transition-colors whitespace-nowrap disabled:cursor-default ${user.active ? "bg-emerald-100 text-emerald-700 hover:bg-emerald-200" : "bg-red-100 text-red-700 hover:bg-red-200"}`}
                    >
                      {user.active ? "Activo" : "Inactivo"}
                    </button>
                  )}
                </div>

                {/* Áreas */}
                <div className="px-3 py-[14px] border-b border-black/[0.05] flex items-center">
                  <button
                    onClick={() => openAreaModal(user)}
                    className="text-[12px] font-[950] text-left hover:underline cursor-pointer truncate max-w-full"
                  >
                    {user.areas.length === 0 ? (
                      <span className="opacity-40">Sin áreas</span>
                    ) : user.areas.length === 1 ? (
                      user.areas[0].name
                    ) : (
                      `${user.areas.length} áreas`
                    )}
                  </button>
                </div>

                {/* Último acceso */}
                <div className="px-3 py-[14px] border-b border-black/[0.05] flex items-center">
                  <span className="text-[12px] font-[800] opacity-60 whitespace-nowrap">
                    {formatDate(user.last_sign_in_at)}
                  </span>
                </div>

                {/* Acciones */}
                <div className="px-3 py-[14px] border-b border-black/[0.05] flex items-center justify-end gap-1.5 flex-wrap">
                  {isPending && (
                    <button
                      disabled={resendingId === user.id}
                      onClick={() => resendInvite(user)}
                      className="px-2.5 py-1.5 rounded-lg border border-amber-300 bg-amber-50 text-amber-700 text-[12px] font-[950] cursor-pointer disabled:opacity-50 whitespace-nowrap"
                    >
                      {resendingId === user.id ? "Enviando..." : "Reenviar"}
                    </button>
                  )}
                  <button
                    onClick={() => openActivity(user)}
                    className="px-2.5 py-1.5 rounded-lg border border-black/15 bg-white text-[12px] font-[950] cursor-pointer whitespace-nowrap"
                  >
                    Actividad
                  </button>
                  <button
                    onClick={() => router.push(`/users/${user.id}`)}
                    className="px-2.5 py-1.5 rounded-lg border border-black/15 bg-white text-[12px] font-[950] cursor-pointer"
                  >
                    Editar
                  </button>
                  <button
                    disabled={isBusy}
                    onClick={() => { setDeleteTarget(user); setDeleteInput(""); }}
                    className="px-2.5 py-1.5 rounded-lg border border-[rgba(220,20,60,0.4)] bg-[rgba(220,20,60,0.06)] text-[crimson] text-[12px] font-[950] cursor-pointer disabled:opacity-50"
                  >
                    Borrar
                  </button>
                </div>
              </div>
            );
          })}

          {filtered.length === 0 && (
            <div className="p-6 opacity-60 [grid-column:1_/_-1] text-sm font-[800]">
              {hasFilters
                ? "No se encontraron usuarios con esos filtros."
                : "No hay usuarios para mostrar."}
            </div>
          )}
        </div>
      </div>}

      {/* Pagination (table only) */}
      {viewMode === "table" && totalPages > 1 && (
        <div className="mt-4 flex items-center justify-center gap-2 flex-wrap">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
            className="px-3 py-2 rounded-lg border border-black/20 bg-white font-[950] text-sm cursor-pointer disabled:opacity-40"
          >
            ←
          </button>
          {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
            <button
              key={p}
              onClick={() => setPage(p)}
              className={`w-9 h-9 rounded-lg border font-[950] text-sm cursor-pointer ${p === page ? "border-black bg-black text-white" : "border-black/20 bg-white"}`}
            >
              {p}
            </button>
          ))}
          <button
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
            className="px-3 py-2 rounded-lg border border-black/20 bg-white font-[950] text-sm cursor-pointer disabled:opacity-40"
          >
            →
          </button>
        </div>
      )}

      {/* ── Delete modal ── */}
      {deleteTarget && (
        <div
          className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4"
          onClick={(e) => {
            if (e.target === e.currentTarget) { setDeleteTarget(null); setDeleteInput(""); }
          }}
        >
          <div className="bg-white rounded-2xl p-6 max-w-sm w-full shadow-xl">
            <h2 className="font-[950] text-lg">Borrar usuario</h2>
            <p className="mt-2 text-sm opacity-80">
              Vas a eliminar permanentemente a{" "}
              <strong>{deleteTarget.full_name ?? deleteTarget.email ?? "este usuario"}</strong>.
            </p>
            {deleteTarget.audit_run_count > 0 && (
              <div className="mt-2.5 p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-sm font-[800]">
                ⚠ Este usuario tiene {deleteTarget.audit_run_count} auditoría
                {deleteTarget.audit_run_count !== 1 ? "s" : ""} registrada
                {deleteTarget.audit_run_count !== 1 ? "s" : ""}.
              </div>
            )}
            <input
              value={deleteInput}
              onChange={(e) => setDeleteInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") void confirmDelete(); }}
              placeholder="Escribe BORRAR para confirmar"
              className="mt-3 w-full px-3 py-2.5 rounded-xl border border-black/20 font-[800] text-sm"
              autoFocus
            />
            <div className="mt-3 flex gap-2.5">
              <button
                onClick={() => void confirmDelete()}
                disabled={deleting || deleteInput.trim().toUpperCase() !== "BORRAR"}
                className="flex-1 py-2.5 rounded-xl bg-[crimson] text-white font-[950] cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {deleting ? "Borrando..." : "Confirmar"}
              </button>
              <button
                onClick={() => { setDeleteTarget(null); setDeleteInput(""); }}
                className="flex-1 py-2.5 rounded-xl border border-black/20 bg-white font-[950] cursor-pointer"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Area modal ── */}
      {areaTarget && (
        <div
          className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4"
          onClick={(e) => { if (e.target === e.currentTarget) setAreaTarget(null); }}
        >
          <div className="bg-white rounded-2xl p-6 max-w-sm w-full shadow-xl max-h-[80vh] flex flex-col">
            <h2 className="font-[950] text-lg shrink-0">Áreas de acceso</h2>
            <p className="text-sm opacity-60 mt-0.5 shrink-0 font-[800]">
              {areaTarget.full_name ?? areaTarget.email}
            </p>
            <div className="mt-3 overflow-y-auto flex-1 grid gap-1.5">
              {allAreas.length === 0 ? (
                <p className="text-sm opacity-60">No hay áreas activas.</p>
              ) : (
                allAreas.map((a) => (
                  <label
                    key={a.id}
                    className="flex items-center gap-2.5 p-2.5 rounded-xl border border-black/[0.08] cursor-pointer hover:bg-black/[0.02]"
                  >
                    <input
                      type="checkbox"
                      checked={areaSelected.includes(a.id)}
                      onChange={() =>
                        setAreaSelected((prev) =>
                          prev.includes(a.id)
                            ? prev.filter((id) => id !== a.id)
                            : [...prev, a.id]
                        )
                      }
                      className="cursor-pointer"
                    />
                    <span className="font-[900] text-sm">{a.name}</span>
                    {a.type && <span className="opacity-50 text-xs">{a.type}</span>}
                  </label>
                ))
              )}
            </div>
            <div className="mt-4 flex gap-2.5 shrink-0">
              <button
                onClick={() => void saveAreas()}
                disabled={areaSaving}
                className="flex-1 py-2.5 rounded-xl bg-black text-white font-[950] cursor-pointer disabled:opacity-50"
              >
                {areaSaving ? "Guardando..." : "Guardar"}
              </button>
              <button
                onClick={() => setAreaTarget(null)}
                className="flex-1 py-2.5 rounded-xl border border-black/20 bg-white font-[950] cursor-pointer"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Activity modal ── */}
      {activityTarget && (
        <div
          className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4"
          onClick={(e) => { if (e.target === e.currentTarget) setActivityTarget(null); }}
        >
          <div className="bg-white rounded-2xl p-6 max-w-lg w-full shadow-xl max-h-[80vh] flex flex-col">
            <div className="flex justify-between items-start shrink-0">
              <div>
                <h2 className="font-[950] text-lg">Actividad reciente</h2>
                <p className="text-sm opacity-60 mt-0.5 font-[800]">
                  {activityTarget.full_name ?? activityTarget.email}
                  {" · "}
                  {activityTarget.audit_run_count} auditoría
                  {activityTarget.audit_run_count !== 1 ? "s" : ""} en total
                </p>
              </div>
              <button
                onClick={() => setActivityTarget(null)}
                className="text-xl font-[950] opacity-40 cursor-pointer leading-none ml-4 shrink-0"
              >
                ×
              </button>
            </div>
            <div className="mt-4 overflow-y-auto flex-1">
              {activityLoading ? (
                <p className="text-sm opacity-60">Cargando...</p>
              ) : activityRuns.length === 0 ? (
                <p className="text-sm opacity-60">Sin auditorías registradas.</p>
              ) : (
                <div className="grid gap-2">
                  {activityRuns.map((run: any) => (
                    <div key={run.id} className="p-3 rounded-xl border border-black/[0.08]">
                      <div className="font-[900] text-sm">
                        {run.template_name ?? "Auditoría"}
                      </div>
                      <div className="flex flex-wrap gap-3 mt-1 text-xs opacity-60 font-[800] items-center">
                        {run.area_name && <span>{run.area_name}</span>}
                        {run.executed_at && (
                          <span>
                            {new Date(run.executed_at).toLocaleDateString("es-ES")}
                          </span>
                        )}
                        {run.score != null && <span>{run.score}%</span>}
                        <span
                          className={`px-1.5 py-0.5 rounded-full text-[10px] font-[950] ${run.status === "submitted" ? "bg-emerald-100 text-emerald-700" : "bg-gray-100 text-gray-600"}`}
                        >
                          {run.status}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Audit log modal (18) ── */}
      {logOpen && (
        <div
          className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4"
          onClick={(e) => { if (e.target === e.currentTarget) setLogOpen(false); }}
        >
          <div className="bg-white rounded-2xl p-6 max-w-xl w-full shadow-xl max-h-[80vh] flex flex-col">
            <div className="flex justify-between items-center shrink-0">
              <h2 className="font-[950] text-lg">Log de cambios</h2>
              <button onClick={() => setLogOpen(false)} className="text-xl font-[950] opacity-40 cursor-pointer leading-none">×</button>
            </div>
            <div className="mt-4 overflow-y-auto flex-1">
              {logLoading ? (
                <p className="text-sm opacity-60">Cargando...</p>
              ) : logEntries.length === 0 ? (
                <p className="text-sm opacity-60">Sin cambios registrados aún.</p>
              ) : (
                <div className="grid gap-1.5">
                  {logEntries.map((e: any) => (
                    <div key={e.id} className="flex items-start gap-3 p-3 rounded-xl border border-black/[0.07]">
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-[900]">
                          {ACTION_LABELS[e.action as string] ?? e.action}
                          {" — "}
                          <span className="font-[800] opacity-80">{e.target_name ?? "—"}</span>
                        </div>
                        {(e.old_value || e.new_value) && (
                          <div className="text-xs opacity-60 font-[800] mt-0.5">
                            {e.old_value && <span className="line-through mr-1">{e.old_value}</span>}
                            {e.new_value && <span className="text-emerald-700">{e.new_value}</span>}
                          </div>
                        )}
                        <div className="text-xs opacity-40 font-[800] mt-0.5">
                          por {e.actor_name ?? "—"}
                        </div>
                      </div>
                      <div className="text-[11px] opacity-50 font-[800] whitespace-nowrap shrink-0">
                        {e.created_at
                          ? new Date(e.created_at).toLocaleString("es-ES", { dateStyle: "short", timeStyle: "short" })
                          : "—"}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
