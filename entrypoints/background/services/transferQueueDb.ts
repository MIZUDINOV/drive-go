import { openDB, type DBSchema, type IDBPDatabase } from "idb";
import type {
  TransferHistoryItem,
  TransferQueueItem,
  TransferQueueStatus,
} from "../../shared/transferQueueTypes";

const DB_NAME = "gdrivego-transfer-queue";
const DB_VERSION = 1;

const STORE_QUEUE = "queue-jobs";
const STORE_PAYLOADS = "queue-payloads";
const STORE_CHUNKS = "queue-chunks";
const STORE_SESSIONS = "queue-sessions";
const STORE_HISTORY = "transfer-history";

export type TransferPayloadRecord = {
  jobId: string;
  mimeType: string;
  sizeBytes: number;
  blob?: Blob;
  chunked: boolean;
  chunkCount: number;
};

export type TransferChunkRecord = {
  chunkId: string;
  jobId: string;
  index: number;
  data: Blob;
  sizeBytes: number;
};

export type ResumableSessionRecord = {
  jobId: string;
  uploadUrl: string;
  nextByte: number;
  updatedAt: number;
};

type TransferQueueDbSchema = DBSchema & {
  [STORE_QUEUE]: {
    key: string;
    value: TransferQueueItem;
    indexes: {
      "by-status": TransferQueueStatus;
      "by-updatedAt": number;
      "by-createdAt": number;
    };
  };
  [STORE_PAYLOADS]: {
    key: string;
    value: TransferPayloadRecord;
  };
  [STORE_CHUNKS]: {
    key: string;
    value: TransferChunkRecord;
    indexes: {
      "by-jobId": string;
      "by-jobId-index": [string, number];
    };
  };
  [STORE_SESSIONS]: {
    key: string;
    value: ResumableSessionRecord;
  };
  [STORE_HISTORY]: {
    key: string;
    value: TransferHistoryItem;
    indexes: {
      "by-completedAt": number;
      "by-direction": "upload" | "download";
    };
  };
};

let dbPromise: Promise<IDBPDatabase<TransferQueueDbSchema>> | null = null;

function getDb(): Promise<IDBPDatabase<TransferQueueDbSchema>> {
  if (!dbPromise) {
    dbPromise = openDB<TransferQueueDbSchema>(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains(STORE_QUEUE)) {
          const store = db.createObjectStore(STORE_QUEUE, { keyPath: "id" });
          store.createIndex("by-status", "status");
          store.createIndex("by-updatedAt", "updatedAt");
          store.createIndex("by-createdAt", "createdAt");
        }

        if (!db.objectStoreNames.contains(STORE_PAYLOADS)) {
          db.createObjectStore(STORE_PAYLOADS, { keyPath: "jobId" });
        }

        if (!db.objectStoreNames.contains(STORE_CHUNKS)) {
          const store = db.createObjectStore(STORE_CHUNKS, {
            keyPath: "chunkId",
          });
          store.createIndex("by-jobId", "jobId");
          store.createIndex("by-jobId-index", ["jobId", "index"]);
        }

        if (!db.objectStoreNames.contains(STORE_SESSIONS)) {
          db.createObjectStore(STORE_SESSIONS, { keyPath: "jobId" });
        }

        if (!db.objectStoreNames.contains(STORE_HISTORY)) {
          const store = db.createObjectStore(STORE_HISTORY, { keyPath: "id" });
          store.createIndex("by-completedAt", "completedAt");
          store.createIndex("by-direction", "direction");
        }
      },
    });
  }

  return dbPromise;
}

export async function putQueueJob(job: TransferQueueItem): Promise<void> {
  const db = await getDb();
  await db.put(STORE_QUEUE, job);
}

export async function getQueueJob(
  id: string,
): Promise<TransferQueueItem | undefined> {
  const db = await getDb();
  return db.get(STORE_QUEUE, id);
}

export async function updateQueueJob(
  id: string,
  patch: Partial<TransferQueueItem>,
): Promise<TransferQueueItem | undefined> {
  const db = await getDb();
  const current = await db.get(STORE_QUEUE, id);
  if (!current) {
    return undefined;
  }

  const next: TransferQueueItem = {
    ...current,
    ...patch,
    updatedAt: Date.now(),
  };

  await db.put(STORE_QUEUE, next);
  return next;
}

export async function listQueueJobs(): Promise<TransferQueueItem[]> {
  const db = await getDb();
  const jobs = await db.getAll(STORE_QUEUE);
  return jobs.sort((a, b) => b.createdAt - a.createdAt);
}

