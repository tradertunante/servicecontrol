"use client";

export default function CalEmbed({ locale }: { locale: string }) {
  const src = `https://cal.com/service-control-0fejyn/demo-servicecontrol?embed=true&theme=light&locale=${locale === "es" ? "es" : "en"}`;

  return (
    <iframe
      src={src}
      title="Book a demo"
      style={{ width: "100%", height: "100%", minHeight: "700px", border: "none", display: "block" }}
      loading="lazy"
    />
  );
}
