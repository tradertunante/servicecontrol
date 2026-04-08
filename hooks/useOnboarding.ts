// Alias conveniente para acceder al contexto de onboarding desde cualquier componente.
// El componente debe estar dentro de OnboardingProvider.
//
// Ejemplo de uso para relanzar manualmente:
//   const { start } = useOnboarding();
//   <button onClick={start}>Ver tour de nuevo</button>

export { useOnboardingContext as useOnboarding } from "@/app/providers/OnboardingProvider";
