"use client";

import { useEffect, useState } from "react";
import { Joyride, EVENTS, type Controls, type EventData } from "react-joyride";
import { useOnboardingContext } from "@/app/providers/OnboardingProvider";

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

  if (!mounted || !isReady) return null;

  const handleEvent = (data: EventData, controls: Controls) => {
    // Si el target no existe en el DOM, salta al siguiente paso
    if (data.type === EVENTS.TARGET_NOT_FOUND) {
      controls.next();
      return;
    }
    // Solo marcar completado cuando el usuario termina o salta voluntariamente
    if (data.type === EVENTS.TOUR_END) {
      void finish();
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
