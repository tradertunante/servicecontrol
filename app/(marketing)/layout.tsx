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
      className="min-h-screen bg-[#f5f1ea] text-slate-900 antialiased [font-family:'Avenir_Next',Avenir,Montserrat,'Segoe_UI',sans-serif]"
    >
      <div className="relative overflow-hidden">
        <div className="absolute inset-x-0 top-0 h-[720px] bg-[radial-gradient(circle_at_top,rgba(15,23,42,0.18),transparent_58%)]" />
        <div className="absolute left-[-12%] top-24 h-[420px] w-[420px] rounded-full bg-[rgba(172,143,95,0.14)] blur-3xl" />
        <div className="absolute right-[-10%] top-20 h-[380px] w-[380px] rounded-full bg-[rgba(15,23,42,0.12)] blur-3xl" />
        <MarketingHeader />
        {children}
        <MarketingFooter />
      </div>
    </div>
  );
}
