import { openDB } from "idb";

const DB_NAME = "makeshift_db";
const STORE_NAME = "pdf_files";

async function getDB() {
  return openDB(DB_NAME, 1, {
    upgrade(db) {
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    },
  });
}

export async function savePdfBlob(bookId: string, blob: Blob) {
  const db = await getDB();
  await db.put(STORE_NAME, blob, bookId);
}

export async function getPdfBlob(bookId: string): Promise<Blob | undefined> {
  const db = await getDB();
  return db.get(STORE_NAME, bookId);
}

export async function deletePdfBlob(bookId: string) {
  const db = await getDB();
  await db.delete(STORE_NAME, bookId);
}
