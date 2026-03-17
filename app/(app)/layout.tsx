import HotelHeader from "@/app/components/HotelHeader";
import { requireAuthenticatedUser } from "@/lib/auth/server";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  await requireAuthenticatedUser();

  return (
    <div className="min-h-screen bg-[var(--bg)]">
      <HotelHeader />
      <main className="pt-16 px-6">{children}</main>
    </div>
  );
}
