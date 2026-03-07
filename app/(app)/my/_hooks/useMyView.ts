"use client";

import { useState } from "react";
import type { MyPeriodKey } from "./useMyDashboardData";

export type MyViewMode = "summary" | "plan" | "performance" | "account";

export function useMyView() {
  const [selectedPeriod, setSelectedPeriod] = useState<MyPeriodKey>("monthly");
  const [viewMode, setViewMode] = useState<MyViewMode>("summary");

  return {
    selectedPeriod,
    setSelectedPeriod,
    viewMode,
    setViewMode,
  };
}