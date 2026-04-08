import type { Step } from "react-joyride";

export const MEMBERS_STEPS: Step[] = [
  {
    target: "body",
    content: "Members es el directorio operativo del hotel: las personas que ejecutan auditorías en el campo.",
    placement: "center",
    skipBeacon: true,
  },
  {
    target: '[data-onboarding="members-header"]',
    content: "Desde aquí puedes crear nuevos miembros, importarlos masivamente o editarlos.",
    skipBeacon: true,
  },
  {
    target: '[data-onboarding="members-filters"]',
    content: "Filtra por nombre, área o estado para encontrar cualquier miembro rápidamente.",
    skipBeacon: true,
  },
  {
    target: '[data-onboarding="members-table"]',
    content: "La tabla muestra todos los miembros con su número de empleado, áreas asignadas y estado activo/inactivo.",
    placement: "top",
    skipBeacon: true,
  },
];
