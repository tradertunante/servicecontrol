import { requirePageAccess } from "@/lib/auth/server";
import CorrectiveActionsInbox from "./_components/CorrectiveActionsInbox";

export default async function CorrectiveActionsPage() {
  const { profile, hotelId } = await requirePageAccess({
    module: "team",
    requireHotel: true,
    nextPath: "/corrective-actions",
    redirectTo: "/dashboard",
  });

  return (
    <div style={{ paddingTop: 28, paddingBottom: 48 }}>
      <CorrectiveActionsInbox profile={profile} hotelId={hotelId} />
    </div>
  );
}