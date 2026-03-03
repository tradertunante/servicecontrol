// app/areas/page.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { requireRoleOrRedirect } from "@/lib/auth/RequireRole";
import HotelHeader from "@/app/components/HotelHeader";
import type { Role, Profile } from "@/lib/types";

type AreaRow = { id: string; name: string; type: string | null; hotel_id: string | null; created_at?: string | null };
type HotelRow = { id: string; name: string };

const HOTEL_KEY = "sc_hotel_id";

export default function AreasPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [hotelId, setHotelId] = useState<string | null>(null);
  const [hotelName, setHotelName] = useState<string | null>(null);
  const [areas, setAreas] = useState<AreaRow[]>([]);
  const [query, setQuery] = useState("");

  const fg = "var(--text)"; const bg = "var(--bg)"; const cardBg = "var(--card-bg)";
  const border = "var(--border)"; const rowBg = "var(--row-bg)"; const shadowLg = "var(--shadow-lg)";
  const shadowSm = "var(--shadow-sm)"; const inputBg = "var(--input-bg)"; const inputBorder = "var(--input-border)";

  useEffect(() => {
    let alive = true;
    (async () => {
      setLoading(true); setError(null);
      try {
        // ✅ quality incluido
        const p = (await requireRoleOrRedirect(
          router,
          ["admin", "manager", "auditor", "superadmin", "quality"],
          "/login"
        )) as Profile | null;
        if (!alive || !p) return;
        setProfile(p);

        let hotelIdToUse: string | null = null;
        if (p.role === "superadmin") {
          hotelIdToUse = typeof window !== "undefined" ? localStorage.getItem(HOTEL_KEY) : null;
          if (!hotelIdToUse) { setError("No hay hotel seleccionado. Vuelve al dashboard y selecciona uno."); setLoading(false); return; }
        } else {
          if (!p.hotel_id) { setError("Tu usuario no tiene hotel asignado."); setLoading(false); return; }
          hotelIdToUse = p.hotel_id;
          if (typeof window !== "undefined") localStorage.setItem(HOTEL_KEY, hotelIdToUse);
        }
        setHotelId(hotelIdToUse);

        const { data: h, error: hErr } = await supabase.from("hotels").select("id,name").eq("id", hotelIdToUse).single();
        if (hErr) throw hErr;
        if (!alive) return;
        setHotelName((h as HotelRow)?.name ?? null);
        setLoading(false);
      } catch (e: any) {
        if (!alive) return;
        setError(e?.message ?? "No se pudo cargar la página de áreas.");
        setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, [router]);

  useEffect(() => {
    let alive = true;
    (async () => {
      if (!profile || !hotelId) return;
      setLoading(true); setError(null);
      try {
        // ✅ admin, manager, superadmin y quality ven todas las áreas
        // auditor solo ve sus áreas asignadas
        const isAdminLike = profile.role === "admin" || profile.role === "manager" ||
                            profile.role === "superadmin" || profile.role === "quality";
        let areasList: AreaRow[] = [];

        if (isAdminLike) {
          const { data, error: aErr } = await supabase
            .from("areas")
            .select("id,name,type,hotel_id,created_at")
            .eq("hotel_id", hotelId)
            .order("created_at", { ascending: false });
          if (aErr) throw aErr;
          areasList = (data ?? []) as AreaRow[];
        } else {
          // auditor: solo áreas asignadas
          const { data: accessData, error: accessErr } = await supabase
            .from("user_area_access")
            .select("area_id")
            .eq("user_id", profile.id)
            .eq("hotel_id", hotelId);
          if (accessErr) throw accessErr;
          const allowedIds = (accessData ?? []).map((r: any) => r.area_id).filter(Boolean);
          if (allowedIds.length > 0) {
            const { data: areasData, error: areasErr } = await supabase
              .from("areas")
              .select("id,name,type,hotel_id,created_at")
              .eq("hotel_id", hotelId)
              .in("id", allowedIds)
              .order("created_at", { ascending: false });
            if (areasErr) throw areasErr;
            areasList = (areasData ?? []) as AreaRow[];
          }
        }
        if (!alive) return;
        setAreas(areasList); setLoading(false);
      } catch (e: any) {
        if (!alive) return;
        setError(e?.message ?? "No se pudieron cargar las áreas."); setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, [profile, hotelId]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return areas;
    return areas.filter((a) => `${a.name ?? ""} ${a.type ?? ""} ${a.id ?? ""}`.toLowerCase().includes(q));
  }, [areas, query]);

  const goArea = (areaId: string) => router.push(`/areas/${areaId}?tab=dashboard`);
  const canManage = profile?.role === "admin" || profile?.role === "superadmin";

  return (
    <main className="areasPage" style={{ background: bg, color: fg }}>
      <HotelHeader />
      <div className="areasInner">
        <div className="topBar">
          <div className="topLeft">
            <div className="title">Áreas {hotelName ? <span className="hotel">· {hotelName}</span> : null}</div>
            <div className="meta">Rol: <strong>{profile?.role ?? "—"}</strong> <span className="dot">·</span> Total: <strong>{areas.length}</strong></div>
          </div>
          <div className="topActions">
            <button type="button" onClick={() => router.back()} className="btn">← Atrás</button>
            {canManage && (
              <button type="button" onClick={() => router.push("/admin/areas")} className="btn" title="Gestionar áreas">
                Gestionar
              </button>
            )}
          </div>
        </div>

        <div className="searchRow">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar por nombre, tipo o ID…"
            className="searchInput"
          />
        </div>

        {loading && <div style={{ marginTop: 14, opacity: 0.8 }}>Cargando…</div>}
        {error && <div className="errorBox">{error}</div>}

        {!loading && !error && (
          <div className="list">
            {filtered.length === 0 ? (
              <div className="card">
                <div style={{ fontWeight: 950 }}>No hay áreas</div>
                <div style={{ marginTop: 6, opacity: 0.75 }}>
                  {query.trim() ? "No hay resultados para tu búsqueda." : "Este hotel todavía no tiene áreas creadas."}
                </div>
              </div>
            ) : (
              filtered.map((a) => (
                <div key={a.id} className="card itemCard">
                  <div className="itemLeft">
                    <div className="areaName">{a.name}</div>
                    <div className="chips">
                      <span className="chip">{a.type ?? "Sin tipo"}</span>
                      <span className="metaSmall">ID: <span className="mono">{a.id}</span></span>
                      {a.created_at ? (
                        <span className="metaSmall">
                          Creada: <span>{new Date(a.created_at).toLocaleDateString("es-ES", { day: "2-digit", month: "short", year: "numeric" })}</span>
                        </span>
                      ) : null}
                    </div>
                  </div>
                  <div className="itemActions">
                    <button type="button" onClick={() => goArea(a.id)} className="primaryBtn enterBtn">Entrar</button>
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </div>

      <style jsx>{`
        .areasPage { padding-top: 80px; min-height: 100vh; }
        .areasInner { padding: 24px; }
        .topBar { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; }
        .topLeft { display: flex; flex-direction: column; gap: 6px; min-width: 0; }
        .title { font-size: 22px; font-weight: 950; line-height: 1.1; }
        .hotel { opacity: 0.65; font-weight: 800; }
        .meta { font-size: 13px; opacity: 0.7; line-height: 1.2; }
        .dot { opacity: 0.6; padding: 0 6px; }
        .topActions { display: flex; gap: 10px; align-items: center; flex-wrap: wrap; justify-content: flex-end; }
        .btn { padding: 10px 12px; border-radius: 12px; border: 1px solid ${inputBorder}; background: ${inputBg}; color: ${fg}; cursor: pointer; font-weight: 950; font-size: 13px; box-shadow: ${shadowSm}; white-space: nowrap; }
        .primaryBtn { padding: 10px 12px; border-radius: 12px; border: 1px solid ${inputBorder}; background: ${fg}; color: ${bg}; cursor: pointer; font-weight: 950; font-size: 13px; box-shadow: ${shadowSm}; white-space: nowrap; }
        .searchRow { margin-top: 16px; display: flex; gap: 12px; align-items: center; }
        .searchInput { width: 100%; padding: 12px 14px; border-radius: 14px; border: 1px solid ${inputBorder}; background: var(--input-bg); color: var(--input-text); box-shadow: ${shadowSm}; outline: none; }
        .errorBox { margin-top: 14px; padding: 12px; border-radius: 14px; border: 1px solid var(--danger, #c62828); background: rgba(198,40,40,0.08); color: var(--danger, #c62828); font-weight: 900; }
        .list { margin-top: 16px; display: grid; gap: 14px; }
        .card { border-radius: 18px; border: 1px solid ${border}; background: ${cardBg}; padding: 16px; box-shadow: ${shadowLg}; color: ${fg}; }
        .itemCard { display: flex; justify-content: space-between; align-items: center; gap: 12px; }
        .itemLeft { min-width: 0; flex: 1; }
        .areaName { font-size: 18px; font-weight: 950; line-height: 1.1; }
        .chips { margin-top: 8px; display: flex; gap: 10px; flex-wrap: wrap; align-items: center; }
        .chip { padding: 4px 10px; border-radius: 999px; background: ${rowBg}; border: 1px solid ${border}; font-size: 12px; font-weight: 900; opacity: 0.9; white-space: nowrap; }
        .metaSmall { font-size: 12px; opacity: 0.75; line-height: 1.2; }
        .mono { font-family: ui-monospace, monospace; word-break: break-all; opacity: 0.9; }
        .itemActions { display: flex; gap: 10px; align-items: center; justify-content: flex-end; }
        @media (max-width: 720px) {
          .areasInner { padding: 14px 12px; }
          .topBar { flex-direction: column; align-items: stretch; gap: 12px; }
          .topActions { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
          .btn, .primaryBtn { width: 100%; }
          .itemCard { flex-direction: column; align-items: stretch; gap: 12px; }
          .itemActions { display: grid; grid-template-columns: 1fr; gap: 10px; }
          .enterBtn { width: 100%; }
        }
      `}</style>
    </main>
  );
}