import { cookies } from "next/headers";
import { NextIntlClientProvider } from "next-intl";
import LoginClient from "./LoginClient";

export default async function LoginPage() {
  const cookieStore = await cookies();
  const locale = (cookieStore.get("sc-locale")?.value ?? "en") as "en" | "es";
  const messages = locale === "es"
    ? (await import("@/messages/es.json")).default
    : (await import("@/messages/en.json")).default;

  return (
    <NextIntlClientProvider locale={locale} messages={messages}>
      <LoginClient />
    </NextIntlClientProvider>
  );
}
