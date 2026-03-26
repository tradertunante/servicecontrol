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
  const eyebrowClass = theme === "dark" ? "text-[#d9c19c]" : "text-[#9f7a49]";
  const titleClass = theme === "dark" ? "text-white" : "text-slate-950";
  const descriptionClass = theme === "dark" ? "text-slate-300" : "text-slate-600";

  return (
    <div className={alignment}>
      <div className={`text-xs font-extrabold uppercase tracking-[0.28em] ${eyebrowClass}`}>{eyebrow}</div>
      <h2 className={`mt-4 text-[clamp(2.3rem,5vw,4.2rem)] font-extrabold leading-[0.98] tracking-[-0.04em] ${titleClass}`}>
        {title}
      </h2>
      <p className={`mt-5 text-lg leading-8 ${descriptionClass}`}>{description}</p>
    </div>
  );
}
