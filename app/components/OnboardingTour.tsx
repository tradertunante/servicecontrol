"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { useOnboardingContext } from "@/app/providers/OnboardingProvider";

// react-joyride solo se descarga cuando el tour se ejecuta (usuarios nuevos
// o relanzamiento manual), no en cada página de la app
const TourRenderer = dynamic(() => import("@/app/components/TourRenderer"), { ssr: false });

export default function OnboardingTour() {
  const [mounted, setMounted] = useState(false);
  const { steps, run, isReady, finish, start } = useOnboardingContext();

  // Evitar mismatch de hydration
  useEffect(() => { setMounted(true); }, []);

  // Escuchar evento global para relanzar desde SupportButton
  useEffect(() => {
    const handler = () => start();
    window.addEventListener("sc:start-tour:dashboard", handler);
    return () => window.removeEventListener("sc:start-tour:dashboard", handler);
  }, [start]);

  if (!mounted || !isReady || !run) return null;

  return <TourRenderer steps={steps} run={run} onTourEnd={() => void finish()} />;
}