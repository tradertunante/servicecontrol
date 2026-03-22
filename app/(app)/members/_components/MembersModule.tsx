"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import type { Profile } from "@/lib/types";
import MemberForm from "./MemberForm";
import MembersImportPanel from "./MembersImportPanel";
import MembersTable from "./MembersTable";
import { Pagination } from "@/components/ui/Pagination";
import type { MemberAreaOption, MemberRecord, MembersPagination, MembersResponse } from "../_lib/memberTypes";

type FormValues = {
  full_name: string;
  employee_number: string;
  active: boolean;
  area_ids: string[];
};

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

export default function MembersModule({
  initialHotelId,
  initialProfile,
}: {
  initialHotelId: string;
  initialProfile: Profile;
}) {
  const [members, setMembers] = useState<MemberRecord[]>([]);
  const [areaOptions, setAreaOptions] = useState<MemberAreaOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [busyMemberId, setBusyMemberId] = useState<string | null>(null);
  const [editingMemberId, setEditingMemberId] = useState<string | null>(null);
  const [formValues, setFormValues] = useState<FormValues>(emptyForm());
  const [hotelId, setHotelId] = useState<string | null>(initialHotelId);
  const [hotelContextReady] = useState(true);
  const [role, setRole] = useState<string>(normalizeRole(initialProfile.role));
  const [search, setSearch] = useState("");
  const [selectedAreaId, setSelectedAreaId] = useState("ALL");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "inactive">("active");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState<MembersPagination | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function bootstrap() {
      try {
        setLoading(true);
        setError(null);

        if (!initialHotelId) {
          throw new Error("No se pudo resolver el hotel activo.");
        }
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
  }, [initialHotelId]);

  const loadMembers = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const token = await getAccessToken();
      if (!token) {
        throw new Error("Sesion invalida.");
      }

      const params = new URLSearchParams();
      params.set("status", statusFilter);
      params.set("page", String(page));
      params.set("page_size", "50");
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
      setPagination(payload && "pagination" in payload ? (payload.pagination ?? null) : null);
    } catch (err) {
      setError(normalizeError(err instanceof Error ? err.message : null, "No se pudo cargar miembros."));
    } finally {
      setLoading(false);
    }
  }, [hotelId, statusFilter, page]);

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

      const body = JSON.stringify({
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

      const res = await fetch(`/api/members/${member.id}`, {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({}),
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
    <div className="grid gap-4 py-6">
      <div className="border border-[#e5e7eb] bg-white p-4 rounded-xl">
        <div className="text-2xl font-[800]">Members</div>
        <div className="mt-1.5 text-[#4b5563] leading-[1.5]">
          Gestiona miembros, su estado y las areas donde pueden operar dentro de tu alcance actual.
        </div>
        {error ? <div className="mt-2.5 text-[#b91c1c] font-semibold">{error}</div> : null}
      </div>

      <div className="border border-[#e5e7eb] bg-white p-4 rounded-xl grid gap-2.5">
        <div className="text-[18px] font-[800]">Filtros</div>
        <div className="grid gap-2.5 [grid-template-columns:repeat(auto-fit,minmax(180px,1fr))]">
          <input
            value={search}
            onChange={(event) => { setSearch(event.target.value); setPage(1); }}
            placeholder="Buscar por nombre o numero"
            className="border border-[#d1d5db] rounded-[10px] px-3 py-2.5 w-full bg-white"
          />
          <select
            value={selectedAreaId}
            onChange={(event) => { setSelectedAreaId(event.target.value); setPage(1); }}
            className="border border-[#d1d5db] rounded-[10px] px-3 py-2.5 w-full bg-white"
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
            onChange={(event) => { setStatusFilter(event.target.value as "all" | "active" | "inactive"); setPage(1); }}
            className="border border-[#d1d5db] rounded-[10px] px-3 py-2.5 w-full bg-white"
          >
            <option value="all">Todos los estados</option>
            <option value="active">Solo activos</option>
            <option value="inactive">Solo inactivos</option>
          </select>
          <select
            value={sortDirection}
            onChange={(event) => setSortDirection(event.target.value as "asc" | "desc")}
            className="border border-[#d1d5db] rounded-[10px] px-3 py-2.5 w-full bg-white"
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
        <div className="border border-[#e5e7eb] bg-white p-4 rounded-xl">
          Cargando miembros...
        </div>
      ) : (
        <>
          <MembersTable
            members={filteredMembers}
            busyMemberId={saving ? busyMemberId : null}
            onEdit={beginEdit}
            onDelete={(member) => void handleDelete(member)}
          />
          {pagination && (
            <Pagination
              page={pagination.page}
              totalPages={pagination.total_pages}
              onPageChange={(newPage) => setPage(newPage)}
            />
          )}
        </>
      )}
    </div>
  );
}
