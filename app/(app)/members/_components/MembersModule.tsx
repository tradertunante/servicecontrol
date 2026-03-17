"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import MemberForm from "./MemberForm";
import MembersImportPanel from "./MembersImportPanel";
import MembersTable from "./MembersTable";
import type { MemberAreaOption, MemberRecord, MembersResponse } from "../_lib/memberTypes";

type FormValues = {
  full_name: string;
  employee_number: string;
  active: boolean;
  area_ids: string[];
};

const HOTEL_KEY = "sc_hotel_id";

function emptyForm(): FormValues {
  return {
    full_name: "",
    employee_number: "",
    active: true,
    area_ids: [],
  };
}

function normalizeError(message: string | null | undefined, fallback: string) {
  const safeMessage = String(message ?? "").trim();
  return safeMessage || fallback;
}

function buildSaveErrorMessage(payload: {
  error?: string;
  conflict_member?: { id?: string; full_name?: string; active?: boolean } | null;
  debug?: {
    effective_hotel_id?: string;
    edited_member_id?: string;
    requested_employee_number?: string;
    duplicate_member_id?: string;
    duplicate_member_active?: boolean;
    duplicate_member_within_visible_scope?: boolean;
  };
} | null) {
  const baseMessage = normalizeError(payload?.error, "No se pudo guardar el miembro.");

  if (!payload?.debug) {
    return baseMessage;
  }

  const bits = [
    `hotel_id=${payload.debug.effective_hotel_id ?? "?"}`,
    `member_id=${payload.debug.edited_member_id ?? "?"}`,
    `employee_number=${payload.debug.requested_employee_number ?? "?"}`,
    `duplicate_member_id=${payload.debug.duplicate_member_id ?? "?"}`,
    `duplicate_active=${String(payload.debug.duplicate_member_active ?? "?")}`,
    `duplicate_visible_scope=${String(payload.debug.duplicate_member_within_visible_scope ?? "?")}`,
  ];

  return `${baseMessage} [debug: ${bits.join(", ")}]`;
}

function normalizeRole(value: unknown) {
  return String(value ?? "").trim().toLowerCase();
}

async function getAccessToken() {
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token ?? "";
}

async function resolveMembersHotelContext() {
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    throw new Error("Sesion invalida.");
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("hotel_id, role, active")
    .eq("id", user.id)
    .maybeSingle();

  if (profileError || !profile || profile.active === false) {
    throw new Error("Perfil invalido.");
  }

  const role = normalizeRole(profile.role);
  const selectedHotelId = typeof window !== "undefined" ? localStorage.getItem(HOTEL_KEY) : null;
  const profileHotelId = String(profile.hotel_id ?? "").trim() || null;
  const hotelId = role === "superadmin" ? selectedHotelId : profileHotelId;

  if (role === "superadmin" && !hotelId) {
    throw new Error("Selecciona un hotel activo para gestionar miembros.");
  }

  if (role !== "superadmin" && !hotelId) {
    throw new Error("hotel_id faltante en perfil.");
  }

  return {
    hotelId,
    role,
  };
}

