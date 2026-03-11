import type { CSSProperties, ElementType, ReactNode } from "react";

export default function Card({
  children,
  style,
  className,
  as,
  padding = 14,
  shadow = "sm",
  radius = 14,
}: {
  children: ReactNode;
  style?: CSSProperties;
  className?: string;
  as?: keyof JSX.IntrinsicElements;
  padding?: number | string;
  shadow?: "sm" | "none";
  radius?: number | string;
}) {
  const Component = (as ?? "div") as ElementType;

  return (
    <Component
      className={className}
      style={{
        border: "1px solid var(--border)",
        background: "var(--card-bg)",
        borderRadius: radius,
        padding,
        boxShadow: shadow === "sm" ? "var(--shadow-sm)" : "none",
        ...style,
      }}
    >
      {children}
    </Component>
  );
}
