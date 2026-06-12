import { requirePageAccess } from "@/lib/auth/server";
import UpgradeClient from "./UpgradeClient";

export default async function UpgradePage() {
  await requirePageAccess({ nextPath: "/upgrade", redirectTo: "/login" });
  return <UpgradeClient />;
}