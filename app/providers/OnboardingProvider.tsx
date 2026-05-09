"use client";

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  type ReactNode,
} from "react";
import type { Step } from "react-joyride";
import { supabase } from "@/lib/supabaseClient";
import { useProfile } from "@/hooks/useProfile";
import { getOnboardingSteps } from "@/lib/onboarding/steps";

interface OnboardingContextValue {
  steps: Step[];
  run: boolean;
  isReady: boolean;
  start: () => void;
  finish: () => Promise<void>;
}

const OnboardingContext = createContext<OnboardingContextValue | null>(null);

export function useOnboardingContext(): OnboardingContextValue {
  const ctx = useContext(OnboardingContext);
  if (!ctx) throw new Error("useOnboardingContext must be used within OnboardingProvider");
  return ctx;
}

export default function OnboardingProvider({ children }: { children: ReactNode }) {
  const { data: profile, isLoading: profileLoading } = useProfile();
  const [run, setRun] = useState(false);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    if (profileLoading || !profile?.id) return;

    let alive = true;

    const init = async () => {
      if (!alive) return;
      setIsReady(true);
    };

    void init();
    return () => { alive = false; };
  }, [profile?.id, profileLoading]);

  const steps = profile?.role ? getOnboardingSteps(profile.role) : [];

  const start = useCallback(() => setRun(true), []);

  const finish = useCallback(async () => {
    setRun(false);
    if (!profile?.id) return;

    await supabase
      .from("profiles")
      .update({ onboarding_completed: true } as never)
      .eq("id", profile.id);
  }, [profile?.id]);

  return (
    <OnboardingContext.Provider value={{ steps, run, isReady, start, finish }}>
      {children}
    </OnboardingContext.Provider>
  );
}
