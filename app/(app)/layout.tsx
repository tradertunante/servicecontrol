import HotelHeader from "@/app/components/HotelHeader";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-[var(--bg)]">
      <HotelHeader />
      <main className="pt-16 px-6">{children}</main>
    </div>
  );
}