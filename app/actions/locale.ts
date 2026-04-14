"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";

export async function setAppLocale(locale: "en" | "es") {
  const cookieStore = await cookies();
  cookieStore.set("sc-locale", locale, {
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
    sameSite: "lax",
  });
  revalidatePath("/", "layout");
}
