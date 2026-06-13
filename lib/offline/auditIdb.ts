// IndexedDB persistence for offline audit mode.
// Three stores:
//   sessions      — full LoadedAuditSession snapshot, keyed by runId
//   local-answers — per-question answers written on every change, keyed by "runId:questionId"
//   draft-queue   — pending draft API calls queued by the SW when offline, keyed by "runId:questionId"

import type { AnswerRow, LoadedAuditSession } from "@/app/(app)/audits/[id]/_hooks/useAuditSession.types";

const DB_NAME = "sc-audit";
const DB_VERSION = 1;

let dbPromise: Promise<IDBDatabase> | null = null;

function openDb(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = (e) => {
      const db = (e.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains("sessions")) {
        db.createObjectStore("sessions", { keyPath: "runId" });
      }
      if (!db.objectStoreNames.contains("local-answers")) {
        db.createObjectStore("local-answers", { keyPath: "key" });
      }
      if (!db.objectStoreNames.contains("draft-queue")) {
        db.createObjectStore("draft-queue", { keyPath: "key" });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => {
      dbPromise = null;
      reject(req.error);
    };
  });
  return dbPromise;
}

function idbPut(store: string, value: object): Promise<void> {
  return openDb().then(
    (db) =>
      new Promise((resolve, reject) => {
        const tx = db.transaction(store, "readwrite");
        tx.objectStore(store).put(value);
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      }),
  );
}

function idbGet<T>(store: string, key: string): Promise<T | undefined> {
  return openDb().then(
    (db) =>
      new Promise((resolve, reject) => {
        const tx = db.transaction(store, "readonly");
        const req = tx.objectStore(store).get(key);
        req.onsuccess = () => resolve(req.result as T | undefined);
        req.onerror = () => reject(req.error);
      }),
  );
}

function idbGetAll<T>(store: string): Promise<T[]> {
  return openDb().then(
    (db) =>
      new Promise((resolve, reject) => {
        const tx = db.transaction(store, "readonly");
        const req = tx.objectStore(store).getAll();
        req.onsuccess = () => resolve(req.result as T[]);
        req.onerror = () => reject(req.error);
      }),
  );
}

function idbDelete(store: string, key: string): Promise<void> {
  return openDb().then(
    (db) =>
      new Promise((resolve, reject) => {
        const tx = db.transaction(store, "readwrite");
        tx.objectStore(store).delete(key);
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      }),
  );
}

// ── Sessions ──────────────────────────────────────────────────────────────────

export async function cacheSession(runId: string, session: LoadedAuditSession): Promise<void> {
  await idbPut("sessions", { runId, data: session, ts: Date.now() });
}

export async function loadCachedSession(runId: string): Promise<LoadedAuditSession | null> {
  const row = await idbGet<{ runId: string; data: LoadedAuditSession; ts: number }>("sessions", runId);
  return row?.data ?? null;
}

// ── Local answers (written on every change, fire-and-forget) ──────────────────

export function saveAnswerLocally(runId: string, answer: AnswerRow): void {
  void idbPut("local-answers", {
    key: `${runId}:${answer.question_id}`,
    runId,
    answer,
    ts: Date.now(),
  });
}

export async function loadLocalAnswers(runId: string): Promise<Record<string, AnswerRow>> {
  const all = await idbGetAll<{ key: string; runId: string; answer: AnswerRow }>("local-answers");
  const result: Record<string, AnswerRow> = {};
  for (const row of all) {
    if (row.runId === runId) {
      result[row.answer.question_id] = row.answer;
    }
  }
  return result;
}

// ── Draft queue (written by the SW, drained here on reconnect) ─────────────────

export type QueuedDraft = {
  key: string;
  runId: string;
  url: string;
  authorization: string;
  body: { answers: AnswerRow[] };
  ts: number;
};

export async function loadDraftQueue(runId: string): Promise<QueuedDraft[]> {
  const all = await idbGetAll<QueuedDraft>("draft-queue");
  return all.filter((row) => row.runId === runId).sort((a, b) => a.ts - b.ts);
}

export async function deleteDraftQueueItem(key: string): Promise<void> {
  await idbDelete("draft-queue", key);
}
