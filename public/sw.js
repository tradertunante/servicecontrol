// Service Worker for offline audit mode.
// Intercepts POST /api/audits/*/draft when offline:
//   1. Queues the request body in IndexedDB
//   2. Returns a synthetic ok response so the UI doesn't error
//   3. Registers a Background Sync to replay the queue when connection returns
//
// Background Sync is not supported on Safari — the page-side drain in
// useAuditAutosave handles that path on reconnect.

const SYNC_TAG = "audit-draft";
const DB_NAME = "sc-audit";
const DB_VERSION = 1;

// ── IDB helpers (minimal, self-contained for SW context) ──────────────────────

function openSwDb() {
  return new Promise((resolve, reject) => {
    const req = self.indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = (e) => {
      const db = e.target.result;
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
    req.onerror = () => reject(req.error);
  });
}

function swPut(store, value) {
  return openSwDb().then(
    (db) =>
      new Promise((resolve, reject) => {
        const tx = db.transaction(store, "readwrite");
        tx.objectStore(store).put(value);
        tx.oncomplete = resolve;
        tx.onerror = () => reject(tx.error);
      }),
  );
}

function swGetAll(store) {
  return openSwDb().then(
    (db) =>
      new Promise((resolve, reject) => {
        const tx = db.transaction(store, "readonly");
        const req = tx.objectStore(store).getAll();
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      }),
  );
}

function swDelete(store, key) {
  return openSwDb().then(
    (db) =>
      new Promise((resolve, reject) => {
        const tx = db.transaction(store, "readwrite");
        tx.objectStore(store).delete(key);
        tx.oncomplete = resolve;
        tx.onerror = () => reject(tx.error);
      }),
  );
}

// ── Lifecycle ─────────────────────────────────────────────────────────────────

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (e) => e.waitUntil(self.clients.claim()));

// ── Fetch intercept ───────────────────────────────────────────────────────────

// Matches /api/audits/{runId}/draft
const DRAFT_RE = /^\/api\/audits\/([^/]+)\/draft$/;

self.addEventListener("fetch", (e) => {
  if (e.request.method !== "POST") return;

  const url = new URL(e.request.url);
  const match = DRAFT_RE.exec(url.pathname);
  if (!match) return;

  e.respondWith(handleDraftFetch(e.request, match[1]));
});

async function handleDraftFetch(request, runId) {
  try {
    return await fetch(request);
  } catch {
    // Network unavailable — queue and return synthetic success
    let body = {};
    try {
      body = await request.clone().json();
    } catch {
      // unparseable body — skip queue
      return offlineResponse({ ok: false, error: "offline" }, 503);
    }

    const authorization = request.headers.get("Authorization") ?? "";
    const answers = body.answers ?? [];

    for (const answer of answers) {
      const key = `${runId}:${answer.question_id}`;
      await swPut("draft-queue", {
        key,
        runId,
        url: request.url,
        authorization,
        body: { answers: [answer] },
        ts: Date.now(),
      });
    }

    try {
      await self.registration.sync.register(SYNC_TAG);
    } catch {
      // Background Sync not available (Safari) — the page drains on reconnect
    }

    const syntheticAnswers = answers.map((a) => ({
      ...a,
      audit_run_id: runId,
      id: a.id ?? "",
      photo_paths: a.photo_paths ?? [],
    }));
    return offlineResponse({ ok: true, answers: syntheticAnswers }, 200);
  }
}

function offlineResponse(body, status) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

// ── Background Sync ───────────────────────────────────────────────────────────

self.addEventListener("sync", (e) => {
  if (e.tag === SYNC_TAG) {
    e.waitUntil(flushDraftQueue());
  }
});

async function flushDraftQueue() {
  let all;
  try {
    all = await swGetAll("draft-queue");
  } catch {
    return;
  }

  // Replay oldest first so answer order is preserved
  all.sort((a, b) => a.ts - b.ts);

  for (const item of all) {
    try {
      const res = await fetch(item.url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: item.authorization,
        },
        body: JSON.stringify(item.body),
      });
      if (res.ok) {
        await swDelete("draft-queue", item.key);
      }
    } catch {
      // Still offline — will retry on next sync event
    }
  }
}