import type { Metadata } from "next";
import MarketingFooter from "./_components/MarketingFooter";
import MarketingHeader from "./_components/MarketingHeader";

export const metadata: Metadata = {
  title: {
    default: "Software de Control Operativo para Hoteles | ServiceControl",
    template: "%s | ServiceControl",
  },
  description:
    "Auditorias digitales, acciones correctivas, reauditorias y seguimiento del equipo en una sola plataforma. Control operativo real para hoteles.",
};

export default function MarketingLayout({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="min-h-screen bg-[var(--bg)] text-[var(--text)] antialiased [font-family:'Avenir_Next',Avenir,Montserrat,'Segoe_UI',sans-serif]"
    >
      <div className="relative overflow-hidden">
        <div className="absolute inset-x-0 top-0 h-[160px] border-b border-black/[0.04] bg-white/[0.28]" />
        <MarketingHeader />
        {children}
        <MarketingFooter />
      </div>
    </div>
  );
}
