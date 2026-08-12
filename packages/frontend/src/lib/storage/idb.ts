import { openDB, DBSchema, IDBPDatabase } from "idb";
import type { BookMetadata, BookRepository, DocumentAlignment } from "./types";

interface AudiobookDBSchema extends DBSchema {
  books: {
    key: string;
    value: BookMetadata;
    indexes: { "by-created": number; "by-last-read": number };
  };
  pdf_blobs: {
    key: string;
    value: Blob;
  };
  audio_blobs: {
    key: string; // "bookId_chunkId"
    value: Blob;
  };
  alignments: {
    key: string;
    value: DocumentAlignment;
  };
}

const DB_NAME = "pdf_audiobook_db";
const DB_VERSION = 1;

let dbPromise: Promise<IDBPDatabase<AudiobookDBSchema>> | null = null;

async function getDB() {
  if (!dbPromise) {
    dbPromise = openDB<AudiobookDBSchema>(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains("books")) {
          const store = db.createObjectStore("books", { keyPath: "id" });
          store.createIndex("by-created", "createdAt");
          store.createIndex("by-last-read", "lastReadAt");
        }
        if (!db.objectStoreNames.contains("pdf_blobs")) {
          db.createObjectStore("pdf_blobs");
        }
        if (!db.objectStoreNames.contains("audio_blobs")) {
          db.createObjectStore("audio_blobs");
        }
        if (!db.objectStoreNames.contains("alignments")) {
          db.createObjectStore("alignments");
        }
      },
    });
  }
  return dbPromise;
}

export const idbRepository: BookRepository = {
  async saveBook(metadata: BookMetadata) {
    const db = await getDB();
    await db.put("books", metadata);
  },

  async getBook(id: string) {
    const db = await getDB();
    return db.get("books", id);
  },

  async listBooks() {
    const db = await getDB();
    const books = await db.getAllFromIndex("books", "by-last-read");
    // Return sorted descending (newest / most recently read first)
    return books.reverse();
  },

  async deleteBook(id: string) {
    const db = await getDB();
    const tx = db.transaction(["books", "pdf_blobs", "audio_blobs", "alignments"], "readwrite");
    
    await tx.objectStore("books").delete(id);
    await tx.objectStore("pdf_blobs").delete(id);
    await tx.objectStore("alignments").delete(id);
    
    // Audio blobs are keyed by `${bookId}_${chunkId}`
    // We must manually find and delete them.
    const audioStore = tx.objectStore("audio_blobs");
    let cursor = await audioStore.openCursor();
    while (cursor) {
      if (cursor.key.startsWith(`${id}_`)) {
        await cursor.delete();
      }
      cursor = await cursor.continue();
    }
    
    await tx.done;
  },

  async updateProcessingStatus(id: string, status: BookMetadata["processingStatus"], progress: number, error?: string) {
    const db = await getDB();
    const book = await db.get("books", id);
    if (!book) return;
    book.processingStatus = status;
    book.processingProgress = progress;
    if (error) book.errorMessage = error;
    await db.put("books", book);
  },

  async savePdfBlob(bookId: string, blob: Blob) {
    const db = await getDB();
    await db.put("pdf_blobs", blob, bookId);
  },

  async getPdfBlob(bookId: string) {
    const db = await getDB();
    return db.get("pdf_blobs", bookId);
  },

  async saveAudioBlob(bookId: string, chunkId: string, blob: Blob) {
    const db = await getDB();
    await db.put("audio_blobs", blob, `${bookId}_${chunkId}`);
  },

  async getAudioBlob(bookId: string, chunkId: string) {
    const db = await getDB();
    return db.get("audio_blobs", `${bookId}_${chunkId}`);
  },

  async saveAlignmentMap(bookId: string, alignmentData: DocumentAlignment) {
    const db = await getDB();
    await db.put("alignments", alignmentData, bookId);
  },

  async getAlignmentMap(bookId: string) {
    const db = await getDB();
    return db.get("alignments", bookId);
  },
};
