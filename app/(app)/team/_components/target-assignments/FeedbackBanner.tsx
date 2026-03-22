// FILE: app/(app)/team/_components/target-assignments/FeedbackBanner.tsx
"use client";

import type { FeedbackState } from "./types";

type Props = {
  error: string | null;
  feedback: FeedbackState;
};

export default function FeedbackBanner({ error, feedback }: Props) {
  return (
    <>
      {error ? (
        <div
          style={{
            marginTop: 12,
            padding: 12,
            borderRadius: 14,
            border: "1px solid rgba(255,0,0,0.25)",
            background: "rgba(255,0,0,0.06)",
          }}
        >
          <b>Error:</b> {error}
        </div>
      ) : null}

      {feedback ? (
        <div
          style={{
            marginTop: 12,
            padding: 12,
            borderRadius: 14,
            border:
              feedback.type === "success"
                ? "1px solid rgba(16,185,129,0.28)"
                : "1px solid rgba(255,255,255,0.14)",
            background:
              feedback.type === "success"
                ? "rgba(16,185,129,0.08)"
                : "rgba(255,255,255,0.04)",
          }}
        >
          {feedback.text}
        </div>
      ) : null}
    </>
  );
}
