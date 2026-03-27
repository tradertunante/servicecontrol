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
  const eyebrowClass = theme === "dark" ? "text-white/60" : "text-[var(--text-secondary)]";
  const titleClass = theme === "dark" ? "text-white" : "text-[var(--text)]";
  const descriptionClass = theme === "dark" ? "text-[var(--dark-text-muted)]" : "text-[var(--text-secondary)]";

  return (
    <div className={alignment}>
      <div className={`text-xs font-extrabold uppercase tracking-[0.24em] ${eyebrowClass}`}>{eyebrow}</div>
      <h2 className={`mt-4 text-[clamp(2.3rem,5vw,4.2rem)] font-extrabold leading-[0.98] tracking-[-0.04em] ${titleClass}`}>
        {title}
      </h2>
      <p className={`mt-5 text-lg leading-8 ${descriptionClass}`}>{description}</p>
    </div>
  );
}
