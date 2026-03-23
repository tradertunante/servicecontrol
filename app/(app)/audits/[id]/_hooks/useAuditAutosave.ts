"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type SaveAction = () => Promise<void>;

export function useAuditAutosave(delayMs = 450) {
  const timersRef = useRef(new Map<string, ReturnType<typeof setTimeout>>());
  const actionsRef = useRef(new Map<string, SaveAction>());
  const runningRef = useRef(new Map<string, Promise<void>>());
  const [pendingCount, setPendingCount] = useState(0);

  const refreshPendingCount = useCallback(() => {
    setPendingCount(
      new Set([
        ...timersRef.current.keys(),
        ...actionsRef.current.keys(),
        ...runningRef.current.keys(),
      ]).size,
    );
  }, []);

  const runAction = useCallback(
    async (key: string) => {
      const running = runningRef.current.get(key);
      if (running) {
        await running;
        return;
      }

      const timer = timersRef.current.get(key);
      if (timer) {
        clearTimeout(timer);
        timersRef.current.delete(key);
      }

      const action = actionsRef.current.get(key);
      actionsRef.current.delete(key);
      refreshPendingCount();

      if (!action) return;

      const promise = (async () => {
        let lastError: unknown;
        for (let attempt = 0; attempt < 3; attempt++) {
          try {
            await action();
            return;
          } catch (err) {
            lastError = err;
            if (attempt < 2) {
              await new Promise((r) => setTimeout(r, 300 * (attempt + 1)));
            }
          }
        }
        throw lastError;
      })().finally(() => {
        runningRef.current.delete(key);
        refreshPendingCount();
      });

      runningRef.current.set(key, promise);
      refreshPendingCount();
      await promise;
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
    // 1. Clear ALL pending timers and promote them to immediate actions
    for (const [key, timer] of timersRef.current.entries()) {
      clearTimeout(timer);
    }
    timersRef.current.clear();

    // 2. Run all queued actions (includes the just-cleared timers' actions)
    const keys = Array.from(
      new Set([...actionsRef.current.keys(), ...runningRef.current.keys()]),
    );
    for (const key of keys) {
      await runAction(key);
    }

    // 3. Wait for any still-running promises
    const running = Array.from(new Set(runningRef.current.values()));
    if (running.length > 0) {
      await Promise.all(running);
    }
  }, [runAction]);

  useEffect(() => {
    const timers = timersRef.current;
    const actions = actionsRef.current;
    const running = runningRef.current;

    return () => {
      for (const timer of timers.values()) {
        clearTimeout(timer);
      }
      timers.clear();
      actions.clear();
      running.clear();
    };
  }, []);

  return {
    pendingCount,
    scheduleSave,
    flushAll,
  };
}
