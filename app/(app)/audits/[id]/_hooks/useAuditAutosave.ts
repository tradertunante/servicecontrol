"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type SaveAction = () => Promise<void>;

export function useAuditAutosave(delayMs = 450) {
  const timersRef = useRef(new Map<string, ReturnType<typeof setTimeout>>());
  const actionsRef = useRef(new Map<string, SaveAction>());
  const [pendingCount, setPendingCount] = useState(0);

  const refreshPendingCount = useCallback(() => {
    setPendingCount(new Set([...timersRef.current.keys(), ...actionsRef.current.keys()]).size);
  }, []);

  const runAction = useCallback(
    async (key: string) => {
      const timer = timersRef.current.get(key);
      if (timer) {
        clearTimeout(timer);
        timersRef.current.delete(key);
      }

      const action = actionsRef.current.get(key);
      actionsRef.current.delete(key);
      refreshPendingCount();

      if (!action) return;
      await action();
    },
    [refreshPendingCount],
  );

  const scheduleSave = useCallback(
    (key: string, action: SaveAction) => {
      const previousTimer = timersRef.current.get(key);
      if (previousTimer) {
        clearTimeout(previousTimer);
      }

      actionsRef.current.set(key, action);
      const timer = setTimeout(() => {
        void runAction(key);
      }, delayMs);

      timersRef.current.set(key, timer);
      refreshPendingCount();
    },
    [delayMs, refreshPendingCount, runAction],
  );

  const flushAll = useCallback(async () => {
    const keys = Array.from(new Set(actionsRef.current.keys()));
    for (const key of keys) {
      await runAction(key);
    }
  }, [runAction]);

  useEffect(() => {
    const timers = timersRef.current;
    const actions = actionsRef.current;

    return () => {
      for (const timer of timers.values()) {
        clearTimeout(timer);
      }
      timers.clear();
      actions.clear();
    };
  }, []);

  return {
    pendingCount,
    scheduleSave,
    flushAll,
  };
}
