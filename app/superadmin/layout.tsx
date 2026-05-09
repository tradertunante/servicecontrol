import type { ReactNode } from "react";
import { cookies } from "next/headers";
import { NextIntlClientProvider } from "next-intl";

import { requireRole } from "@/lib/auth/server";

export default async function SuperadminLayout({ children }: { children: ReactNode }) {
  await requireRole(["superadmin"], {
    nextPath: "/superadmin",
    redirectTo: "/dashboard",
  });

  const cookieStore = cookies();
  const locale = (cookieStore.get("sc-locale")?.value ?? "en") as "en" | "es";
  const messages = locale === "es"
    ? (await import("@/messages/es.json")).default
    : (await import("@/messages/en.json")).default;

  return (
    <NextIntlClientProvider locale={locale} messages={messages}>
      {children}
    </NextIntlClientProvider>
  );
}
