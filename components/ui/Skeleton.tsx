"use client";

type SkeletonProps = {
  width?: string | number;
  height?: string | number;
  borderRadius?: string | number;
  style?: React.CSSProperties;
};

export function Skeleton({ width = "100%", height = 16, borderRadius = 8, style }: SkeletonProps) {
  return (
    <>
      <div
        className="skeleton-shimmer"
        style={{
          width,
          height,
          borderRadius,
          background: "linear-gradient(90deg, rgba(0,0,0,0.06) 25%, rgba(0,0,0,0.1) 50%, rgba(0,0,0,0.06) 75%)",
          backgroundSize: "200% 100%",
          ...style,
        }}
      />
      <style jsx>{`
        .skeleton-shimmer {
          animation: shimmer 1.5s infinite ease-in-out;
        }
        @keyframes shimmer {
          0% { background-position: 200% 0; }
          100% { background-position: -200% 0; }
        }
      `}</style>
    </>
  );
}

export function SkeletonCard({ lines = 3, style }: { lines?: number; style?: React.CSSProperties }) {
  return (
    <div
      style={{
        padding: 18,
        borderRadius: 16,
        background: "var(--card-bg, rgba(255,255,255,0.92))",
        border: "1px solid var(--border, rgba(0,0,0,0.12))",
        display: "flex",
        flexDirection: "column",
        gap: 12,
        ...style,
      }}
    >
      <Skeleton width="40%" height={20} borderRadius={6} />
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton key={i} width={i === lines - 1 ? "60%" : "100%"} height={14} />
      ))}
    </div>
  );
}

export function SkeletonList({ rows = 4, style }: { rows?: number; style?: React.CSSProperties }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10, ...style }}>
      {Array.from({ length: rows }).map((_, i) => (
        <SkeletonCard key={i} lines={2} />
      ))}
    </div>
  );
}
