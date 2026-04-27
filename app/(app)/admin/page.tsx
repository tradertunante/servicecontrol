import HotelHeader from "@/app/components/HotelHeader";
import AdminShell from "@/app/(app)/admin/_components/AdminShell";
import { requirePageAccess } from "@/lib/auth/server";

const TAB_TO_VIEW_MODE = {
  hotel: "hotel-info",
  areas: "departments",
  users: "users",
} as const;

type AdminPageProps = {
  searchParams?: {
    tab?: string;
  };
};

export default async function AdminPage({ searchParams }: AdminPageProps) {
  const { hotelId } = await requirePageAccess({
    module: "admin",
    requireHotel: true,
    nextPath: "/admin",
    redirectTo: "/dashboard",
  });

  const initialViewMode =
    TAB_TO_VIEW_MODE[searchParams?.tab as keyof typeof TAB_TO_VIEW_MODE] ?? "hotel-info";

  return (
    <div className="min-h-screen bg-[#eef1f5] overflow-x-hidden">
      <HotelHeader />
      <AdminShell initialHotelId={hotelId} initialViewMode={initialViewMode} />
    </div>
  );
}
