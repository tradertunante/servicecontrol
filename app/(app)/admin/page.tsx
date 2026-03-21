import HotelHeader from "@/app/components/HotelHeader";
import AdminShell from "@/app/(app)/admin/_components/AdminShell";
import { requirePageAccess } from "@/lib/auth/server";

export default async function AdminPage() {
  const { hotelId } = await requirePageAccess({
    module: "admin",
    requireHotel: true,
    nextPath: "/admin",
    redirectTo: "/dashboard",
  });

  return (
    <div className="min-h-screen bg-[#eef1f5]">
      <HotelHeader />
      <div className="p-[18px]">
        <AdminShell initialHotelId={hotelId} />
      </div>
    </div>
  );
}
