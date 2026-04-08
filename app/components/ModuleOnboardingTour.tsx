"use client";

import { useEffect } from "react";
import { Joyride, EVENTS, type Controls, type EventData, type Step } from "react-joyride";
import { useModuleOnboarding } from "@/hooks/useModuleOnboarding";

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

  if (!mounted) return null;

  const handleEvent = (data: EventData, controls: Controls) => {
    if (data.type === EVENTS.TARGET_NOT_FOUND) {
      controls.next();
      return;
    }
    if (data.type === EVENTS.TOUR_END) {
      finish();
    }
  };

  return (
    <Joyride
      steps={steps}
      run={run}
      continuous
      scrollToFirstStep
      onEvent={handleEvent}
      options={{
        primaryColor: "#000",
        zIndex: 10000,
        showProgress: true,
        overlayClickAction: false,
        buttons: ["back", "primary", "skip"],
        spotlightPadding: 4,
        scrollOffset: 80,
      }}
      locale={{
        back: "Atrás",
        close: "Cerrar",
        last: "Finalizar",
        next: "Siguiente",
        skip: "Omitir",
      }}
      styles={{
        buttonPrimary: {
          backgroundColor: "#000",
          borderRadius: "8px",
          fontWeight: 700,
          fontFamily: "inherit",
        },
        buttonBack: {
          color: "#000",
          fontWeight: 700,
          fontFamily: "inherit",
        },
        buttonSkip: {
          color: "#666",
          fontFamily: "inherit",
        },
        tooltip: {
          borderRadius: "12px",
          fontFamily: "inherit",
        },
      }}
    />
  );
}
