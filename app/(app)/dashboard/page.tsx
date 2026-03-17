// FILE: app/(app)/dashboard/page.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import type { CSSProperties } from "react";
import { useRouter } from "next/navigation";
import { fetchActiveHotel, setActiveHotel } from "@/lib/auth/activeHotelClient";
import { getClientProfile } from "@/lib/auth/clientProfile";
import { isRoleAllowed } from "@/lib/auth/permissions";
import type { Profile } from "@/lib/types";

import DashboardShell, { buildCardStyle, buildGhostBtnStyle, buildMiniBtnStyle } from "./_components/DashboardShell";
import DashboardTopBar from "./_components/DashboardTopBar";
import HotelPicker from "./_components/HotelPicker";
import GaugesRow from "./_components/GaugesRow";
import HeatMapCard from "./_components/HeatMapCard";
import AreaRankings from "./_components/AreaRankings";
import WorstAuditsCard from "./_components/WorstAuditsCard";
import QuickLinks from "./_components/QuickLinks";

import { useDashboardData } from "./_hooks/useDashboardData";
import type { HeatMode } from "./_lib/dashboardUtils";

export default function DashboardPage() {
  const router = useRouter();

  const [authLoading, setAuthLoading] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [activeHotelId, setActiveHotelId] = useState<string | null>(null);
  const [heatMode, setHeatMode] = useState<HeatMode>("YEAR");
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());

  const fg = "var(--text)";
  const bg = "var(--bg)";
  const inputBg = "var(--input-bg)";
  const inputBorder = "var(--input-border)";
  const cardBg = "var(--card-bg, rgba(255,255,255,0.92))";
  const border = "var(--border, rgba(0,0,0,0.12))";
  const shadowLg = "var(--shadow-lg, 0 10px 30px rgba(0,0,0,0.20))";
  const shadowSm = "var(--shadow-sm, 0 4px 16px rgba(0,0,0,0.06))";
  const rowBg = "var(--row-bg, rgba(0,0,0,0.04))";

  const card = useMemo(() => buildCardStyle({ fg, border, cardBg, shadowLg }), [fg, border, cardBg, shadowLg]);
  const miniBtn: CSSProperties = useMemo(() => buildMiniBtnStyle({ fg, border, inputBg }), [fg, border, inputBg]);
  const ghostBtn: CSSProperties = useMemo(() => buildGhostBtnStyle({ fg, border, inputBg, shadowSm }), [fg, border, inputBg, shadowSm]);

  useEffect(() => {
    let alive = true;
    (async () => {
      setAuthLoading(true);
      setAuthError(null);
      try {
        const p = await getClientProfile();

        if (!alive || !p) return;
        if (!isRoleAllowed(p.role, ["admin", "general_manager", "quality", "superadmin"])) {
          setAuthError("No tienes permisos para ver el dashboard.");
          return;
        }
        setProfile(p);

        if (p.role === "superadmin") {
          const activeHotel = await fetchActiveHotel();
          setActiveHotelId(activeHotel.hotel_id ?? null);
        } else {
          if (!p.hotel_id) {
            setAuthError("Tu usuario no tiene hotel asignado.");
          } else {
            setActiveHotelId(p.hotel_id);
          }
        }
      } catch (e: any) {
        setAuthError(e?.message ?? "No se pudo cargar el dashboard.");
      } finally {
        if (alive) setAuthLoading(false);
      }
    })();
    return () => { alive = false; };
  }, []);

  // ✅ heatMapDataInternal y heatMapDataQuality añadidos
  const {
    loading,
    error,
    hotels,
    areas,
    runs,
    monthScore,
    quarterScore,
    yearScore,
    heatMapData,
    heatMapDataInternal,
    heatMapDataQuality,
    monthLabels,
    availableYears,
    top3Areas,
    worst3Areas,
    worst3Audits,
    selectedHotelName,
    canChooseHotel,
    resetForHotelChange,
  } = useDashboardData({ profile, activeHotelId, setActiveHotelId, heatMode, selectedYear });

  useEffect(() => {
    if (!availableYears?.length) return;
    if (!availableYears.includes(selectedYear)) setSelectedYear(availableYears[0]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [availableYears?.join(","), selectedYear]);

  const goAreaDetail = (areaId: string) => {
    router.push(`/areas/${areaId}?tab=dashboard&period=THIS_YEAR&template=ALL`);
  };

  const goWorstAuditDetail = (areaId: string, templateId: string) => {
    router.push(`/areas/${areaId}?tab=dashboard&period=THIS_MONTH&template=${templateId}`);
  };

  const handleChangeHotel = () => {
    void (async () => {
      await setActiveHotel(null);
      setActiveHotelId(null);
      resetForHotelChange();
    })();
  };

  if (authLoading) {
    return (
      <DashboardShell bg={bg} fg={fg} css={dashCss}>
        <div style={{ opacity: 0.8 }}>Cargando…</div>
      </DashboardShell>
    );
  }

  if (authError) {
    return (
      <DashboardShell bg={bg} fg={fg} css={dashCss}>
        <div style={{ color: "var(--danger, crimson)", fontWeight: 900 }}>{authError}</div>
      </DashboardShell>
    );
  }

  if (profile?.role === "superadmin" && !activeHotelId) {
    return (
      <>
        <HotelPicker
          hotels={hotels}
          card={card}
          ghostBtn={ghostBtn}
          fg={fg}
          bg={bg}
          activeHotelId={activeHotelId}
          setActiveHotelId={setActiveHotelId}
        />
        <style jsx>{dashCss}</style>
      </>
    );
  }

  if (loading) {
    return (
      <DashboardShell bg={bg} fg={fg} css={dashCss}>
        <div style={{ opacity: 0.8 }}>Cargando…</div>
      </DashboardShell>
    );
  }

  if (error) {
    return (
      <DashboardShell bg={bg} fg={fg} css={dashCss}>
        <div style={{ color: "var(--danger, crimson)", fontWeight: 900 }}>{error}</div>
      </DashboardShell>
    );
  }

  return (
    <DashboardShell bg={bg} fg={fg} css={dashCss}>
      <DashboardTopBar
        profile={profile}
        areasCount={areas.length}
        selectedHotelName={selectedHotelName}
        canChooseHotel={canChooseHotel}
        ghostBtn={ghostBtn}
        onChangeHotel={handleChangeHotel}
      />

      <GaugesRow card={card} monthScore={monthScore} quarterScore={quarterScore} yearScore={yearScore} />

      {/* ✅ heatMapDataInternal y heatMapDataQuality pasados al componente */}
      <HeatMapCard
        card={card}
        heatMapData={heatMapData}
        heatMapDataInternal={heatMapDataInternal}
        heatMapDataQuality={heatMapDataQuality}
        monthLabels={monthLabels}
        heatMode={heatMode}
        setHeatMode={setHeatMode}
        selectedYear={selectedYear}
        setSelectedYear={setSelectedYear}
        availableYears={availableYears}
      />

      <AreaRankings
        card={card}
        rowBg={rowBg}
        border={border}
        fg={fg}
        miniBtn={miniBtn}
        top3Areas={top3Areas}
        worst3Areas={worst3Areas}
        runs={runs}
        onGoAreaDetail={goAreaDetail}
        selectedYear={selectedYear}
      />

      <WorstAuditsCard
        card={card}
        rowBg={rowBg}
        border={border}
        fg={fg}
        miniBtn={miniBtn}
        worst3Audits={worst3Audits}
        onGoWorstAuditDetail={goWorstAuditDetail}
      />

      <QuickLinks
        routerPush={(p) => router.push(p)}
        inputBorder={inputBorder}
        inputBg={inputBg}
        fg={fg}
        shadowSm={shadowSm}
      />
    </DashboardShell>
  );
}

const dashCss = `
  .dash{
    padding: 24px;
    overflow-x: hidden;
  }

  .topBar{
    display:flex; justify-content:space-between; align-items:center;
    gap:12px; margin-bottom:18px;
  }

  .topText{ opacity:0.7; font-size:14px; line-height:1.25; }

  .sectionTitle{
    font-size:22px;
    font-weight:950;
    letter-spacing:0.4px;
    margin-bottom:22px;
  }

  .gridGauges{
    display:grid;
    grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
    gap:16px;
  }

  .gridTwo{
    display:grid;
    grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
    gap:16px;
  }

  .gridQuick{
    display:grid;
    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
    gap:14px;
  }

  .rowCard{
    display:flex; justify-content:space-between; align-items:center;
    padding:14px 16px; border-radius:12px; gap:12px;
  }

  .rowLeft{ display:flex; align-items:flex-start; gap:12px; min-width:0; flex:1; }
  .rowBadge{ font-size:22px; line-height:22px; flex-shrink:0; }

  .rowTitle{
    font-weight:950;
    font-size:16px;
    white-space: normal;
    overflow: visible;
    text-overflow: unset;
    word-break: break-word;
    overflow-wrap: anywhere;
  }

  .rowTrend{ margin-top:6px; display:flex; flex-wrap:wrap; gap:10px; opacity:0.85; }
  .rowTrendLabel{ font-size:12px; font-weight:900; }
  .rowTrendItems{ display:flex; gap:10px; flex-wrap:wrap; }
  .rowTrendItem{ font-size:12px; }

  .rowRight{ display:flex; align-items:center; gap:12px; flex-shrink:0; }
  .rowMeta{ font-size:13px; opacity:0.7; white-space:nowrap; }
  .rowScore{ font-weight:950; font-size:20px; white-space:nowrap; }

  @media (max-width: 720px){
    .dash{ padding:14px 12px; }
    .card{ padding:16px !important; border-radius:22px !important; }
    .topBar{ flex-direction:column; align-items:stretch; margin-bottom:14px; }
    .sectionTitle{ font-size:20px; margin-bottom:16px; line-height:1.1; }
    .gridGauges{ grid-template-columns:1fr; gap:12px; }
    .gridTwo{ grid-template-columns:1fr; gap:12px; }
    .gridQuick{ grid-template-columns:1fr; gap:12px; }
    .rowCard{ flex-direction:column; align-items:stretch; gap:10px; }
    .rowRight{ justify-content:space-between; }
    .rowBtn{ width:100%; }
  }
`;