export default function MembersModule() {
  const [members, setMembers] = useState<MemberRecord[]>([]);
  const [areaOptions, setAreaOptions] = useState<MemberAreaOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [busyMemberId, setBusyMemberId] = useState<string | null>(null);
  const [editingMemberId, setEditingMemberId] = useState<string | null>(null);
  const [formValues, setFormValues] = useState<FormValues>(emptyForm());
  const [hotelId, setHotelId] = useState<string | null>(null);
  const [hotelContextReady, setHotelContextReady] = useState(false);
  const [role, setRole] = useState<string>("");
  const [search, setSearch] = useState("");
  const [selectedAreaId, setSelectedAreaId] = useState("ALL");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "inactive">("active");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");

  useEffect(() => {
    let cancelled = false;

    async function bootstrap() {
      try {
        setLoading(true);
        setError(null);

        const context = await resolveMembersHotelContext();
        if (cancelled) return;

        setHotelId(context.hotelId);
        setRole(context.role);
        setHotelContextReady(true);
      } catch (err) {
        if (cancelled) return;
        setError(normalizeError(err instanceof Error ? err.message : null, "No se pudo resolver el hotel activo."));
        setLoading(false);
      }
    }

    void bootstrap();

    return () => {
      cancelled = true;
    };
  }, []);

  const loadMembers = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const token = await getAccessToken();
      const requestedHotelId = role === "superadmin" ? hotelId : null;

      if (!token) {
        throw new Error("Sesion invalida.");
      }

      const params = new URLSearchParams();
      if (requestedHotelId) {
        params.set("hotel_id", requestedHotelId);
      }
      params.set("status", statusFilter);
      const query = params.toString() ? `?${params.toString()}` : "";
      const res = await fetch(`/api/members${query}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const payload = (await res.json().catch(() => null)) as MembersResponse | { error?: string } | null;

      if (!res.ok) {
        throw new Error(normalizeError(payload && "error" in payload ? payload.error : null, "No se pudo cargar miembros."));
      }

      setMembers(payload && "members" in payload ? payload.members : []);
      setAreaOptions(payload && "available_areas" in payload ? payload.available_areas : []);
      setHotelId(payload && "hotel_id" in payload ? payload.hotel_id : hotelId);
      setRole(payload && "role" in payload ? payload.role : "");
    } catch (err) {
      setError(normalizeError(err instanceof Error ? err.message : null, "No se pudo cargar miembros."));
    } finally {
      setLoading(false);
    }
  }, [hotelId, role, statusFilter]);

  useEffect(() => {
    if (!hotelContextReady) return;
    void loadMembers();
  }, [hotelContextReady, loadMembers]);

  const editingMember = useMemo(
    () => members.find((member) => member.id === editingMemberId) ?? null,
    [editingMemberId, members]
  );

  function beginCreate() {
    setEditingMemberId(null);
    setFormValues(emptyForm());
  }

  function beginEdit(member: MemberRecord) {
    setEditingMemberId(member.id);
    setFormValues({
      full_name: member.full_name,
      employee_number: member.employee_number ?? "",
      active: member.active,
      area_ids: [...member.area_ids],
    });
  }

  async function handleSubmit() {
    try {
      setSaving(true);
      setBusyMemberId(editingMemberId);
      setError(null);
      const token = await getAccessToken();

      if (!token) {
        throw new Error("Sesion invalida.");
      }

      const requestedHotelId = role === "superadmin" ? hotelId : null;

      const body = JSON.stringify({
        hotel_id: requestedHotelId,
        full_name: formValues.full_name,
        employee_number: formValues.employee_number,
        active: formValues.active,
        area_ids: formValues.area_ids,
      });

      const res = await fetch(editingMemberId ? `/api/members/${editingMemberId}` : "/api/members", {
        method: editingMemberId ? "PATCH" : "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body,
      });

      const payload = (await res.json().catch(() => null)) as {
        error?: string;
        conflict_member?: { id?: string; full_name?: string; active?: boolean } | null;
        debug?: {
          effective_hotel_id?: string;
          edited_member_id?: string;
          requested_employee_number?: string;
          duplicate_member_id?: string;
          duplicate_member_active?: boolean;
          duplicate_member_within_visible_scope?: boolean;
        };
      } | null;

      if (!res.ok) {
        throw new Error(buildSaveErrorMessage(payload));
      }

      beginCreate();
      await loadMembers();
    } catch (err) {
      setError(normalizeError(err instanceof Error ? err.message : null, "No se pudo guardar el miembro."));
    } finally {
      setSaving(false);
      setBusyMemberId(null);
    }
  }

  async function handleDelete(member: MemberRecord) {
    const confirmed = window.confirm("Are you sure you want to delete this collaborator?");
    if (!confirmed) {
      return;
    }

    try {
      setSaving(true);
      setBusyMemberId(member.id);
      setError(null);
      const token = await getAccessToken();

      if (!token) {
        throw new Error("Sesion invalida.");
      }

      const requestedHotelId = role === "superadmin" ? hotelId : null;

      const res = await fetch(`/api/members/${member.id}`, {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          hotel_id: requestedHotelId,
        }),
      });

      const payload = (await res.json().catch(() => null)) as { error?: string } | null;

      if (!res.ok) {
        throw new Error(normalizeError(payload?.error, "No se pudo eliminar el colaborador."));
      }

      if (editingMemberId === member.id) {
        beginCreate();
      }

      await loadMembers();
    } catch (err) {
      setError(normalizeError(err instanceof Error ? err.message : null, "No se pudo eliminar el colaborador."));
    } finally {
      setSaving(false);
      setBusyMemberId(null);
    }
  }

  const filteredMembers = useMemo(() => {
    const searchTerm = search.trim().toLowerCase();
    const next = members.filter((member) => {
      if (selectedAreaId !== "ALL" && !member.area_ids.includes(selectedAreaId)) {
        return false;
      }

      if (statusFilter === "active" && !member.active) {
        return false;
      }

      if (statusFilter === "inactive" && member.active) {
        return false;
      }

      if (!searchTerm) {
        return true;
      }

      return (
        member.full_name.toLowerCase().includes(searchTerm) ||
        (member.employee_number ?? "").toLowerCase().includes(searchTerm)
      );
    });

    next.sort((a, b) => {
      const diff = a.full_name.localeCompare(b.full_name, "es");
      return sortDirection === "asc" ? diff : diff * -1;
    });

    return next;
  }, [members, search, selectedAreaId, sortDirection, statusFilter]);

  const isAdminLike =
    role === "admin" || role === "superadmin" || role === "quality" || role === "general_manager";

  return (
    <div style={{ display: "grid", gap: 16, padding: "24px 0" }}>
      <div
        style={{
          border: "1px solid #e5e7eb",
          background: "#fff",
          padding: 16,
          borderRadius: 12,
        }}
      >
        <div style={{ fontSize: 24, fontWeight: 800 }}>Members</div>
        <div style={{ marginTop: 6, color: "#4b5563", lineHeight: 1.5 }}>
          Gestiona miembros, su estado y las areas donde pueden operar dentro de tu alcance actual.
        </div>
        {error ? <div style={{ marginTop: 10, color: "#b91c1c", fontWeight: 600 }}>{error}</div> : null}
      </div>

      <div
        style={{
          border: "1px solid #e5e7eb",
          background: "#fff",
          padding: 16,
          borderRadius: 12,
          display: "grid",
          gap: 10,
        }}
      >
        <div style={{ fontSize: 18, fontWeight: 800 }}>Filtros</div>
        <div style={{ display: "grid", gap: 10, gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))" }}>
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Buscar por nombre o numero"
            style={{
              border: "1px solid #d1d5db",
              borderRadius: 10,
              padding: "10px 12px",
              width: "100%",
              background: "#fff",
            }}
          />
          <select
            value={selectedAreaId}
            onChange={(event) => setSelectedAreaId(event.target.value)}
            style={{
              border: "1px solid #d1d5db",
              borderRadius: 10,
              padding: "10px 12px",
              width: "100%",
              background: "#fff",
            }}
          >
            <option value="ALL">{isAdminLike ? "Todas las areas" : "Mis areas"}</option>
            {areaOptions.map((area) => (
              <option key={area.id} value={area.id}>
                {area.name}
              </option>
            ))}
          </select>
          <select
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value as "all" | "active" | "inactive")}
            style={{
              border: "1px solid #d1d5db",
              borderRadius: 10,
              padding: "10px 12px",
              width: "100%",
              background: "#fff",
            }}
          >
            <option value="all">Todos los estados</option>
            <option value="active">Solo activos</option>
            <option value="inactive">Solo inactivos</option>
          </select>
          <select
            value={sortDirection}
            onChange={(event) => setSortDirection(event.target.value as "asc" | "desc")}
            style={{
              border: "1px solid #d1d5db",
              borderRadius: 10,
              padding: "10px 12px",
              width: "100%",
              background: "#fff",
            }}
          >
            <option value="asc">Nombre A-Z</option>
            <option value="desc">Nombre Z-A</option>
          </select>
        </div>
      </div>

      <MembersImportPanel
        hotelId={hotelId}
        role={role}
        areaOptions={areaOptions}
        onImported={async () => {
          await loadMembers();
        }}
      />

      <MemberForm
        title={editingMember ? `Editar miembro: ${editingMember.full_name}` : "Crear miembro"}
        values={formValues}
        areaOptions={areaOptions}
        busy={saving}
        submitLabel={editingMember ? "Guardar cambios" : "Crear miembro"}
        onChange={setFormValues}
        onSubmit={() => void handleSubmit()}
        onCancel={editingMember ? beginCreate : undefined}
      />

      {loading ? (
        <div
          style={{
            border: "1px solid #e5e7eb",
            background: "#fff",
            padding: 16,
            borderRadius: 12,
          }}
        >
          Cargando miembros...
        </div>
      ) : (
        <MembersTable
          members={filteredMembers}
          busyMemberId={saving ? busyMemberId : null}
          onEdit={beginEdit}
          onDelete={(member) => void handleDelete(member)}
        />
      )}
    </div>
  );
}
