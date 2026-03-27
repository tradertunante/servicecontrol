import type { Metadata } from "next";
import MarketingFooter from "./_components/MarketingFooter";
import MarketingHeader from "./_components/MarketingHeader";

export const metadata: Metadata = {
  title: {
    default: "ServiceControl | Calidad hotelera en tiempo real",
    template: "%s | ServiceControl",
  },
  description:
    "Plataforma para controlar la calidad operativa del hotel con auditorias, reauditorias, acciones correctivas y seguimiento del equipo.",
};

export default function MarketingLayout({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="min-h-screen bg-[var(--bg)] text-[var(--text)] antialiased [font-family:'Avenir_Next',Avenir,Montserrat,'Segoe_UI',sans-serif]"
    >
      <div className="relative overflow-hidden">
        <div className="absolute inset-x-0 top-0 h-[520px] bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.72),transparent_72%)]" />
        <div className="absolute inset-x-0 top-0 h-[160px] border-b border-black/[0.04] bg-white/[0.28]" />
        <MarketingHeader />
        {children}
        <MarketingFooter />
      </div>
    </div>
  );
}
