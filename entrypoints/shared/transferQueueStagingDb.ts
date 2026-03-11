import { openDB, type DBSchema, type IDBPDatabase } from "idb";

const DB_NAME = "gdrivego-transfer-queue-staging";
const DB_VERSION = 1;
const STORE_STAGED_BLOBS = "staged-blobs";

type StagedTransferBlobRecord = {
  id: string;
  blob: Blob;
  mimeType: string;
  createdAt: number;
};

type TransferQueueStagingDbSchema = DBSchema & {
  [STORE_STAGED_BLOBS]: {
    key: string;
    value: StagedTransferBlobRecord;
    indexes: {
      "by-createdAt": number;
    };
  };
};

let dbPromise: Promise<IDBPDatabase<TransferQueueStagingDbSchema>> | null = null;

function getDb(): Promise<IDBPDatabase<TransferQueueStagingDbSchema>> {
  if (!dbPromise) {
    dbPromise = openDB<TransferQueueStagingDbSchema>(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains(STORE_STAGED_BLOBS)) {
          const store = db.createObjectStore(STORE_STAGED_BLOBS, { keyPath: "id" });
          store.createIndex("by-createdAt", "createdAt");
        }
      },
    });
  }

  return dbPromise;
}

export async function putStagedTransferBlob(
  id: string,
  blob: Blob,
  mimeType: string,
): Promise<void> {
  const db = await getDb();
  await db.put(STORE_STAGED_BLOBS, {
    id,
    blob,
    mimeType,
    createdAt: Date.now(),
  });
}

export async function getStagedTransferBlob(id: string): Promise<Blob | null> {
  const db = await getDb();
  const record = await db.get(STORE_STAGED_BLOBS, id);
  if (!record) {
    return null;
  }

  return record.blob;
}

export async function deleteStagedTransferBlob(id: string): Promise<void> {
  const db = await getDb();
  await db.delete(STORE_STAGED_BLOBS, id);
}

export async function cleanupStaleStagedTransferBlobs(
  maxAgeMs: number,
): Promise<number> {
  const db = await getDb();
  const cutoff = Date.now() - maxAgeMs;

  const tx = db.transaction(STORE_STAGED_BLOBS, "readwrite");
  const index = tx.store.index("by-createdAt");
  const staleKeys = await index.getAllKeys(IDBKeyRange.upperBound(cutoff));

  for (const key of staleKeys) {
    await tx.store.delete(key);
  }

  await tx.done;
  return staleKeys.length;
}