export async function listPendingQueueJobs(
  limit: number,
): Promise<TransferQueueItem[]> {
  const db = await getDb();
  const allPending = await db.getAllFromIndex(
    STORE_QUEUE,
    "by-status",
    "pending",
  );
  return allPending.sort((a, b) => a.createdAt - b.createdAt).slice(0, limit);
}

export async function deleteQueueJob(jobId: string): Promise<void> {
  const db = await getDb();
  await db.delete(STORE_QUEUE, jobId);
}

export async function putPayloadBlob(
  jobId: string,
  blob: Blob,
  mimeType: string,
): Promise<void> {
  const db = await getDb();
  const record: TransferPayloadRecord = {
    jobId,
    mimeType,
    sizeBytes: blob.size,
    blob,
    chunked: false,
    chunkCount: 0,
  };

  await db.put(STORE_PAYLOADS, record);
}

export async function putPayloadChunks(
  jobId: string,
  chunks: Blob[],
  mimeType: string,
): Promise<void> {
  const db = await getDb();
  const tx = db.transaction([STORE_PAYLOADS, STORE_CHUNKS], "readwrite");

  const payload: TransferPayloadRecord = {
    jobId,
    mimeType,
    sizeBytes: chunks.reduce((sum, chunk) => sum + chunk.size, 0),
    chunked: true,
    chunkCount: chunks.length,
  };
  await tx.objectStore(STORE_PAYLOADS).put(payload);

  const chunkStore = tx.objectStore(STORE_CHUNKS);
  for (let index = 0; index < chunks.length; index += 1) {
    const data = chunks[index];
    const chunkRecord: TransferChunkRecord = {
      chunkId: `${jobId}:${index}`,
      jobId,
      index,
      data,
      sizeBytes: data.size,
    };
    await chunkStore.put(chunkRecord);
  }

  await tx.done;
}

export async function getPayloadBlob(jobId: string): Promise<Blob | null> {
  const db = await getDb();
  const payload = await db.get(STORE_PAYLOADS, jobId);
  if (!payload) {
    return null;
  }

  if (!payload.chunked) {
    return payload.blob ?? null;
  }

  const chunks = await db.getAllFromIndex(STORE_CHUNKS, "by-jobId", jobId);
  const sorted = chunks
    .sort((a, b) => a.index - b.index)
    .map((record) => record.data);
  return new Blob(sorted, { type: payload.mimeType });
}

export async function deletePayload(jobId: string): Promise<void> {
  const db = await getDb();
  const tx = db.transaction([STORE_PAYLOADS, STORE_CHUNKS], "readwrite");

  await tx.objectStore(STORE_PAYLOADS).delete(jobId);

  const chunkIndex = tx.objectStore(STORE_CHUNKS).index("by-jobId");
  const chunkKeys = await chunkIndex.getAllKeys(jobId);
  for (const key of chunkKeys) {
    await tx.objectStore(STORE_CHUNKS).delete(key);
  }

  await tx.done;
}

export async function getSession(
  jobId: string,
): Promise<ResumableSessionRecord | undefined> {
  const db = await getDb();
  return db.get(STORE_SESSIONS, jobId);
}

export async function upsertSession(
  session: ResumableSessionRecord,
): Promise<void> {
  const db = await getDb();
  await db.put(STORE_SESSIONS, session);
}

export async function deleteSession(jobId: string): Promise<void> {
  const db = await getDb();
  await db.delete(STORE_SESSIONS, jobId);
}

export async function addHistoryItem(item: TransferHistoryItem): Promise<void> {
  const db = await getDb();
  await db.put(STORE_HISTORY, item);
}

export async function listHistoryItems(): Promise<TransferHistoryItem[]> {
  const db = await getDb();
  const items = await db.getAll(STORE_HISTORY);
  return items.sort((a, b) => b.completedAt - a.completedAt);
}

export async function clearHistoryByDirection(
  direction?: "upload" | "download",
): Promise<void> {
  const db = await getDb();

  if (!direction) {
    await db.clear(STORE_HISTORY);
    return;
  }

  const tx = db.transaction(STORE_HISTORY, "readwrite");
  const index = tx.store.index("by-direction");
  const keys = await index.getAllKeys(direction);
  for (const key of keys) {
    await tx.store.delete(key);
  }
  await tx.done;
}

export async function deleteHistoryItem(id: string): Promise<void> {
  const db = await getDb();
  await db.delete(STORE_HISTORY, id);
}
