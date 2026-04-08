import type { CSSProperties, ElementType, ReactNode } from "react";

export default function Card({
  children,
  style,
  className,
  as,
  padding = 14,
  shadow = "sm",
  radius = 14,
  "data-onboarding": dataOnboarding,
}: {
  children: ReactNode;
  style?: CSSProperties;
  className?: string;
  as?: keyof JSX.IntrinsicElements;
  padding?: number | string;
  shadow?: "sm" | "none";
  radius?: number | string;
  "data-onboarding"?: string;
}) {
  const Component = (as ?? "div") as ElementType;

  return (
    <Component
      className={className}
      data-onboarding={dataOnboarding}
      style={{
        border: "1px solid var(--border)",
        background: "var(--card-bg)",
        borderRadius: radius,
        padding,
        boxShadow: shadow === "sm" ? "var(--shadow-sm)" : "var(--shadow-card)",
        ...style,
      }}
    >
      {children}
    </Component>
  );
}
