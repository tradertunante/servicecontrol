// app/user-management/page.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import HotelHeader from "@/app/components/HotelHeader";
import { supabase } from "@/lib/supabaseClient";

type Role = "admin" | "manager" | "auditor" | "superadmin";
type Status = "active" | "inactive";

type UserRow = {
  id: string;
  username: string;
  full_name: string;
  email: string | null;
  position: string;
  role: Role;
  status: Status;
  mfa: string;
};

type AreaRow = {
  id: string;
  name: string;
  type: string | null;
  sort_order?: number | null;
  active?: boolean | null;
};

type AuditTemplateRow = {
  id: string;
  name: string;
  active: boolean | null;
  area_id: string | null;
  created_at?: string | null;
};

type HotelRow = {
  id: string;
  name: string;
  created_at?: string | null;
};

const HOTEL_KEY = "sc_hotel_id";
const HOTEL_CHANGED_EVENT = "sc-hotel-changed";

type ViewMode = "hotel-info" | "areas" | "users" | "area-audits";

export default function UserManagementPage() {
  const router = useRouter();

  const [activeHotelId, setActiveHotelId] = useState<string | null>(null);

  useEffect(() => {
    const readHotel = () => {
      try {
        setActiveHotelId(localStorage.getItem(HOTEL_KEY));
      } catch {
        setActiveHotelId(null);
      }
    };

    readHotel();
    window.addEventListener(HOTEL_CHANGED_EVENT, readHotel);
    window.addEventListener("storage", readHotel);

    return () => {
      window.removeEventListener(HOTEL_CHANGED_EVENT, readHotel);
      window.removeEventListener("storage", readHotel);
    };
  }, []);

  async function getBearer() {
    const { data } = await supabase.auth.getSession();
    return data.session?.access_token ?? null;
  }

  const [viewMode, setViewMode] = useState<ViewMode>("hotel-info");

  // ----------------------------
  // Hotel info
  // ----------------------------
  const [hotel, setHotel] = useState<HotelRow | null>(null);
  const [hotelLoading, setHotelLoading] = useState(false);
  const [hotelError, setHotelError] = useState("");

  async function loadHotelInfo() {
    setHotelError("");

    if (!activeHotelId) {
      setHotel(null);
      return;
    }

    setHotelLoading(true);
    try {
      const { data, error } = await supabase
        .from("hotels")
        .select("id, name, created_at")
        .eq("id", activeHotelId)
        .single();

      if (error) throw error;
      setHotel((data ?? null) as any);
    } catch (e: any) {
      setHotel(null);
      setHotelError(e?.message || "No se pudo cargar info del hotel (¿existe tabla hotels?).");
    } finally {
      setHotelLoading(false);
    }
  }

  // ----------------------------
  // Áreas
  // ----------------------------
  const [areas, setAreas] = useState<AreaRow[]>([]);
  const [areasLoading, setAreasLoading] = useState(false);
  const [areasError, setAreasError] = useState("");

  const [areaQuery, setAreaQuery] = useState("");
  const [selectedAreaId, setSelectedAreaId] = useState<string | null>(null);

  const selectedArea = useMemo(
    () => areas.find((a) => a.id === selectedAreaId) ?? null,
    [areas, selectedAreaId]
  );

  async function loadAreas() {
    setAreasError("");

    if (!activeHotelId) {
      setAreas([]);
      return;
    }

    setAreasLoading(true);
    try {
      const { data, error } = await supabase
        .from("areas")
        .select("id, name, type, sort_order, active")
        .eq("hotel_id", activeHotelId)
        .order("sort_order", { ascending: true })
        .order("name", { ascending: true });

      if (error) throw error;
      setAreas((data ?? []) as any);
    } catch (e: any) {
      setAreas([]);
      setAreasError(e?.message || "Error cargando áreas.");
    } finally {
      setAreasLoading(false);
    }
  }

  const filteredAreas = useMemo(() => {
    const needle = areaQuery.trim().toLowerCase();
    if (!needle) return areas;
    return areas.filter((a) => (a.name ?? "").toLowerCase().includes(needle));
  }, [areas, areaQuery]);

  // Modal Crear/Editar Área
  const [areaModalOpen, setAreaModalOpen] = useState(false);
  const [areaModalMode, setAreaModalMode] = useState<"create" | "edit">("create");
  const [areaFormId, setAreaFormId] = useState<string | null>(null);
  const [areaFormName, setAreaFormName] = useState("");
  const [areaFormType, setAreaFormType] = useState("");
  const [areaFormSort, setAreaFormSort] = useState<string>("");
  const [areaFormActive, setAreaFormActive] = useState(true);
  const [areaFormBusy, setAreaFormBusy] = useState(false);
  const [areaFormError, setAreaFormError] = useState("");

  function openCreateArea() {
    setAreaModalMode("create");
    setAreaFormId(null);
    setAreaFormName("");
    setAreaFormType("");
    setAreaFormSort("");
    setAreaFormActive(true);
    setAreaFormError("");
    setAreaModalOpen(true);
  }

  function openEditArea(a: AreaRow) {
    setAreaModalMode("edit");
    setAreaFormId(a.id);
    setAreaFormName(a.name ?? "");
    setAreaFormType(a.type ?? "");
    setAreaFormSort(typeof a.sort_order === "number" ? String(a.sort_order) : "");
    setAreaFormActive((a.active ?? true) === true);
    setAreaFormError("");
    setAreaModalOpen(true);
  }

  async function saveArea() {
    setAreaFormError("");

    if (!activeHotelId) {
      setAreaFormError("No hay hotel seleccionado.");
      return;
    }

    const name = areaFormName.trim();
    if (!name) {
      setAreaFormError("El nombre del área es obligatorio.");
      return;
    }

    const sort_order = areaFormSort.trim() === "" ? null : Number(areaFormSort.trim());
    if (sort_order !== null && Number.isNaN(sort_order)) {
      setAreaFormError("Orden debe ser un número.");
      return;
    }

    setAreaFormBusy(true);
    try {
      if (areaModalMode === "create") {
        const { error } = await supabase.from("areas").insert({
          hotel_id: activeHotelId,
          name,
          type: areaFormType.trim() || null,
          sort_order,
          active: areaFormActive,
        });
        if (error) throw error;
      } else {
        if (!areaFormId) throw new Error("Falta id del área.");
        const { error } = await supabase
          .from("areas")
          .update({
            name,
            type: areaFormType.trim() || null,
            sort_order,
            active: areaFormActive,
          })
          .eq("id", areaFormId);
        if (error) throw error;
      }

      setAreaModalOpen(false);
      await loadAreas();
    } catch (e: any) {
      setAreaFormError(e?.message || "No se pudo guardar el área.");
    } finally {
      setAreaFormBusy(false);
    }
  }

  async function toggleAreaActive(areaId: string, nextActive: boolean) {
    if (!activeHotelId) return;
    try {
      const { error } = await supabase
        .from("areas")
        .update({ active: nextActive })
        .eq("id", areaId)
        .eq("hotel_id", activeHotelId);
      if (error) throw error;

      setAreas((prev) => prev.map((a) => (a.id === areaId ? { ...a, active: nextActive } : a)));
    } catch (e) {
      console.error(e);
      alert("No se pudo cambiar el estado del área.");
    }
  }

  async function deleteArea(areaId: string) {
    if (!activeHotelId) return;

    const ok = confirm("¿Seguro que quieres BORRAR esta área? (puede afectar auditorías asociadas)");
    if (!ok) return;

    try {
      const { error } = await supabase.from("areas").delete().eq("id", areaId).eq("hotel_id", activeHotelId);
      if (error) throw error;

      if (selectedAreaId === areaId) {
        setSelectedAreaId(null);
        setViewMode("areas");
      }

      await loadAreas();
    } catch (e: any) {
      console.error(e);
      alert(e?.message || "No se pudo borrar el área.");
    }
  }

  // ----------------------------
  // Usuarios
  // ----------------------------
  const [users, setUsers] = useState<UserRow[]>([]);
  const [usersLoading, setUsersLoading] = useState(true);
  const [usersError, setUsersError] = useState("");

  const [userQuery, setUserQuery] = useState("");
  const [userRoleFilter, setUserRoleFilter] = useState<"all" | Role>("all");
  const [userStatusFilter, setUserStatusFilter] = useState<"all" | Status>("all");

  async function loadUsers() {
    setUsersError("");

    if (!activeHotelId) {
      setUsers([]);
      setUsersLoading(false);
      setUsersError("No hay hotel seleccionado.");
      return;
    }

    const token = await getBearer();
    if (!token) {
      setUsers([]);
      setUsersLoading(false);
      setUsersError("No autorizado (sin sesión).");
      return;
    }

    setUsersLoading(true);
    try {
      const res = await fetch(`/api/user-management/users?hotel_id=${encodeURIComponent(activeHotelId)}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const json = await res.json().catch(() => ({} as any));
      if (!res.ok || !json?.ok) throw new Error(json?.error || `Error HTTP ${res.status}`);
      setUsers((json.users || []) as UserRow[]);
    } catch (e: any) {
      console.error(e);
      setUsersError(e?.message || "Error cargando usuarios.");
      setUsers([]);
    } finally {
      setUsersLoading(false);
    }
  }

  const filteredUsers = useMemo(() => {
    const needle = userQuery.trim().toLowerCase();
    return users.filter((u) => {
      if (needle) {
        const hay = `${u.full_name ?? ""} ${u.username ?? ""} ${u.email ?? ""} ${u.role ?? ""}`.toLowerCase();
        if (!hay.includes(needle)) return false;
      }
      if (userRoleFilter !== "all" && u.role !== userRoleFilter) return false;
      if (userStatusFilter !== "all" && u.status !== userStatusFilter) return false;
      return true;
    });
  }, [users, userQuery, userRoleFilter, userStatusFilter]);

  // Modal Editar Usuario (con borrar dentro)
  const [userModalOpen, setUserModalOpen] = useState(false);
  const [userFormBusy, setUserFormBusy] = useState(false);
  const [userFormError, setUserFormError] = useState("");

  const [userFormId, setUserFormId] = useState<string | null>(null);
  const [userFormName, setUserFormName] = useState("");
  const [userFormEmail, setUserFormEmail] = useState("");
  const [userFormRole, setUserFormRole] = useState<Role>("auditor");
  const [userFormActive, setUserFormActive] = useState(true);

  function openEditUser(u: UserRow) {
    setUserFormError("");
    setUserFormId(u.id);
    setUserFormName(u.full_name ?? "");
    setUserFormEmail(u.email ?? "");
    setUserFormRole(u.role);
    setUserFormActive(u.status === "active");
    setUserModalOpen(true);
  }

  async function saveUserEdits() {
    setUserFormError("");

    if (!activeHotelId) {
      setUserFormError("No hay hotel seleccionado.");
      return;
    }
    if (!userFormId) {
      setUserFormError("Falta id del usuario.");
      return;
    }

    const token = await getBearer();
    if (!token) {
      setUserFormError("No autorizado (sin sesión).");
      return;
    }

    const full_name = userFormName.trim();
    const email = userFormEmail.trim().toLowerCase();
    if (email && !email.includes("@")) {
      setUserFormError("Email inválido.");
      return;
    }

    setUserFormBusy(true);
    try {
      const res = await fetch(`/api/admin/users`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          id: userFormId,
          hotel_id: activeHotelId,
          full_name,
          email: email || undefined,
          role: userFormRole,
          active: userFormActive,
        }),
      });

      const json = await res.json().catch(() => ({} as any));
      if (!res.ok || !json?.ok) throw new Error(json?.error || `Error HTTP ${res.status}`);

      setUserModalOpen(false);
      await loadUsers();
    } catch (e: any) {
      console.error(e);
      setUserFormError(e?.message || "No se pudo guardar el usuario.");
    } finally {
      setUserFormBusy(false);
    }
  }

  async function deleteUserFromModal() {
    if (!activeHotelId || !userFormId) return;

    const ok = confirm(
      "¿Seguro que quieres DESACTIVAR este usuario?\n\n(Es lo más seguro. Si quieres borrado real de Auth lo añadimos luego.)"
    );
    if (!ok) return;

    const token = await getBearer();
    if (!token) {
      setUserFormError("No autorizado (sin sesión).");
      return;
    }

    setUserFormBusy(true);
    setUserFormError("");
    try {
      const res = await fetch(`/api/admin/users`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          id: userFormId,
          hotel_id: activeHotelId,
          active: false,
        }),
      });

      const json = await res.json().catch(() => ({} as any));
      if (!res.ok || !json?.ok) throw new Error(json?.error || `Error HTTP ${res.status}`);

      setUserModalOpen(false);
      await loadUsers();
    } catch (e: any) {
      console.error(e);
      setUserFormError(e?.message || "No se pudo desactivar el usuario.");
    } finally {
      setUserFormBusy(false);
    }
  }

  // ----------------------------
  // Auditorías por área
  // ----------------------------
  const [templates, setTemplates] = useState<AuditTemplateRow[]>([]);
  const [templatesLoading, setTemplatesLoading] = useState(false);
  const [templatesError, setTemplatesError] = useState("");

  const [templateQuery, setTemplateQuery] = useState("");
  const [templateStatus, setTemplateStatus] = useState<"all" | "active" | "inactive">("all");

  async function loadAreaTemplates(areaId: string) {
    setTemplatesError("");
    setTemplates([]);

    if (!activeHotelId) {
      setTemplatesError("No hay hotel seleccionado.");
      return;
    }

    setTemplatesLoading(true);
    try {
      const { data, error } = await supabase
        .from("audit_templates")
        .select("id, name, active, area_id, created_at")
        .eq("hotel_id", activeHotelId)
        .eq("area_id", areaId)
        .order("name", { ascending: true });

      if (error) throw error;
      setTemplates((data ?? []) as any);
    } catch (e: any) {
      console.error(e);
      setTemplates([]);
      setTemplatesError(e?.message || "Error cargando auditorías del área.");
    } finally {
      setTemplatesLoading(false);
    }
  }

  const filteredTemplates = useMemo(() => {
    let list = [...templates];
    const needle = templateQuery.trim().toLowerCase();
    if (needle) list = list.filter((t) => (t.name ?? "").toLowerCase().includes(needle));

    if (templateStatus !== "all") {
      list =
        templateStatus === "active"
          ? list.filter((t) => (t.active ?? true) === true)
          : list.filter((t) => (t.active ?? true) === false);
    }

    return list;
  }, [templates, templateQuery, templateStatus]);

  // ----------------------------
  // Init on hotel change
  // ----------------------------
  useEffect(() => {
    setSelectedAreaId(null);
    setTemplates([]);
    setTemplatesError("");
    setViewMode("hotel-info");

    loadHotelInfo();
    loadAreas();
    loadUsers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeHotelId]);

  // ----------------------------
  // Navigation internal
  // ----------------------------
  function openHotelInfo() {
    setViewMode("hotel-info");
    loadHotelInfo();
  }

  function openAreasModule() {
    setViewMode("areas");
  }

  function openUsersModule() {
    setViewMode("users");
  }

  function openAreaAudits(a: AreaRow) {
    setSelectedAreaId(a.id);
    setViewMode("area-audits");
    loadAreaTemplates(a.id);
  }

  // ----------------------------
  // UI
  // ----------------------------
  return (
    <div style={{ minHeight: "100vh", background: "#eef1f5" }}>
      <HotelHeader />

      <div style={{ padding: 18 }}>
        <div style={{ display: "grid", gridTemplateColumns: "360px 1fr", gap: 18, alignItems: "start" }}>
          {/* LEFT */}
          <aside
            style={{
              background: "#d9f1f4",
              borderRadius: 12,
              border: "1px solid rgba(0,0,0,0.08)",
              overflow: "hidden",
            }}
          >
            <div style={{ padding: 16, borderBottom: "1px solid rgba(0,0,0,0.08)" }}>
              <div style={{ fontSize: 26, fontWeight: 950 }}>Panel de control</div>
              <div style={{ marginTop: 8, opacity: 0.85, fontSize: 13, fontWeight: 800 }}>
                Hotel seleccionado
              </div>
            </div>

            <div style={{ padding: 12 }}>
              <NavTile title="Info del hotel" active={viewMode === "hotel-info"} onClick={openHotelInfo} />
              <NavTile title="Áreas" active={viewMode === "areas"} onClick={openAreasModule} />
              <NavTile title="Usuarios" active={viewMode === "users"} onClick={openUsersModule} />

              <div style={{ marginTop: 12, paddingTop: 12, borderTop: "1px solid rgba(0,0,0,0.10)" }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center" }}>
                  <div style={{ fontWeight: 950, fontSize: 13, opacity: 0.8 }}>Áreas existentes</div>
                  <button style={ghostBtn} onClick={loadAreas} disabled={areasLoading}>
                    {areasLoading ? "…" : "Recargar"}
                  </button>
                </div>

                <div style={{ marginTop: 10 }}>
                  <input value={areaQuery} onChange={(e) => setAreaQuery(e.target.value)} placeholder="Buscar área…" style={input} />
                </div>

                {areasError ? <ErrorBox text={areasError} /> : null}

                <div style={{ marginTop: 10 }}>
                  {areasLoading ? (
                    <div style={{ padding: 10, fontWeight: 900, opacity: 0.75 }}>Cargando áreas…</div>
                  ) : filteredAreas.length === 0 ? (
                    <div style={{ padding: 10, fontWeight: 900, opacity: 0.75 }}>No hay áreas.</div>
                  ) : (
                    filteredAreas.map((a) => {
                      const isActive = (a.active ?? true) === true;
                      const isSel = viewMode === "area-audits" && selectedAreaId === a.id;

                      return (
                        <button
                          key={a.id}
                          onClick={() => openAreaAudits(a)}
                          style={{
                            width: "100%",
                            textAlign: "left",
                            padding: 12,
                            borderRadius: 12,
                            background: isSel ? "rgba(0,120,255,0.12)" : "rgba(255,255,255,0.72)",
                            border: "1px solid rgba(0,0,0,0.08)",
                            marginTop: 10,
                            cursor: "pointer",
                          }}
                          title={a.type ? `Tipo: ${a.type}` : "Ver auditorías del área"}
                        >
                          <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
                            <div style={{ fontWeight: 950 }}>
                              {a.name}
                              {a.type ? <span style={{ marginLeft: 8, fontWeight: 900, opacity: 0.55 }}>· {a.type}</span> : null}
                            </div>

                            <span
                              style={{
                                fontSize: 12,
                                fontWeight: 950,
                                padding: "4px 8px",
                                borderRadius: 999,
                                border: "1px solid rgba(0,0,0,0.10)",
                                background: isActive ? "rgba(0,200,0,0.10)" : "rgba(0,0,0,0.05)",
                                color: isActive ? "green" : "rgba(0,0,0,0.55)",
                                whiteSpace: "nowrap",
                              }}
                            >
                              {isActive ? "activa" : "inactiva"}
                            </span>
                          </div>
                        </button>
                      );
                    })
                  )}
                </div>
              </div>
            </div>
          </aside>

          {/* RIGHT */}
          <main style={{ background: "white", borderRadius: 12, border: "1px solid rgba(0,0,0,0.10)", overflow: "hidden" }}>
            {viewMode === "hotel-info" ? (
              <Section
                title="Info del hotel"
                subtitle="Información del hotel seleccionado."
                right={
                  <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                    <button style={ghostBtn} onClick={loadHotelInfo} disabled={hotelLoading}>
                      {hotelLoading ? "Cargando…" : "Recargar"}
                    </button>
                  </div>
                }
              >
                {hotelError ? <ErrorBox text={hotelError} /> : null}

                <div style={{ padding: 16 }}>
                  <div style={grid2}>
                    {/* ✅ ÚNICO ID visible en todo el panel */}
                    <InfoCard label="Hotel ID" value={activeHotelId ?? "—"} />
                    <InfoCard label="Nombre" value={hotel?.name ?? "—"} />
                  </div>
                </div>
              </Section>
            ) : viewMode === "areas" ? (
              <Section
                title="Áreas"
                subtitle="Crear, buscar, desactivar, modificar y borrar áreas (sin salir de esta página)."
                right={
                  <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                    <button style={primaryBtn} onClick={openCreateArea}>
                      + Crear área
                    </button>
                    <button style={ghostBtn} onClick={loadAreas} disabled={areasLoading}>
                      {areasLoading ? "Cargando…" : "Recargar"}
                    </button>
                  </div>
                }
              >
                {areasError ? <ErrorBox text={areasError} /> : null}

                <div style={{ padding: 16 }}>
                  <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
                    <input
                      value={areaQuery}
                      onChange={(e) => setAreaQuery(e.target.value)}
                      placeholder="Buscar área…"
                      style={{ ...input, flex: 1, minWidth: 280 }}
                    />
                    <button style={ghostBtn} onClick={() => setAreaQuery("")}>
                      Reset
                    </button>
                  </div>

                  <div style={{ marginTop: 14, overflowX: "auto" }}>
                    <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 900 }}>
                      <thead>
                        <tr style={{ background: "#f3f5f7" }}>
                          <th style={th}>Área</th>
                          <th style={th}>Tipo</th>
                          <th style={th}>Orden</th>
                          <th style={th}>Estado</th>
                          <th style={th}>Acciones</th>
                        </tr>
                      </thead>
                      <tbody>
                        {areasLoading ? (
                          <tr>
                            <td style={td} colSpan={5}>
                              Cargando…
                            </td>
                          </tr>
                        ) : filteredAreas.length === 0 ? (
                          <tr>
                            <td style={td} colSpan={5}>
                              No hay áreas.
                            </td>
                          </tr>
                        ) : (
                          filteredAreas.map((a) => {
                            const isActive = (a.active ?? true) === true;
                            return (
                              <tr key={a.id} style={{ borderTop: "1px solid rgba(0,0,0,0.08)" }}>
                                <td style={td}>
                                  <div style={{ fontWeight: 950 }}>{a.name}</div>
                                </td>
                                <td style={td}>{a.type ?? "—"}</td>
                                <td style={td}>{typeof a.sort_order === "number" ? a.sort_order : "—"}</td>
                                <td style={td}>
                                  <span
                                    style={{
                                      display: "inline-block",
                                      padding: "6px 10px",
                                      borderRadius: 999,
                                      fontWeight: 950,
                                      border: "1px solid rgba(0,0,0,0.10)",
                                      background: isActive ? "rgba(0,200,0,0.10)" : "rgba(0,0,0,0.05)",
                                      color: isActive ? "green" : "rgba(0,0,0,0.55)",
                                    }}
                                  >
                                    {isActive ? "activa" : "inactiva"}
                                  </span>
                                </td>
                                <td style={td}>
                                  <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                                    <button style={ghostBtn} onClick={() => toggleAreaActive(a.id, !isActive)}>
                                      {isActive ? "Desactivar" : "Activar"}
                                    </button>
                                    <button style={primaryBtn} onClick={() => openEditArea(a)}>
                                      Modificar
                                    </button>
                                    <button style={dangerBtn} onClick={() => deleteArea(a.id)}>
                                      Borrar
                                    </button>
                                  </div>
                                </td>
                              </tr>
                            );
                          })
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </Section>
            ) : viewMode === "users" ? (
              <Section
                title="Usuarios"
                subtitle="Buscar, desactivar, modificar y borrar usuarios (sin salir de esta página)."
                right={
                  <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                    <button style={primaryBtn} onClick={() => router.push("/admin/create-user")}>
                      + Crear usuario
                    </button>
                    <button style={ghostBtn} onClick={loadUsers} disabled={usersLoading}>
                      {usersLoading ? "Cargando…" : "Recargar"}
                    </button>
                  </div>
                }
              >
                {usersError ? <ErrorBox text={usersError} /> : null}

                <div style={{ padding: 16 }}>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 12 }}>
                    <input
                      value={userQuery}
                      onChange={(e) => setUserQuery(e.target.value)}
                      placeholder="Buscar por nombre, email, rol…"
                      style={{ ...input, height: 54, fontSize: 18, fontWeight: 900 }}
                    />

                    {/* ✅ filtros armonizados: lado a lado, mismo tamaño */}
                    <div
                      style={{
                        display: "grid",
                        gridTemplateColumns: "1fr 1fr",
                        gap: 12,
                      }}
                    >
                      <select value={userRoleFilter} onChange={(e) => setUserRoleFilter(e.target.value as any)} style={input}>
                        <option value="all">Todos los roles</option>
                        <option value="admin">admin</option>
                        <option value="manager">manager</option>
                        <option value="auditor">auditor</option>
                        <option value="superadmin">superadmin</option>
                      </select>

                      <select value={userStatusFilter} onChange={(e) => setUserStatusFilter(e.target.value as any)} style={input}>
                        <option value="all">Todos</option>
                        <option value="active">Activos</option>
                        <option value="inactive">Inactivos</option>
                      </select>
                    </div>

                    <div>
                      <button
                        style={{
                          ...ghostBtn,
                          padding: "14px 16px",
                          borderRadius: 14,
                          fontSize: 16,
                        }}
                        onClick={() => {
                          setUserQuery("");
                          setUserRoleFilter("all");
                          setUserStatusFilter("all");
                        }}
                      >
                        Reset
                      </button>
                    </div>
                  </div>

                  <div style={{ marginTop: 16, overflowX: "auto" }}>
                    <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 950 }}>
                      <thead>
                        <tr style={{ background: "#f3f5f7" }}>
                          <th style={th}>Nombre</th>
                          <th style={th}>Email</th>
                          <th style={th}>Rol</th>
                          <th style={th}>Estado</th>
                          <th style={th}>Acciones</th>
                        </tr>
                      </thead>
                      <tbody>
                        {usersLoading ? (
                          <tr>
                            <td style={td} colSpan={5}>
                              Cargando…
                            </td>
                          </tr>
                        ) : filteredUsers.length === 0 ? (
                          <tr>
                            <td style={td} colSpan={5}>
                              No hay usuarios.
                            </td>
                          </tr>
                        ) : (
                          filteredUsers.map((u) => {
                            const isActive = u.status === "active";
                            return (
                              <tr key={u.id} style={{ borderTop: "1px solid rgba(0,0,0,0.08)" }}>
                                <td style={td}>
                                  <div style={{ fontWeight: 950 }}>{u.full_name || "—"}</div>
                                  {/* ✅ sin ID */}
                                  <div style={{ fontSize: 12, opacity: 0.65 }}>{u.username}</div>
                                </td>
                                <td style={td}>{u.email ?? "—"}</td>
                                <td style={td}>{u.role}</td>
                                <td style={td}>
                                  <span
                                    style={{
                                      display: "inline-block",
                                      padding: "6px 10px",
                                      borderRadius: 999,
                                      fontWeight: 950,
                                      border: "1px solid rgba(0,0,0,0.10)",
                                      background: isActive ? "rgba(0,200,0,0.10)" : "rgba(0,0,0,0.05)",
                                      color: isActive ? "green" : "rgba(0,0,0,0.55)",
                                    }}
                                  >
                                    {isActive ? "activo" : "inactivo"}
                                  </span>
                                </td>
                                <td style={td}>
                                  <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                                    <button
                                      style={ghostBtn}
                                      onClick={async () => {
                                        // toggle rápido (sin borrar aquí)
                                        const token = await getBearer();
                                        if (!token || !activeHotelId) return alert("Sin sesión / hotel.");
                                        const res = await fetch(`/api/admin/users`, {
                                          method: "PATCH",
                                          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
                                          body: JSON.stringify({ id: u.id, hotel_id: activeHotelId, active: !isActive }),
                                        });
                                        const json = await res.json().catch(() => ({} as any));
                                        if (!res.ok || !json?.ok) return alert(json?.error || "Error actualizando.");
                                        await loadUsers();
                                      }}
                                    >
                                      {isActive ? "Desactivar" : "Activar"}
                                    </button>

                                    <button style={primaryBtn} onClick={() => openEditUser(u)}>
                                      Modificar
                                    </button>

                                    {/* ✅ Borrar eliminado de aquí: va dentro del modal */}
                                  </div>
                                </td>
                              </tr>
                            );
                          })
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </Section>
            ) : (
              <Section
                title={selectedArea ? selectedArea.name : "Área"}
                subtitle="Auditorías (plantillas) existentes para edición."
                right={
                  <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                    <button style={ghostBtn} onClick={() => setViewMode("areas")}>
                      ← Volver
                    </button>

                    <button
                      style={primaryBtn}
                      disabled={!selectedAreaId}
                      onClick={() => selectedAreaId && router.push(`/builder?area_id=${encodeURIComponent(selectedAreaId)}`)}
                    >
                      + Nueva auditoría
                    </button>

                    <button
                      style={ghostBtn}
                      disabled={!selectedAreaId || templatesLoading}
                      onClick={() => selectedAreaId && loadAreaTemplates(selectedAreaId)}
                    >
                      {templatesLoading ? "Cargando…" : "Recargar"}
                    </button>
                  </div>
                }
              >
                {templatesError ? <ErrorBox text={templatesError} /> : null}

                <div style={{ padding: 16 }}>
                  <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
                    <input
                      value={templateQuery}
                      onChange={(e) => setTemplateQuery(e.target.value)}
                      placeholder="Buscar auditoría…"
                      style={{ ...input, flex: 1, minWidth: 280 }}
                    />

                    <select value={templateStatus} onChange={(e) => setTemplateStatus(e.target.value as any)} style={input}>
                      <option value="all">Todas</option>
                      <option value="active">Activas</option>
                      <option value="inactive">Inactivas</option>
                    </select>

                    <button style={ghostBtn} onClick={() => { setTemplateQuery(""); setTemplateStatus("all"); }}>
                      Reset
                    </button>
                  </div>

                  <div style={{ marginTop: 14, overflowX: "auto" }}>
                    <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 900 }}>
                      <thead>
                        <tr style={{ background: "#f3f5f7" }}>
                          <th style={th}>Auditoría</th>
                          <th style={th}>Estado</th>
                          <th style={th}>Acciones</th>
                        </tr>
                      </thead>
                      <tbody>
                        {templatesLoading ? (
                          <tr>
                            <td style={td} colSpan={3}>Cargando…</td>
                          </tr>
                        ) : filteredTemplates.length === 0 ? (
                          <tr>
                            <td style={td} colSpan={3}>No hay auditorías para esta área.</td>
                          </tr>
                        ) : (
                          filteredTemplates.map((t) => {
                            const isActive = (t.active ?? true) === true;
                            return (
                              <tr key={t.id} style={{ borderTop: "1px solid rgba(0,0,0,0.08)" }}>
                                <td style={td}>
                                  <div style={{ fontWeight: 950 }}>{t.name}</div>
                                  {/* ✅ sin ID */}
                                </td>
                                <td style={td}>
                                  <span
                                    style={{
                                      display: "inline-block",
                                      padding: "6px 10px",
                                      borderRadius: 999,
                                      fontWeight: 950,
                                      border: "1px solid rgba(0,0,0,0.10)",
                                      background: isActive ? "rgba(0,200,0,0.10)" : "rgba(0,0,0,0.05)",
                                      color: isActive ? "green" : "rgba(0,0,0,0.55)",
                                    }}
                                  >
                                    {isActive ? "activa" : "inactiva"}
                                  </span>
                                </td>
                                <td style={td}>
                                  <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                                    <button style={primaryBtn} onClick={() => router.push(`/builder/${t.id}`)}>
                                      Editar
                                    </button>
                                    <button style={ghostBtn} onClick={() => router.push(`/audits?template_id=${encodeURIComponent(t.id)}`)}>
                                      Ver runs
                                    </button>
                                  </div>
                                </td>
                              </tr>
                            );
                          })
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </Section>
            )}
          </main>
        </div>
      </div>

      {/* MODAL: ÁREA */}
      {areaModalOpen ? (
        <Modal
          title={areaModalMode === "create" ? "Crear área" : "Modificar área"}
          onClose={() => setAreaModalOpen(false)}
          footer={
            <>
              <button style={ghostBtn} onClick={() => setAreaModalOpen(false)} disabled={areaFormBusy}>
                Cancelar
              </button>
              <button style={primaryBtn} onClick={saveArea} disabled={areaFormBusy}>
                {areaFormBusy ? "Guardando…" : "Guardar"}
              </button>
            </>
          }
        >
          {areaFormError ? <ErrorBox text={areaFormError} /> : null}

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <Field label="Nombre">
              <input value={areaFormName} onChange={(e) => setAreaFormName(e.target.value)} style={input} />
            </Field>

            <Field label="Tipo">
              <input value={areaFormType} onChange={(e) => setAreaFormType(e.target.value)} style={input} placeholder="Ej: FOH / HSK / A&B…" />
            </Field>

            <Field label="Orden">
              <input value={areaFormSort} onChange={(e) => setAreaFormSort(e.target.value)} style={input} placeholder="Ej: 10" />
            </Field>

            <div style={{ display: "flex", alignItems: "end" }}>
              <label style={{ display: "flex", gap: 10, alignItems: "center", fontWeight: 900 }}>
                <input type="checkbox" checked={areaFormActive} onChange={(e) => setAreaFormActive(e.target.checked)} />
                Activa
              </label>
            </div>
          </div>
        </Modal>
      ) : null}

      {/* MODAL: USUARIO (con borrar dentro) */}
      {userModalOpen ? (
        <Modal
          title="Modificar usuario"
          onClose={() => setUserModalOpen(false)}
          footer={
            <>
              <button style={ghostBtn} onClick={() => setUserModalOpen(false)} disabled={userFormBusy}>
                Cancelar
              </button>
              <button style={primaryBtn} onClick={saveUserEdits} disabled={userFormBusy}>
                {userFormBusy ? "Guardando…" : "Guardar"}
              </button>
            </>
          }
        >
          {userFormError ? <ErrorBox text={userFormError} /> : null}

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <Field label="Nombre completo">
              <input value={userFormName} onChange={(e) => setUserFormName(e.target.value)} style={input} />
            </Field>

            <Field label="Email">
              <input value={userFormEmail} onChange={(e) => setUserFormEmail(e.target.value)} style={input} />
            </Field>

            <Field label="Rol">
              <select value={userFormRole} onChange={(e) => setUserFormRole(e.target.value as Role)} style={input}>
                <option value="admin">admin</option>
                <option value="manager">manager</option>
                <option value="auditor">auditor</option>
                <option value="superadmin">superadmin</option>
              </select>
            </Field>

            <div style={{ display: "flex", alignItems: "end" }}>
              <label style={{ display: "flex", gap: 10, alignItems: "center", fontWeight: 900 }}>
                <input type="checkbox" checked={userFormActive} onChange={(e) => setUserFormActive(e.target.checked)} />
                Activo
              </label>
            </div>

            {/* ✅ Zona de “Borrar” dentro del modal */}
            <div style={{ gridColumn: "1 / -1", marginTop: 10 }}>
              <div
                style={{
                  borderRadius: 14,
                  border: "1px solid rgba(220,0,0,0.25)",
                  background: "rgba(220,0,0,0.06)",
                  padding: 12,
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  gap: 12,
                  flexWrap: "wrap",
                }}
              >
                <div>
                  <div style={{ fontWeight: 950, color: "crimson" }}>Borrar / Desactivar</div>
                  <div style={{ fontSize: 12, opacity: 0.75, fontWeight: 800 }}>
                    Por ahora “borrar” = desactivar (más seguro). Si quieres borrado real de Auth, lo añadimos luego.
                  </div>
                </div>
                <button style={dangerBtn} onClick={deleteUserFromModal} disabled={userFormBusy}>
                  Desactivar usuario
                </button>
              </div>
            </div>
          </div>
        </Modal>
      ) : null}
    </div>
  );
}

// ----------------------------
// UI helpers
// ----------------------------
function Section({
  title,
  subtitle,
  right,
  children,
}: {
  title: string;
  subtitle?: string;
  right?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div
        style={{
          padding: 16,
          borderBottom: "1px solid rgba(0,0,0,0.08)",
          display: "flex",
          justifyContent: "space-between",
          gap: 12,
          alignItems: "center",
          flexWrap: "wrap",
        }}
      >
        <div>
          <div style={{ fontSize: 38, fontWeight: 950 }}>{title}</div>
          {subtitle ? <div style={{ marginTop: 6, fontSize: 18, opacity: 0.7, fontWeight: 800 }}>{subtitle}</div> : null}
        </div>
        {right ? <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>{right}</div> : null}
      </div>

      {children}
    </div>
  );
}

function NavTile({ title, active, onClick }: { title: string; active?: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      style={{
        width: "100%",
        textAlign: "left",
        padding: 14,
        borderRadius: 14,
        background: active ? "rgba(0,120,255,0.12)" : "rgba(255,255,255,0.75)",
        border: "1px solid rgba(0,0,0,0.10)",
        marginBottom: 10,
        cursor: "pointer",
      }}
    >
      <div style={{ fontSize: 16, fontWeight: 950 }}>{title}</div>
    </button>
  );
}

function ErrorBox({ text }: { text: string }) {
  return (
    <div
      style={{
        marginTop: 12,
        padding: 12,
        borderRadius: 12,
        border: "1px solid rgba(220,0,0,0.35)",
        background: "rgba(220,0,0,0.06)",
        color: "crimson",
        fontWeight: 900,
      }}
    >
      {text}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div style={{ fontSize: 12, opacity: 0.7, fontWeight: 900, marginBottom: 6 }}>{label}</div>
      {children}
    </div>
  );
}

function InfoCard({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ padding: 14, borderRadius: 12, border: "1px solid rgba(0,0,0,0.10)", background: "rgba(0,0,0,0.02)" }}>
      <div style={{ fontSize: 12, opacity: 0.7, fontWeight: 900 }}>{label}</div>
      <div style={{ marginTop: 6, fontSize: 16, fontWeight: 950 }}>{value}</div>
    </div>
  );
}

function Modal({
  title,
  onClose,
  children,
  footer,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  footer: React.ReactNode;
}) {
  return (
    <div style={modalBg} onClick={onClose}>
      <div style={modalCard} onClick={(e) => e.stopPropagation()}>
        <div style={modalHead}>
          <div style={{ fontWeight: 950, fontSize: 16 }}>{title}</div>
          <button style={xBtn} onClick={onClose}>
            ✕
          </button>
        </div>

        <div style={modalBody}>{children}</div>

        <div style={modalFoot}>{footer}</div>
      </div>
    </div>
  );
}

// ----------------------------
// Styles
// ----------------------------
const input: React.CSSProperties = {
  width: "100%",
  padding: "10px 12px",
  borderRadius: 10,
  border: "1px solid rgba(0,0,0,0.18)",
  background: "white",
  fontWeight: 800,
};

const th: React.CSSProperties = {
  textAlign: "left",
  padding: 12,
  fontSize: 12,
  opacity: 0.75,
  whiteSpace: "nowrap",
  fontWeight: 950,
};

const td: React.CSSProperties = {
  padding: 12,
  fontSize: 13,
  verticalAlign: "top",
  fontWeight: 800,
};

const primaryBtn: React.CSSProperties = {
  padding: "16px 18px",
  borderRadius: 18,
  border: "none",
  background: "#1f4bd8",
  color: "white",
  fontWeight: 950,
  cursor: "pointer",
  fontSize: 18,
};

const ghostBtn: React.CSSProperties = {
  padding: "16px 18px",
  borderRadius: 18,
  border: "1px solid rgba(0,0,0,0.18)",
  background: "white",
  fontWeight: 950,
  cursor: "pointer",
  fontSize: 18,
};

const dangerBtn: React.CSSProperties = {
  padding: "12px 14px",
  borderRadius: 14,
  border: "1px solid rgba(220,0,0,0.35)",
  background: "rgba(220,0,0,0.06)",
  color: "crimson",
  fontWeight: 950,
  cursor: "pointer",
};

const grid2: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "1fr 1fr",
  gap: 12,
};

const modalBg: React.CSSProperties = {
  position: "fixed",
  inset: 0,
  background: "rgba(0,0,0,0.35)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  padding: 16,
  zIndex: 50,
};

const modalCard: React.CSSProperties = {
  width: "100%",
  maxWidth: 980,
  background: "white",
  borderRadius: 14,
  border: "1px solid rgba(0,0,0,0.10)",
  overflow: "hidden",
};

const modalHead: React.CSSProperties = {
  padding: 14,
  borderBottom: "1px solid rgba(0,0,0,0.10)",
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
};

const modalBody: React.CSSProperties = { padding: 14 };

const modalFoot: React.CSSProperties = {
  padding: 14,
  borderTop: "1px solid rgba(0,0,0,0.10)",
  display: "flex",
  justifyContent: "flex-end",
  gap: 10,
};

const xBtn: React.CSSProperties = {
  border: "none",
  background: "transparent",
  cursor: "pointer",
  fontSize: 18,
  fontWeight: 900,
};