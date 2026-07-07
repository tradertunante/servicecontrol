"use client";

import { Joyride, EVENTS, type Controls, type EventData, type Step } from "react-joyride";

export type TourEventHandler = (data: EventData, controls: Controls) => void;

// Único punto con import estático de react-joyride (~60 kB). Los tours lo
// cargan con next/dynamic solo cuando el tour se ejecuta, así la librería
// queda fuera del bundle común de la app autenticada.
export default function TourRenderer({
  steps,
  run,
  onTourEnd,
  spotlightPadding,
}: {
  steps: Step[];
  run: boolean;
  onTourEnd: () => void;
  spotlightPadding?: number;
}) {
  const handleEvent: TourEventHandler = (data, controls) => {
    // Si el target no existe en el DOM, salta al siguiente paso
    if (data.type === EVENTS.TARGET_NOT_FOUND) {
      controls.next();
      return;
    }
    // Solo marcar completado cuando el usuario termina o salta voluntariamente
    if (data.type === EVENTS.TOUR_END) {
      onTourEnd();
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
        ...(spotlightPadding !== undefined ? { spotlightPadding } : {}),
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