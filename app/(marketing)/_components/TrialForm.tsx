"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";

type State = "idle" | "loading" | "success" | "error" | "conflict";

export default function TrialForm() {
  const t = useTranslations("trialPage");
  const [state, setState] = useState<State>("idle");
  const [errorMsg, setErrorMsg] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [hotelName, setHotelName] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setState("loading");
    setErrorMsg("");

    try {
      const res = await fetch("/api/trial/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, hotel_name: hotelName }),
      });

      const data = await res.json().catch(() => null);

      if (res.status === 409) {
        setState("conflict");
        return;
      }

      if (!res.ok) {
        setState("error");
        setErrorMsg(data?.error ?? t("errorGeneric"));
        return;
      }

      setState("success");
    } catch {
      setState("error");
      setErrorMsg(t("errorGeneric"));
    }
  }

  if (state === "success") {
    return (
      <div
        className="rounded-[20px] p-8 text-center"
        style={{ background: "var(--card-bg)", border: "1px solid var(--border)", boxShadow: "var(--shadow-lg)" }}
      >
        <div
          className="mx-auto mb-5 flex h-12 w-12 items-center justify-center rounded-full text-xl"
          style={{ background: "#f0fdf4", border: "1px solid #86efac" }}
        >
          ✓
        </div>
        <div className="text-xl font-bold text-[var(--text)]">{t("successTitle")}</div>
        <p className="mt-3 text-sm leading-6 text-[var(--text-secondary)]">
          {t("successBody")}
        </p>
        <div className="mt-6 text-xs text-[var(--text-secondary)]">
          {t("successHint")}{" "}
          <Link href="/login" className="font-semibold text-[#185FA5] hover:underline">
            {t("successLogin")}
          </Link>
        </div>
      </div>
    );
  }

  if (state === "conflict") {
    return (
      <div
        className="rounded-[20px] p-8 text-center"
        style={{ background: "var(--card-bg)", border: "1px solid var(--border)", boxShadow: "var(--shadow-lg)" }}
      >
        <div className="text-xl font-bold text-[var(--text)]">{t("conflictTitle")}</div>
        <p className="mt-3 text-sm leading-6 text-[var(--text-secondary)]">{t("conflictBody")}</p>
        <Link
          href="/login"
          className="mt-6 inline-block rounded-[6px] bg-[#185FA5] px-6 py-3 text-sm font-medium text-white hover:bg-[#378ADD]"
        >
          {t("conflictCta")}
        </Link>
      </div>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-[20px] p-8"
      style={{ background: "var(--card-bg)", border: "1px solid var(--border)", boxShadow: "var(--shadow-lg)" }}
    >
      <div className="mb-6">
        <div className="text-[11px] font-semibold uppercase tracking-[2px] text-[#888780]">
          {t("formEyebrow")}
        </div>
        <div className="mt-2 text-xl font-bold text-[var(--text)]">{t("formTitle")}</div>
        <p className="mt-2 text-sm leading-6 text-[var(--text-secondary)]">{t("formSubtitle")}</p>
      </div>

      <div className="space-y-4">
        <div>
          <label className="mb-1.5 block text-sm font-medium text-[var(--text)]">
            {t("labelName")}
          </label>
          <input
            type="text"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={t("placeholderName")}
            className="w-full rounded-[8px] border border-[var(--border)] bg-[var(--bg)] px-4 py-3 text-sm text-[var(--text)] placeholder-[var(--text-secondary)] outline-none focus:border-[#185FA5] focus:ring-2 focus:ring-[#185FA5]/20"
          />
        </div>

        <div>
          <label className="mb-1.5 block text-sm font-medium text-[var(--text)]">
            {t("labelEmail")}
          </label>
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder={t("placeholderEmail")}
            className="w-full rounded-[8px] border border-[var(--border)] bg-[var(--bg)] px-4 py-3 text-sm text-[var(--text)] placeholder-[var(--text-secondary)] outline-none focus:border-[#185FA5] focus:ring-2 focus:ring-[#185FA5]/20"
          />
        </div>

        <div>
          <label className="mb-1.5 block text-sm font-medium text-[var(--text)]">
            {t("labelHotel")}
          </label>
          <input
            type="text"
            required
            value={hotelName}
            onChange={(e) => setHotelName(e.target.value)}
            placeholder={t("placeholderHotel")}
            className="w-full rounded-[8px] border border-[var(--border)] bg-[var(--bg)] px-4 py-3 text-sm text-[var(--text)] placeholder-[var(--text-secondary)] outline-none focus:border-[#185FA5] focus:ring-2 focus:ring-[#185FA5]/20"
          />
          <p className="mt-1.5 text-xs text-[var(--text-secondary)]">{t("hotelHint")}</p>
        </div>
      </div>

      {state === "error" && (
        <div className="mt-4 rounded-[8px] bg-red-50 px-4 py-3 text-sm text-red-700">
          {errorMsg}
        </div>
      )}

      <button
        type="submit"
        disabled={state === "loading"}
        className="mt-6 w-full rounded-[8px] bg-[#185FA5] py-3.5 text-sm font-semibold text-white transition hover:bg-[#378ADD] disabled:opacity-60"
      >
        {state === "loading" ? t("ctaLoading") : t("ctaSubmit")}
      </button>

      <p className="mt-4 text-center text-xs text-[var(--text-secondary)]">
        {t("loginHint")}{" "}
        <Link href="/login" className="font-semibold text-[#185FA5] hover:underline">
          {t("loginLink")}
        </Link>
      </p>
    </form>
  );
}