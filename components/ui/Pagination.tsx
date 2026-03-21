"use client";

type PaginationProps = {
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
};

export function Pagination({ page, totalPages, onPageChange }: PaginationProps) {
  if (totalPages <= 1) return null;

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, justifyContent: "center", marginTop: 16 }}>
      <button
        onClick={() => onPageChange(page - 1)}
        disabled={page <= 1}
        style={{
          padding: "6px 12px",
          borderRadius: 8,
          border: "1px solid var(--border, rgba(0,0,0,0.12))",
          background: page <= 1 ? "transparent" : "var(--card-bg, #fff)",
          cursor: page <= 1 ? "default" : "pointer",
          opacity: page <= 1 ? 0.4 : 1,
          fontWeight: 700,
          fontSize: 13,
        }}
      >
        Anterior
      </button>
      <span style={{ fontSize: 13, fontWeight: 700, opacity: 0.7 }}>
        {page} / {totalPages}
      </span>
      <button
        onClick={() => onPageChange(page + 1)}
        disabled={page >= totalPages}
        style={{
          padding: "6px 12px",
          borderRadius: 8,
          border: "1px solid var(--border, rgba(0,0,0,0.12))",
          background: page >= totalPages ? "transparent" : "var(--card-bg, #fff)",
          cursor: page >= totalPages ? "default" : "pointer",
          opacity: page >= totalPages ? 0.4 : 1,
          fontWeight: 700,
          fontSize: 13,
        }}
      >
        Siguiente
      </button>
    </div>
  );
}
