export default function SectionIntro({
  eyebrow,
  title,
  description,
  align = "left",
  theme = "light",
}: {
  eyebrow: string;
  title: string;
  description: string;
  align?: "left" | "center";
  theme?: "light" | "dark";
}) {
  const alignment = align === "center" ? "mx-auto max-w-[880px] text-center" : "max-w-[760px]";
  const eyebrowClass = theme === "dark" ? "text-white/60" : "text-[#888780]";
  const titleClass = theme === "dark" ? "text-white" : "text-[var(--text)]";
  const descriptionClass = theme === "dark" ? "text-[var(--dark-text-muted)]" : "text-[var(--text-secondary)]";

  return (
    <div className={alignment}>
      <div className={`text-[11px] font-normal uppercase tracking-[2.5px] ${eyebrowClass}`}>{eyebrow}</div>
      <h2 className={`mt-4 ${titleClass}`}>
        {title}
      </h2>
      <p className={`mt-5 ${descriptionClass}`}>{description}</p>
    </div>
  );
}
