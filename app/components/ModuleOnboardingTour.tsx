"use client";

import { useEffect } from "react";
import dynamic from "next/dynamic";
import type { Step } from "react-joyride";
import { useModuleOnboarding } from "@/hooks/useModuleOnboarding";

// react-joyride solo se descarga cuando el tour se ejecuta, no en cada
// página del módulo
const TourRenderer = dynamic(() => import("@/app/components/TourRenderer"), { ssr: false });

interface Props {
  module: string;
  steps: Step[];
}

export default function ModuleOnboardingTour({ module, steps }: Props) {
  const { run, mounted, finish, start } = useModuleOnboarding(module, steps);

  useEffect(() => {
    const handler = () => start();
    const event = `sc:start-tour:${module}`;
    window.addEventListener(event, handler);
    return () => window.removeEventListener(event, handler);
  }, [module, start]);

  if (!mounted || !run) return null;

  return <TourRenderer steps={steps} run={run} onTourEnd={finish} spotlightPadding={4} />;
}