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
    <div style={{ minHeight: "100vh", background: "#eef1f5" }}>
      <HotelHeader />
      <div style={{ padding: 18 }}>
        <AdminShell initialHotelId={hotelId} />
      </div>
    </div>
  );
}
