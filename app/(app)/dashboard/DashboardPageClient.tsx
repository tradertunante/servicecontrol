"use client";

import { useEffect, useMemo, useState } from "react";
import type { CSSProperties } from "react";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { ACTIVE_HOTEL_QUERY_KEY } from "@/hooks/useHotelId";

import { setActiveHotel } from "@/lib/auth/activeHotelClient";
import type { Profile } from "@/lib/types";
import type { PackCode } from "@/lib/auth/packs";

import DashboardShell, {
  buildCardStyle,
  buildGhostBtnStyle,
  buildMiniBtnStyle,
} from "./_components/DashboardShell";
import DashboardTopBar from "./_components/DashboardTopBar";
import HotelPicker from "./_components/HotelPicker";
import GaugesRow from "./_components/GaugesRow";
import HeatMapCard from "./_components/HeatMapCard";
import AreaRankings from "./_components/AreaRankings";
import WorstAuditsCard from "./_components/WorstAuditsCard";
import PendingTeamsCard from "./_components/PendingTeamsCard";
import QuickLinks from "./_components/QuickLinks";
import AreaTrendCard from "./_components/AreaTrendCard";
import NarrativeWidget from "./_components/NarrativeWidget";
import { useDashboardData } from "./_hooks/useDashboardData";
import type { HeatMode } from "./_lib/dashboardUtils";

export default function DashboardPageClient({
  initialProfile,
  initialHotelId,
  enabledPacks,
}: {
  initialProfile: Profile;
  initialHotelId: string | null;
  enabledPacks: PackCode[];
}) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const t = useTranslations("app.common");
  const [profile] = useState<Profile>(initialProfile);
  const [activeHotelId, setActiveHotelId] = useState<string | null>(initialHotelId);
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

  const hasPack1 = enabledPacks.includes("pack1");
  const hasPackIt = enabledPacks.includes("pack_it");
  const hasPackEngineering = enabledPacks.includes("pack_engineering");
  const hasPackItOrEngineering = hasPackIt || hasPackEngineering;

  const {
    loading, error, hotels, areas, runs,
    monthScore, quarterScore, yearScore,
    prevMonthScore, prevQuarterScore, prevYearScore,
    heatMapData, heatMapDataInternal, heatMapDataQuality,
    monthLabels, availableYears,
    top3Areas, worst3Areas, worst3Audits, pendingByTeam,
    selectedHotelName, canChooseHotel, resetForHotelChange,
  } = useDashboardData({ profile, activeHotelId, setActiveHotelId, heatMode, selectedYear, hasPackIt, hasPackEngineering });

  useEffect(() => {
    if (!availableYears.length) return;
    if (!availableYears.includes(selectedYear)) setSelectedYear(availableYears[0]);
  }, [availableYears, selectedYear]);

  const goAreaDetail = (areaId: string) => router.push(`/team/general?area=${areaId}`);
  const goWorstAuditDetail = (areaId: string, templateId: string) =>
    router.push(`/team/historial?area=${areaId}&template=${templateId}&period=THIS_MONTH`);
  const goPendingTeamDetail = (teamKey: "it" | "maintenance") =>
    router.push(teamKey === "it" ? "/it" : "/engineering");

  const handleChangeHotel = () => {
    void (async () => {
      await setActiveHotel(null);
      await queryClient.invalidateQueries({ queryKey: ACTIVE_HOTEL_QUERY_KEY });
      setActiveHotelId(null);
      resetForHotelChange();
    })();
  };

  if (profile.role === "superadmin" && !activeHotelId) {
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
        <div style={{ opacity: 0.8 }}>{t("loading")}</div>
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

      <GaugesRow
        card={card}
        monthScore={monthScore}
        quarterScore={quarterScore}
        yearScore={yearScore}
        prevMonthScore={prevMonthScore}
        prevQuarterScore={prevQuarterScore}
        prevYearScore={prevYearScore}
      />

      <NarrativeWidget hotelId={activeHotelId} />

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

      <AreaTrendCard runs={runs} areas={areas} />

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

      {hasPackItOrEngineering && (
        <PendingTeamsCard
          card={card}
          rowBg={rowBg}
          border={border}
          fg={fg}
          miniBtn={miniBtn}
          pendingByTeam={pendingByTeam}
          onGoDetail={goPendingTeamDetail}
        />
      )}

      <QuickLinks
        routerPush={(path) => router.push(path)}
        inputBorder={inputBorder}
        inputBg={inputBg}
        fg={fg}
        shadowSm={shadowSm}
        showAnalytics={hasPack1}
      />
    </DashboardShell>
  );
}

const dashCss = `
  .dash { padding: 24px; overflow-x: hidden; }
  .topBar { display:flex; justify-content:space-between; align-items:center; gap:12px; margin-bottom:18px; }
  .topText { opacity:0.7; font-size:14px; line-height:1.25; }
  .sectionTitle { font-size:22px; font-weight:950; letter-spacing:0.4px; margin-bottom:22px; }
  .gridGauges { display:grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap:16px; }
  @media (max-width: 720px) {
    .dash { padding: 6px 4px; }
  }
`;
