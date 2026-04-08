import type { Step } from "react-joyride";

export const HISTORIAL_STEPS: Step[] = [
  {
    target: "body",
    content: "El Historial recoge todas las auditorías ejecutadas en el área, con detalle de score y fecha.",
    placement: "center",
    skipBeacon: true,
  },
  {
    target: '[data-onboarding="historial-filters"]',
    content: "Filtra por tipo de plantilla, mes y año para localizar cualquier auditoría pasada.",
    skipBeacon: true,
  },
  {
    target: '[data-onboarding="historial-list"]',
    content: "Cada fila es una auditoría. Haz clic en 'Ver' para revisar todas las respuestas y evidencias.",
    placement: "top",
    skipBeacon: true,
  },
];
