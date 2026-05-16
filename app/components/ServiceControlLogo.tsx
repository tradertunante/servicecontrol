interface Props {
  variant?: "dark" | "light"; // dark = sobre fondo claro, light = sobre fondo oscuro
  showText?: boolean;
  className?: string;
}

const COLORS = {
  dark: { l: "#0C1F44", check: "#2563EB", divider: "#D3D1C7", text: "#0C1F44", textAccent: "#2563EB", sub: "#8A9BAD" },
  light: { l: "#FFFFFF", check: "#60A5FA", divider: "rgba(255,255,255,0.25)", text: "#FFFFFF", textAccent: "#60A5FA", sub: "rgba(255,255,255,0.5)" },
};

export function ServiceControlIcon({ variant = "dark", size = 28, className }: { variant?: "dark" | "light"; size?: number; className?: string }) {
  const c = COLORS[variant];
  return (
    <svg width={size} height={size} viewBox="0 0 44 44" xmlns="http://www.w3.org/2000/svg" className={className}>
      <polyline points="5,4 5,40 40,40" fill="none" stroke={c.l} strokeWidth="6" strokeLinecap="round" strokeLinejoin="round"/>
      <polyline points="14,26 22,36 37,10" fill="none" stroke={c.check} strokeWidth="5.5" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}

export default function ServiceControlLogo({ variant = "dark", showText = true, className }: Props) {
  const c = COLORS[variant];

  if (!showText) {
    return <ServiceControlIcon variant={variant} className={className} />;
  }

  return (
    <svg
      viewBox="0 0 500 58"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      {/* Icon */}
      <polyline points="0,2 0,47 45,47" fill="none" stroke={c.l} strokeWidth="7" strokeLinecap="round" strokeLinejoin="round"/>
      <polyline points="11,28 22,42 42,10" fill="none" stroke={c.check} strokeWidth="6.5" strokeLinecap="round" strokeLinejoin="round"/>

      {/* Divider */}
      <line x1="63" y1="6" x2="63" y2="52" stroke={c.divider} strokeWidth="0.8"/>

      {/* Brand name */}
      <text x="75" y="36" fontFamily="Georgia, 'Times New Roman', serif" fontSize="28" fontWeight="700">
        <tspan fill={c.text}>Service</tspan><tspan fill={c.textAccent}>Control</tspan>
      </text>

      {/* Tagline */}
      <text x="76" y="51" fontFamily="'Helvetica Neue', Helvetica, Arial, sans-serif" fontSize="9.5" fontWeight="400" fill={c.sub} letterSpacing="4">HOTEL QUALITY PLATFORM</text>
    </svg>
  );
}