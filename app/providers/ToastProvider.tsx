"use client";

import { createContext, useCallback, useContext, useState, type ReactNode } from "react";

type ToastType = "error" | "success" | "warn";

type Toast = {
  id: number;
  message: string;
  type: ToastType;
};

type ToastContextValue = {
  error: (message: string) => void;
  success: (message: string) => void;
  warn: (message: string) => void;
};

const ToastContext = createContext<ToastContextValue | null>(null);

let nextId = 0;

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within ToastProvider");
  return ctx;
}

export default function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const addToast = useCallback((message: string, type: ToastType) => {
    const id = ++nextId;
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4000);
  }, []);

  const error = useCallback((msg: string) => addToast(msg, "error"), [addToast]);
  const success = useCallback((msg: string) => addToast(msg, "success"), [addToast]);
  const warn = useCallback((msg: string) => addToast(msg, "warn"), [addToast]);

  return (
    <ToastContext.Provider value={{ error, success, warn }}>
      {children}
      {toasts.length > 0 && (
        <div style={{
          position: "fixed",
          bottom: 20,
          right: 20,
          zIndex: 9999,
          display: "flex",
          flexDirection: "column",
          gap: 8,
          maxWidth: 380,
        }}>
          {toasts.map((t) => (
            <div
              key={t.id}
              role="alert"
              onClick={() => setToasts((prev) => prev.filter((x) => x.id !== t.id))}
              style={{
                padding: "12px 16px",
                borderRadius: 12,
                background: t.type === "error" ? "var(--danger, #c62828)" : t.type === "success" ? "var(--ok, #0f766e)" : "var(--warn, #ef6c00)",
                color: "#fff",
                fontWeight: 700,
                fontSize: 13,
                boxShadow: "0 8px 24px rgba(0,0,0,0.18)",
                cursor: "pointer",
                animation: "toast-slide-in 0.25s ease-out",
              }}
            >
              {t.message}
            </div>
          ))}
        </div>
      )}
      <style jsx global>{`
        @keyframes toast-slide-in {
          from { opacity: 0; transform: translateY(12px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </ToastContext.Provider>
  );
}
