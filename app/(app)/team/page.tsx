"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import BackButton from "@/app/components/BackButton";
import AreaMultiSelect, { type AreaOption } from "@/app/components/AreaMultiSelect";

type Role = "admin" | "manager" | "auditor" | "superadmin";

type Profile = {
  id: string;
  hotel_id: string | null;
  role: Role;
  active: boolean | null;
  full_name?: string | null;
};

type HotelRow = { id: string; name: string };

type TeamMemberRow = {
  id: string;
  hotel_id: string;
  full_name: string;
  position: string | null;
  active: boolean;
  created_at: string | null;
};

type TeamMemberAreaRow = {
  id: string;
  team_member_id: string;
  area_id: string;
};

const HOTEL_KEY = "sc_hotel_id";

function canManageTeam(role: Role) {
  return role === "admin" || role === "manager" || role === "superadmin";
}

export default function TeamPage() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [profile, setProfile] = useState<Profile | null>(null);
  const [hotelId, setHotelId] = useState<string | null>(null);
  const [hotel, setHotel] = useState<HotelRow | null>(null);

  const [areas, setAreas] = useState<AreaOption[]>([]);
  const [members, setMembers] = useState<TeamMemberRow[]>([]);
  const [links, setLinks] = useState<TeamMemberAreaRow[]>([]);

  // Nuevo colaborador
  const [newName, setNewName] = useState("");
  const [newPosition, setNewPosition] = useState("");
  const [newAreaIds, setNewAreaIds] = useState<string[]>([]);

  // Estado de inputs por miembro (para añadir áreas)
  const [pendingAreasByMember, setPendingAreasByMember] = useState<Record<string, string[]>>({});

  const areasById = useMemo(() => {
    const m = new Map<string, AreaOption>();
    for (const a of areas) m.set(a.id, a);
    return m;
  }, [areas]);

  const areaIdsByMember = useMemo(() => {
    const map = new Map<string, string[]>();
    for (const l of links) {
      const arr = map.get(l.team_member_id) ?? [];
      arr.push(l.area_id);
      map.set(l.team_member_id, arr);
    }
    return map;
  }, [links]);

  function getActiveHotelId(p: Profile): string | null {
    if (p.role === "superadmin") {
      const v = typeof window !== "undefined" ? localStorage.getItem(HOTEL_KEY) : null;
      return v || null;
    }
    return p.hotel_id ?? null;
  }

  async function loadAll(activeHotelId: string) {
    // Hotel name
    const { data: hData } = await supabase.from("hotels").select("id,name").eq("id", activeHotelId).single();
    setHotel((hData as any) ?? null);

    // Áreas del hotel
    const { data: aData, error: aErr } = await supabase
      .from("areas")
      .select("id,name,type")
      .eq("hotel_id", activeHotelId)
      .order("name", { ascending: true });

    if (aErr) throw aErr;
    setAreas((aData ?? []) as any);

    // Colaboradores
    const { data: mData, error: mErr } = await supabase
      .from("team_members")
      .select("id,hotel_id,full_name,position,active,created_at")
      .eq("hotel_id", activeHotelId)
      .order("full_name", { ascending: true });

    if (mErr) throw mErr;
    setMembers((mData ?? []) as any);

    // Links team_member_areas
    const memberIds = (mData ?? []).map((x: any) => x.id);
    if (memberIds.length === 0) {
      setLinks([]);
      return;
    }

    const { data: lData, error: lErr } = await supabase
      .from("team_member_areas")
      .select("id,team_member_id,area_id")
      .in("team_member_id", memberIds);

    if (lErr) throw lErr;
    setLinks((lData ?? []) as any);
  }

  useEffect(() => {
    let alive = true;

    (async () => {
      setLoading(true);
      setError(null);

      try {
        const { data: userData } = await supabase.auth.getUser();
        const user = userData.user;
        if (!user) {
          router.push("/login");
          return;
        }

        const { data: pData, error: pErr } = await supabase
          .from("profiles")
          .select("id,hotel_id,role,active,full_name")
          .eq("id", user.id)
          .single();

        if (pErr || !pData || pData.active === false) {
          router.push("/login");
          return;
        }

        const p = pData as Profile;

        if (!canManageTeam(p.role)) {
          router.push("/dashboard");
          return;
        }

        const hid = getActiveHotelId(p);

        if (!alive) return;
        setProfile(p);
        setHotelId(hid);

        if (!hid) {
          setLoading(false);
          setError("Tu usuario no tiene hotel seleccionado. Selecciona un hotel primero.");
          return;
        }

        await loadAll(hid);

        if (!alive) return;
        setLoading(false);
      } catch (e: any) {
        if (!alive) return;
        setLoading(false);
        setError(e?.message ?? "Error cargando equipo.");
      }
    })();

    return () => {
      alive = false;
    };
  }, [router]);

  async function createMember() {
    setError(null);

    const hid = hotelId;
    if (!hid) {
      setError("No puedo crear: no hay hotel activo.");
      return;
    }

    const full_name = newName.trim();
    const position = newPosition.trim();

    if (!full_name) {
      setError("Pon el nombre completo.");
      return;
    }

    setSaving(true);
    try {
      // 1) crear team_member
      const { data: inserted, error: insErr } = await supabase
        .from("team_members")
        .insert({
          hotel_id: hid,
          full_name,
          position: position || null,
          active: true,
        })
        .select("id,hotel_id,full_name,position,active,created_at")
        .single();

      if (insErr || !inserted) throw insErr ?? new Error("No se pudo crear el colaborador.");

      // 2) link áreas (si hay)
      const memberId = (inserted as any).id as string;
      const areaIds = newAreaIds;

      if (areaIds.length) {
        const payload = areaIds.map((area_id) => ({ team_member_id: memberId, area_id }));
        // Upsert para evitar duplicados si tienes unique(team_member_id,area_id)
        const { error: linkErr } = await supabase.from("team_member_areas").upsert(payload, {
          onConflict: "team_member_id,area_id",
        });
        if (linkErr) throw linkErr;
      }

      // Refresh rápido
      setMembers((prev) => [...prev, inserted as any].sort((a, b) => a.full_name.localeCompare(b.full_name)));

      if (newAreaIds.length) {
        const { data: lData, error: lErr } = await supabase
          .from("team_member_areas")
          .select("id,team_member_id,area_id")
          .eq("team_member_id", memberId);

        if (lErr) throw lErr;
        setLinks((prev) => [...prev, ...((lData ?? []) as any[])]);
      }

      setNewName("");
      setNewPosition("");
      setNewAreaIds([]);
    } catch (e: any) {
      setError(e?.message ?? "No se pudo crear.");
    } finally {
      setSaving(false);
    }
  }

  async function addAreasToMember(memberId: string) {
    setError(null);

    const ids = pendingAreasByMember[memberId] ?? [];
    if (!ids.length) return;

    setSaving(true);
    try {
      const payload = ids.map((area_id) => ({ team_member_id: memberId, area_id }));

      const { error: insErr } = await supabase.from("team_member_areas").upsert(payload, {
        onConflict: "team_member_id,area_id",
      });
      if (insErr) throw insErr;

      const { data: lData, error: lErr } = await supabase
        .from("team_member_areas")
        .select("id,team_member_id,area_id")
        .eq("team_member_id", memberId);

      if (lErr) throw lErr;

      setLinks((prev) => {
        const others = prev.filter((x) => x.team_member_id !== memberId);
        return [...others, ...((lData ?? []) as any[])];
      });

      setPendingAreasByMember((prev) => ({ ...prev, [memberId]: [] }));
    } catch (e: any) {
      setError(e?.message ?? "No se pudieron añadir áreas.");
    } finally {
      setSaving(false);
    }
  }

  async function removeAreaFromMember(memberId: string, areaId: string) {
    setError(null);
    setSaving(true);
    try {
      const { error: delErr } = await supabase
        .from("team_member_areas")
        .delete()
        .eq("team_member_id", memberId)
        .eq("area_id", areaId);

      if (delErr) throw delErr;

      setLinks((prev) => prev.filter((x) => !(x.team_member_id === memberId && x.area_id === areaId)));
    } catch (e: any) {
      setError(e?.message ?? "No se pudo quitar el área.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <main className="w-full min-h-screen bg-gray-50 overflow-x-hidden">
        <div className="w-full px-4 py-4">
          <p className="text-sm text-gray-600">Cargando…</p>
        </div>
      </main>
    );
  }

  return (
    <main className="w-full min-h-screen bg-gray-50 overflow-x-hidden">
      <div className="w-full px-4 pt-4 pb-24">
        <div className="mb-3">
          <BackButton fallback="/dashboard" />
        </div>

        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="text-xs font-semibold text-gray-500">{hotel?.name ?? "Hotel"}</div>
            <h1 className="text-2xl font-extrabold tracking-tight">Equipo</h1>
          </div>

          {/* ✅ Importar (ya NO duplicamos botones de header aquí) */}
          <div className="flex gap-2">
            <button
              onClick={() => router.push("/team/import")}
              className="rounded-2xl border bg-white px-4 py-2 text-sm font-extrabold hover:bg-gray-50"
            >
              Importar
            </button>
          </div>
        </div>

        {error ? (
          <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
            {error}
          </div>
        ) : null}

        {/* Nuevo colaborador */}
        <section className="mt-6 rounded-2xl border bg-white p-5 shadow-sm">
          <div className="text-sm font-extrabold mb-3">Nuevo colaborador</div>

          <div className="grid gap-3">
            <input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Nombre completo"
              className="w-full rounded-2xl border bg-white px-4 py-3 text-sm font-semibold outline-none focus:border-black"
            />
            <input
              value={newPosition}
              onChange={(e) => setNewPosition(e.target.value)}
              placeholder="Posición"
              className="w-full rounded-2xl border bg-white px-4 py-3 text-sm font-semibold outline-none focus:border-black"
            />

            <AreaMultiSelect
              options={areas}
              value={newAreaIds}
              onChange={setNewAreaIds}
              placeholder="Escribe para buscar (ej. Capella, Room Service, etc.)"
              hint="Puedes asignar varias áreas al mismo colaborador."
            />

            <div className="flex gap-2">
              <button
                onClick={createMember}
                disabled={saving}
                className="rounded-2xl bg-black px-5 py-3 text-sm font-extrabold text-white disabled:opacity-60"
              >
                {saving ? "Creando…" : "Crear"}
              </button>

              <button
                onClick={async () => {
                  if (!hotelId) return;
                  setSaving(true);
                  setError(null);
                  try {
                    await loadAll(hotelId);
                  } catch (e: any) {
                    setError(e?.message ?? "No se pudo refrescar.");
                  } finally {
                    setSaving(false);
                  }
                }}
                disabled={saving}
                className="rounded-2xl border bg-white px-5 py-3 text-sm font-extrabold hover:bg-gray-50 disabled:opacity-60"
              >
                Refrescar
              </button>
            </div>
          </div>
        </section>

        {/* Colaboradores */}
        <section className="mt-6 rounded-2xl border bg-white p-5 shadow-sm">
          <div className="text-sm font-extrabold mb-4">Colaboradores</div>

          {members.length === 0 ? (
            <div className="text-sm font-semibold text-gray-600">Aún no hay colaboradores.</div>
          ) : (
            <div className="space-y-4">
              {members.map((m) => {
                const assigned = areaIdsByMember.get(m.id) ?? [];
                const assignedOptions = assigned.map((id) => areasById.get(id)).filter(Boolean) as AreaOption[];

                const pending = pendingAreasByMember[m.id] ?? [];
                const disabledIds = assigned;

                return (
                  <div key={m.id} className="rounded-2xl border bg-white p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="text-base font-extrabold text-gray-900">{m.full_name}</div>
                        <div className="text-sm font-semibold text-gray-600">{m.position ?? "—"}</div>

                        <div className="mt-3">
                          <div className="text-xs font-extrabold text-gray-500 mb-2">Áreas asignadas</div>

                          {assignedOptions.length ? (
                            <div className="flex flex-wrap gap-2">
                              {assignedOptions.map((a) => (
                                <span
                                  key={a.id}
                                  className="inline-flex items-center gap-2 rounded-full border bg-white px-3 py-1.5 text-sm font-semibold shadow-sm"
                                >
                                  <span className="text-gray-900">{a.type ? `${a.name} · ${a.type}` : a.name}</span>
                                  <button
                                    type="button"
                                    onClick={() => removeAreaFromMember(m.id, a.id)}
                                    disabled={saving}
                                    className="rounded-full border bg-gray-50 px-2 py-0.5 text-xs font-extrabold hover:bg-gray-100 disabled:opacity-60"
                                  >
                                    Quitar
                                  </button>
                                </span>
                              ))}
                            </div>
                          ) : (
                            <div className="text-sm font-semibold text-gray-600">Sin áreas asignadas.</div>
                          )}
                        </div>
                      </div>

                      <span className="rounded-full border border-green-200 bg-green-50 px-3 py-1 text-sm font-extrabold text-green-700">
                        {m.active ? "Activo" : "Inactivo"}
                      </span>
                    </div>

                    <div className="mt-4">
                      <AreaMultiSelect
                        label=""
                        options={areas}
                        value={pending}
                        onChange={(next) => setPendingAreasByMember((prev) => ({ ...prev, [m.id]: next }))}
                        disabledIds={disabledIds}
                        placeholder="Añadir área…"
                        hint="Selecciona varias y luego pulsa Añadir."
                      />

                      <div className="mt-3 flex gap-2">
                        <button
                          onClick={() => addAreasToMember(m.id)}
                          disabled={saving || pending.length === 0}
                          className="rounded-2xl bg-black px-4 py-2.5 text-sm font-extrabold text-white disabled:opacity-60"
                        >
                          {saving ? "Guardando…" : "Añadir"}
                        </button>

                        <button
                          onClick={() => setPendingAreasByMember((prev) => ({ ...prev, [m.id]: [] }))}
                          disabled={saving || pending.length === 0}
                          className="rounded-2xl border bg-white px-4 py-2.5 text-sm font-extrabold hover:bg-gray-50 disabled:opacity-60"
                        >
                          Limpiar
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}