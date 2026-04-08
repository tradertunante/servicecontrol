"use client";

import { useState, useEffect, useCallback } from "react";
import type { Step } from "react-joyride";

const STORAGE_KEY = "sc_onboarding_modules";

function getCompleted(): Record<string, boolean> {
  if (typeof window === "undefined") return {};
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "{}");
  } catch {
    return {};
  }
}

function markCompleted(module: string) {
  const current = getCompleted();
  localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...current, [module]: true }));
}

export function useModuleOnboarding(module: string, steps: Step[]) {
  const [run, setRun] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const completed = getCompleted();
    if (!completed[module]) setRun(true);
  }, [module]);

  const finish = useCallback(() => {
    setRun(false);
    markCompleted(module);
  }, [module]);

  const start = useCallback(() => setRun(true), []);

  return { run, steps, mounted, finish, start };
}
