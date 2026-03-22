import { requirePageAccess } from "@/lib/auth/server";

export default async function TaskLayout({ children }: { children: React.ReactNode }) {
  await requirePageAccess({
    roles: ["superadmin", "admin", "manager", "quality", "auditor"],
    requireHotel: true,
  });
  return <>{children}</>;
}
