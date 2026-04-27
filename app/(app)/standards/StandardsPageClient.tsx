// app/standards/page.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/app/providers/ToastProvider";
import { supabase } from "@/lib/supabaseClient";
import { setActiveHotel } from "@/lib/auth/activeHotelClient";
import HotelHeader from "@/app/components/HotelHeader";
import BackButton from "@/app/components/BackButton";
import type { Profile } from "@/lib/types";

type GlobalPack = { id: string; business_type: string; name: string; description: string | null; active: boolean; created_at?: string | null };
type Area = { id: string; name: string; type: string | null };
type HotelTemplate = { id: string; name: string; active: boolean | null; hotel_id: string | null; pack_id: string | null; area_id: string | null; source_template_id: string | null };

export default function StandardsPageClient({
  initialProfile,
  hotelId,
}: {
  initialProfile: Profile;
  hotelId: string;
}) {
  const router = useRouter();
  const toast = useToast();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [profile] = useState<Profile>(initialProfile);
  const [hotelIdInUse] = useState<string | null>(hotelId || null);
  const [globalPacks, setGlobalPacks] = useState<GlobalPack[]>([]);
  const [busyPackId, setBusyPackId] = useState<string | null>(null);
  const [areas, setAreas] = useState<Area[]>([]);
  const [hotelTemplates, setHotelTemplates] = useState<HotelTemplate[]>([]);
  const [savingTemplateId, setSavingTemplateId] = useState<string | null>(null);
  const [duplicatingTemplateId, setDuplicatingTemplateId] = useState<string | null>(null);

  async function loadAll(hotelIdToUse: string) {
    const { data: packs, error: packErr } = await supabase.from("global_audit_packs").select("id, business_type, name, description, active, created_at").eq("active", true).eq("business_type", "hotel").order("created_at", { ascending: false });
    if (packErr) throw packErr;
    setGlobalPacks((packs ?? []) as GlobalPack[]);

    const { data: aData, error: aErr } = await supabase.from("areas").select("id, name, type").eq("hotel_id", hotelIdToUse).order("name", { ascending: true });
    if (aErr) throw aErr;
    setAreas((aData ?? []) as Area[]);

    const { data: tData, error: tErr } = await supabase.from("audit_templates").select("id, name, active, hotel_id, pack_id, area_id, source_template_id").eq("hotel_id", hotelIdToUse).not("pack_id", "is", null).order("name", { ascending: true });
    if (tErr) throw tErr;
    setHotelTemplates((tData ?? []) as HotelTemplate[]);
  }

  useEffect(() => {
    let alive = true;
    (async () => {
      setLoading(true); setError(null);
      try {
        if (!hotelId) throw new Error("No hay hotel activo seleccionado.");
        await loadAll(hotelId);
        if (!alive) return;
        setLoading(false);
      } catch (e: unknown) {
        if (!alive) return;
        setError(e instanceof Error ? e.message : "Error al cargar la biblioteca.");
        setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, [hotelId]);

  const hotelBadge = useMemo(() => {
    if (!profile || profile.role !== "superadmin" || !hotelIdInUse) return null;
    return (
      <div className="mb-4 flex gap-2.5 items-center flex-wrap">
        <span className="px-2.5 py-1.5 rounded-full border border-black/[0.12] bg-black/[0.04] font-black text-xs">
          Hotel en uso: <strong>{hotelIdInUse ? "Seleccionado" : "—"}</strong>
        </span>
        <span className="text-xs opacity-70">ID: {hotelIdInUse}</span>
        <button
          className="px-2.5 py-2 rounded-[10px] border border-black/[0.15] bg-white font-black cursor-pointer text-xs"
          onClick={() => { void setActiveHotel(null).then(() => router.replace("/superadmin/hotels")); }}
        >
          Cambiar hotel
        </button>
      </div>
    );
  }, [profile, hotelIdInUse, router]);

  const syncPackToHotel = async (packId: string) => {
    if (!hotelIdInUse) { toast.warn("No hay hotel seleccionado."); return; }
    setBusyPackId(packId);
    try {
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token ?? "";
      if (!token) throw new Error("Sesion invalida.");

      const res = await fetch("/api/standards/actions", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ action: "sync_pack", pack_id: packId }),
      });
      const payload = await res.json().catch(() => null);
      if (!res.ok) throw new Error(payload?.error ?? "No se pudo actualizar el pack.");
      const added = payload?.added ?? 0;
      toast.success(added > 0 ? `${added} plantilla${added > 1 ? "s" : ""} nueva${added > 1 ? "s" : ""} añadida${added > 1 ? "s" : ""}.` : "El pack ya estaba al día.");
      await loadAll(hotelIdInUse);
    } catch (e: unknown) { toast.error(e instanceof Error ? e.message : "No se pudo actualizar el pack."); }
    finally { setBusyPackId(null); }
  };

  const duplicatePackToHotel = async (packId: string) => {
    if (!hotelIdInUse) { toast.warn("No hay hotel seleccionado."); return; }
    setBusyPackId(packId);
    try {
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token ?? "";
      if (!token) throw new Error("Sesion invalida.");

      const res = await fetch("/api/standards/actions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          action: "clone_pack",
          pack_id: packId,
        }),
      });
      const payload = await res.json().catch(() => null);
      if (!res.ok) throw new Error(payload?.error ?? "No se pudo duplicar el pack.");
      toast.success("Pack duplicado correctamente en el hotel.");
      await loadAll(hotelIdInUse);
    } catch (e: unknown) { toast.error(e instanceof Error ? e.message : "No se pudo duplicar el pack."); }
    finally { setBusyPackId(null); }
  };

  const setTemplateArea = async (templateId: string, areaId: string | null) => {
    if (!hotelIdInUse) return;
    setSavingTemplateId(templateId);
    try {
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token ?? "";
      if (!token) throw new Error("Sesion invalida.");

      const res = await fetch("/api/standards/actions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          action: "set_template_area",
          template_id: templateId,
          area_id: areaId,
        }),
      });
      const payload = await res.json().catch(() => null);
      if (!res.ok) throw new Error(payload?.error ?? "No se pudo asignar el area.");
      await loadAll(hotelIdInUse);
    } catch (e: unknown) { toast.error(e instanceof Error ? e.message : "No se pudo asignar el área."); }
    finally { setSavingTemplateId(null); }
  };

  const duplicateHotelTemplate = async (template: HotelTemplate) => {
    if (!hotelIdInUse) { toast.warn("No hay hotel seleccionado."); return; }
    const name = window.prompt("Nombre para la copia:", `${template.name} (Copia)`);
    if (!name) return;
    setDuplicatingTemplateId(template.id);
    try {
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token ?? "";
      if (!token) throw new Error("Sesion invalida.");

      const res = await fetch("/api/standards/actions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          action: "clone_template",
          template_id: template.id,
          new_name: name,
        }),
      });
      const payload = await res.json().catch(() => null);
      if (!res.ok) throw new Error(payload?.error ?? "No se pudo duplicar la auditoria.");
      await loadAll(hotelIdInUse);
    } catch (e: unknown) { toast.error(e instanceof Error ? e.message : "No se pudo duplicar la auditoría."); }
    finally { setDuplicatingTemplateId(null); }
  };

  const templatesByPack = useMemo(() => {
    const map = new Map<string, HotelTemplate[]>();
    for (const t of hotelTemplates) { const k = t.pack_id ?? "—"; if (!map.has(k)) map.set(k, []); map.get(k)!.push(t); }
    return map;
  }, [hotelTemplates]);

  const areaName = useMemo(() => { const m = new Map<string, string>(); for (const a of areas) m.set(a.id, a.name); return m; }, [areas]);

  if (loading) return (
    <main className="p-6 pt-20">
      <HotelHeader />
      <BackButton fallback="/builder" />
      <div className="opacity-80">Cargando…</div>
    </main>
  );
  if (error) return (
    <main className="p-6 pt-20">
      <HotelHeader />
      <BackButton fallback="/builder" />
      <div className="text-[crimson] font-black">{error}</div>
    </main>
  );

  return (
    <main className="p-6 pt-20">
      <HotelHeader />
      <BackButton fallback="/builder" />
      <div className="mb-[14px]">
        <div className="text-[30px] font-black tracking-[-0.3px]">📚 Biblioteca de Estándares</div>
        <div className="opacity-75 mt-1.5">Importa packs globales y asigna cada auditoría a un área del hotel.</div>
      </div>
      {hotelBadge}
      <div className="grid gap-4">
        <div className="rounded-[18px] border border-black/[0.08] bg-white/85 p-5 shadow-[0_10px_30px_rgba(0,0,0,0.06)]">
          <div className="text-lg font-black mb-3">🌍 Packs Globales</div>
          {globalPacks.length === 0 ? (
            <div className="opacity-70">No hay packs globales activos para Hotel.</div>
          ) : (
            <div className="grid gap-2.5">
              {globalPacks.map((p) => (
                <div key={p.id} className="flex justify-between items-center px-[14px] py-3 bg-black/[0.02] rounded-xl border border-black/[0.06] gap-3 flex-wrap">
                  <div className="min-w-[260px]">
                    <div className="font-black">{p.name}</div>
                    <div className="opacity-75 text-[13px] mt-1.5">Tipo: {p.business_type} {p.description ? `· ${p.description}` : ""}</div>
                    <div className="text-xs opacity-65 mt-1.5">ID: {p.id}</div>
                  </div>
                  <div className="flex gap-2.5 items-center flex-wrap">
                    <button
                      className="px-[14px] py-2.5 rounded-xl border border-black/20 bg-white text-black font-black cursor-pointer text-sm whitespace-nowrap"
                      onClick={() => router.push(`/superadmin/global-audits/${p.id}`)}
                    >
                      Ver (admin)
                    </button>
                    <button
                      className={`px-[14px] py-2.5 rounded-xl border border-black/20 bg-black text-white font-black text-sm whitespace-nowrap ${busyPackId === p.id ? "opacity-70 cursor-not-allowed" : "opacity-100 cursor-pointer"}`}
                      onClick={() => duplicatePackToHotel(p.id)}
                      disabled={busyPackId === p.id}
                    >
                      {busyPackId === p.id ? "Duplicando…" : "Duplicar pack a mi hotel"}
                    </button>
                    <button
                      className={`px-[14px] py-2.5 rounded-xl border border-black/20 bg-white text-black font-black text-sm whitespace-nowrap ${busyPackId === p.id ? "opacity-70 cursor-not-allowed" : "opacity-100 cursor-pointer"}`}
                      onClick={() => syncPackToHotel(p.id)}
                      disabled={busyPackId === p.id}
                    >
                      {busyPackId === p.id ? "Actualizando…" : "Actualizar pack"}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="rounded-[18px] border border-black/[0.08] bg-white/85 p-5 shadow-[0_10px_30px_rgba(0,0,0,0.06)]">
          <div className="text-lg font-black mb-2">🏨 En mi hotel</div>
          <div className="opacity-75 text-[13px] mb-3">
            Aquí ves lo importado. Asigna un área a cada auditoría para que aparezca en el Builder. Usa &quot;Duplicar&quot; si necesitas varias instancias (p. ej. varios restaurantes).
          </div>
          {hotelTemplates.length === 0 ? (
            <div className="opacity-70">Aún no hay auditorías importadas desde packs.</div>
          ) : (
            <div className="grid gap-[14px]">
              {Array.from(templatesByPack.entries()).map(([packId, templates]) => {
                const packName = globalPacks.find((p) => p.id === packId)?.name ?? `Pack ${packId}`;
                return (
                  <div key={packId} className="p-[14px] rounded-[14px] border border-black/[0.08] bg-black/[0.02]">
                    <div className="font-black mb-2.5">{packName}</div>
                    <div className="grid gap-2">
                      {templates.map((t) => (
                        <div key={t.id} className="flex justify-between items-center px-[14px] py-3 bg-black/[0.02] rounded-xl border border-black/[0.06] gap-3 flex-wrap">
                          <div className="min-w-[260px]">
                            <div className="font-black">{t.name}</div>
                            <div className="opacity-75 text-[13px] mt-1.5">Área: {t.area_id ? areaName.get(t.area_id) ?? "—" : "Sin asignar"}</div>
                          </div>
                          <div className="flex gap-2.5 items-center flex-wrap">
                            <select
                              value={t.area_id ?? ""}
                              onChange={(e) => setTemplateArea(t.id, e.target.value ? e.target.value : null)}
                              className="px-3 py-2.5 rounded-xl border border-black/[0.18] bg-white font-black h-[42px] min-w-[220px]"
                              disabled={savingTemplateId === t.id || duplicatingTemplateId === t.id}
                            >
                              <option value="">(Sin área)</option>
                              {areas.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
                            </select>
                            <button
                              className="px-[14px] py-2.5 rounded-xl border border-black/20 bg-white text-black font-black cursor-pointer text-sm whitespace-nowrap"
                              onClick={() => duplicateHotelTemplate(t)}
                              disabled={duplicatingTemplateId === t.id}
                              title="Crea una copia de esta auditoría para asignarla a otro restaurante/área"
                            >
                              {duplicatingTemplateId === t.id ? "Duplicando…" : "Duplicar"}
                            </button>
                            <button
                              className="px-[14px] py-2.5 rounded-xl border border-black/20 bg-white text-black font-black cursor-pointer text-sm whitespace-nowrap"
                              onClick={() => router.push(`/builder/${t.id}`)}
                              disabled={duplicatingTemplateId === t.id}
                            >
                              Editar
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
