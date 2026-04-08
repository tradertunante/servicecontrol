"use client";

import type { Profile } from "../_lib/dashboardTypes";
import type { HeatMode } from "../_lib/dashboardUtils";

import { useDashboardFetch } from "./useDashboardFetch";
import { useDashboardScores } from "./useDashboardScores";
import { useDashboardHeatMap } from "./useDashboardHeatMap";
import { useDashboardRankings } from "./useDashboardRankings";

export type { HeatRow } from "./useDashboardHeatMap";
export type { AreaRankingItem, WorstAuditItem } from "./useDashboardRankings";
export type { PendingTeamItem } from "./useDashboardFetch";

export function useDashboardData({
  profile,
  activeHotelId,
  setActiveHotelId,
  heatMode,
  selectedYear,
  hasPack1,
}: {
  profile: Profile | null;
  activeHotelId: string | null;
  setActiveHotelId: (s: string | null) => void;
  heatMode: HeatMode;
  selectedYear: number;
  hasPack1: boolean;
}) {
  const {
    loading, error, hotels, areas, templates, runs,
    pendingByTeam, selectedHotelName, canChooseHotel, resetForHotelChange,
  } = useDashboardFetch({ profile, activeHotelId, setActiveHotelId, heatMode, selectedYear, hasPack1 });

  const {
    monthScore, quarterScore, yearScore,
    prevMonthScore, prevQuarterScore, prevYearScore,
    availableYears,
  } = useDashboardScores(runs);

  const {
    heatMapData, heatMapDataInternal, heatMapDataQuality, monthLabels,
    runsByArea, templateById,
  } = useDashboardHeatMap({ areas, templates, runs, heatMode, selectedYear });

  const { top3Areas, worst3Areas, worst3Audits } = useDashboardRankings({
    areas, runs, runsByArea, templateById, selectedYear,
  });

  return {
    loading, error, hotels, areas, runs,
    monthScore, quarterScore, yearScore,
    prevMonthScore, prevQuarterScore, prevYearScore,
    heatMapData, heatMapDataInternal, heatMapDataQuality,
    monthLabels, availableYears,
    top3Areas, worst3Areas, worst3Audits,
    pendingByTeam, selectedHotelName, canChooseHotel, resetForHotelChange,
  };
}
