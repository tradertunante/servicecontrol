// FILE: app/(app)/areas/order/page.tsx
"use client";

import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { setActiveHotel } from "@/lib/auth/activeHotelClient";
import HotelHeader from "@/app/components/HotelHeader";
import type { Profile } from "@/lib/types";

type HotelRow = { id: string; name: string; created_at?: string | null };
type AreaRow = { id: string; name: string; type: string | null; hotel_id: string | null; sort_order: number | null };

export default function OrderAreasPageClient({
  initialProfile,
  initialActiveHotelId,
}: {
  initialProfile: Profile;
  initialActiveHotelId: string;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [busySave, setBusySave] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [profile] = useState<Profile>(initialProfile);
  const [hotels, setHotels] = useState<HotelRow[]>([]);
  const [activeHotelId, setActiveHotelId] = useState<string | null>(initialActiveHotelId || null);
  const [areas, setAreas] = useState<AreaRow[]>([]);

  const fg = "var(--text)";
  const bg = "var(--bg)";
  const inputBg = "var(--input-bg)";
  const inputBorder = "var(--input-border)";
  const cardBg = "var(--card-bg, rgba(255,255,255,0.92))";
  const border = "var(--border, rgba(0,0,0,0.12))";
  const shadowSm = "var(--shadow-sm, 0 4px 16px rgba(0,0,0,0.06))";
  const shadowLg = "var(--shadow-lg, 0 10px 30px rgba(0,0,0,0.20))";
  const rowBg = "var(--row-bg, rgba(0,0,0,0.04))";

  const styles = useMemo(() => {
    const page: CSSProperties = { padding: 24, paddingTop: 80, background: bg, color: fg, minHeight: "100vh" };
    const header: CSSProperties = { display: "flex", justifyContent: "space-between", alignItems: "flex-end", gap: 12, flexWrap: "wrap", marginBottom: 16 };
    const h1: CSSProperties = { fontSize: 28, fontWeight: 950, letterSpacing: -0.4 };
    const sub: CSSProperties = { marginTop: 6, opacity: 0.75, fontSize: 13 };
    const card: CSSProperties = { background: cardBg, border: `1px solid ${border}`, borderRadius: 18, boxShadow: shadowLg, padding: 18 };
    const row: CSSProperties = { background: rowBg, border: `1px solid ${border}`, borderRadius: 14, padding: "12px 14px", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" };
    const btn: CSSProperties = { padding: "10px 14px", borderRadius: 12, border: `1px solid ${inputBorder}`, background: inputBg, color: fg, fontWeight: 950, cursor: "pointer", boxShadow: shadowSm, whiteSpace: "nowrap" };
    const btnDark: CSSProperties = { padding: "10px 14px", borderRadius: 12, border: "1px solid rgba(0,0,0,0.18)", background: "#000", color: "#fff", fontWeight: 950, cursor: "pointer", boxShadow: shadowSm, whiteSpace: "nowrap" };
    const mini: CSSProperties = { padding: "8px 10px", borderRadius: 10, border: `1px solid ${inputBorder}`, background: inputBg, color: fg, fontWeight: 950, cursor: "pointer", boxShadow: shadowSm, whiteSpace: "nowrap", fontSize: 12 };
    const tag: CSSProperties = { padding: "6px 10px", borderRadius: 999, border: `1px solid ${border}`, background: "rgba(0,0,0,0.03)", fontSize: 12, fontWeight: 950, textTransform: "uppercase", letterSpacing: 0.4, opacity: 0.85 };
    return { page, header, h1, sub, card, row, btn, btnDark, mini, tag };
  }, [bg, fg, border, inputBg, inputBorder, rowBg, cardBg, shadowLg, shadowSm]);

  const normalizeOrder = (list: AreaRow[]): AreaRow[] => {
    const sorted = [...list].sort((a, b) => {
      const ao = a.sort_order; const bo = b.sort_order;
      const aHas = typeof ao === "number" && Number.isFinite(ao);
      const bHas = typeof bo === "number" && Number.isFinite(bo);
      if (aHas && bHas) return (ao as number) - (bo as number);
      if (aHas && !bHas) return -1;
      if (!aHas && bHas) return 1;
      return a.name.localeCompare(b.name, "es");
    });
    return sorted.map((a, idx) => ({ ...a, sort_order: idx + 1 }));
  };

  const loadAreas = async (hotelId: string) => {
    const { data, error: aErr } = await supabase.from("areas").select("id,name,type,hotel_id,sort_order").eq("hotel_id", hotelId).order("sort_order", { ascending: true, nullsFirst: false }).order("name", { ascending: true });
    if (aErr) throw aErr;
    setAreas(normalizeOrder((data ?? []) as AreaRow[]));
  };

  useEffect(() => {
    const controller = new AbortController();
    (async () => {
      setLoading(true); setError(null);
      try {
        if (profile.role === "superadmin") {
          const { data: hData, error: hErr } = await supabase.from("hotels").select("id,name,created_at").order("created_at", { ascending: false });
          if (hErr) throw hErr;
          if (controller.signal.aborted) return;
          setHotels((hData ?? []) as HotelRow[]);
          if (initialActiveHotelId) await loadAreas(initialActiveHotelId);
          setLoading(false);
          return;
        }

        if (!initialActiveHotelId) { setError("Tu usuario no tiene hotel asignado."); setLoading(false); return; }
        await loadAreas(initialActiveHotelId);
        setLoading(false);
      } catch (e: any) {
        if (e instanceof DOMException && e.name === "AbortError") return;
        if (controller.signal.aborted) return;
        setError(e?.message ?? "No se pudo cargar el orden de áreas.");
        setLoading(false);
      }
    })();
    return () => { controller.abort(); };
  }, [initialActiveHotelId, profile.role]);

  const move = (index: number, dir: -1 | 1) => {
    setAreas((prev) => {
      const list = [...prev];
      const to = index + dir;
      if (to < 0 || to >= list.length) return prev;
      const tmp = list[index]; list[index] = list[to]; list[to] = tmp;
      return list.map((a, idx) => ({ ...a, sort_order: idx + 1 }));
    });
  };

  const resetAZ = () => {
    setAreas((prev) => [...prev].sort((a, b) => a.name.localeCompare(b.name, "es")).map((a, idx) => ({ ...a, sort_order: idx + 1 })));
  };

  const save = async () => {
    if (!activeHotelId) return;
    setBusySave(true); setError(null);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData?.session?.access_token;
      if (!accessToken) throw new Error("Sesión inválida.");
      const response = await fetch("/api/areas/reorder", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          area_ids: areas.map((area) => area.id),
        }),
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok) throw new Error(payload?.error ?? "No se pudo guardar el orden.");
      await loadAreas(activeHotelId);
    } catch (e: any) {
      setError(e?.message ?? "No se pudo guardar el orden.");
    } finally {
      setBusySave(false);
    }
  };

  if (loading) return <main style={styles.page}><HotelHeader /><div style={{ opacity: 0.8 }}>Cargando…</div></main>;
  if (error) return <main style={styles.page}><HotelHeader /><div style={{ color: "var(--danger, crimson)", fontWeight: 900 }}>{error}</div></main>;

  if (profile?.role === "superadmin" && !activeHotelId) {
    return (
      <main style={styles.page}>
        <HotelHeader />
        <div style={{ ...styles.card, margin: "0 auto" }}>
          <div style={styles.h1}>Elige un hotel</div>
          <div style={styles.sub}>Primero selecciona el hotel para ordenar sus áreas.</div>
          <div style={{ marginTop: 16, display: "grid", gap: 10 }}>
            {hotels.length === 0 ? <div style={{ opacity: 0.7 }}>No hay hoteles creados todavía.</div> : hotels.map((h) => (
              <button key={h.id} onClick={async () => { await setActiveHotel(h.id); setActiveHotelId(h.id); setLoading(true); try { await loadAreas(h.id); } finally { setLoading(false); } }} style={styles.btn}>
                <span style={{ fontWeight: 950 }}>{h.name}</span> <span style={{ opacity: 0.7 }}>· Entrar →</span>
              </button>
            ))}
          </div>
        </div>
      </main>
    );
  }

  const selectedHotelName = hotels.find((h) => h.id === activeHotelId)?.name ?? "Hotel";

  return (
    <main style={styles.page}>
      <HotelHeader />
      <div style={styles.header}>
        <div>
          <div style={styles.h1}>Ordenar áreas</div>
          <div style={styles.sub}>Hotel: <strong>{selectedHotelName}</strong> · Esto afecta el orden en el dashboard (heatmap).</div>
        </div>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <button style={styles.btn} onClick={() => router.push("/dashboard")}>← Volver al dashboard</button>
          <button style={styles.btn} onClick={resetAZ}>Reset A→Z</button>
          {profile?.role === "superadmin" && (
            <button style={styles.btn} onClick={() => { void setActiveHotel(null).then(() => { setActiveHotelId(null); setAreas([]); }); }}>Cambiar hotel</button>
          )}
          <button style={{ ...styles.btnDark, opacity: busySave ? 0.7 : 1, cursor: busySave ? "not-allowed" : "pointer" }} onClick={save} disabled={busySave}>
            {busySave ? "Guardando…" : "Guardar orden"}
          </button>
        </div>
      </div>
      <div style={styles.card}>
        {areas.length === 0 ? <div style={{ opacity: 0.7 }}>No hay áreas todavía.</div> : (
          <div style={{ display: "grid", gap: 10 }}>
            {areas.map((a, idx) => (
              <div key={a.id} style={styles.row}>
                <div style={{ minWidth: 260 }}>
                  <div style={{ fontWeight: 950, fontSize: 16 }}>{idx + 1}. {a.name}</div>
                  <div style={{ marginTop: 4, fontSize: 12, opacity: 0.75 }}>ID: {a.id} {a.type ? `· ${a.type}` : ""}</div>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                  <span style={styles.tag}>#{idx + 1}</span>
                  <button style={styles.mini} onClick={() => move(idx, -1)} disabled={idx === 0}>↑ Subir</button>
                  <button style={styles.mini} onClick={() => move(idx, 1)} disabled={idx === areas.length - 1}>↓ Bajar</button>
                </div>
              </div>
            ))}
          </div>
        )}
        <div style={{ marginTop: 14, fontSize: 12, opacity: 0.7 }}>Consejo: ordena como lo quieres ver en el heatmap. Luego pulsa <strong>Guardar orden</strong>.</div>
      </div>
    </main>
  );
}
