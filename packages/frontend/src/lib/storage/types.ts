export interface BookMetadata {
  id: string; // UUID v4
  title: string;
  fileName: string;
  fileSize: number;
  pageCount: number;
  createdAt: number; // Unix timestamp
  lastReadAt: number; // Unix timestamp
  lastPosition: {
    pageIndex: number;
    audioTimestamp: number; // seconds
  };
  processingStatus: "queued" | "extracting" | "cleaning" | "synthesizing" | "ready" | "error";
  processingProgress: number; // 0 to 100
  errorMessage?: string;
  coverAccent?: string;
}

export interface BoundingBox {
  x: number;       // relative to page width
  y: number;       // relative to page height
  width: number;
  height: number;
}

export interface TextSegment {
  id: string;      // segment_{pageIndex}_{index}
  pageIndex: number;
  text: string;
  boundingBox: BoundingBox;
}

export interface PageModel {
  pageIndex: number;
  width: number;
  height: number;
  segments: TextSegment[];
}

export interface SentenceTiming {
  sentenceId: string;
  text: string;
  audioStart: number; // Global timeline timestamp (e.g., 145.2s)
  audioEnd: number;   // Global timeline timestamp (e.g., 148.5s)
  pageIndex: number;
  boundingBoxes: BoundingBox[]; // A sentence may span multiple bounding boxes / lines
  isChapterHeading?: boolean;
}

export interface DocumentAlignment {
  bookId: string;
  totalDuration: number;
  chunks: { id: string; duration: number }[];
  timings: SentenceTiming[];
}

export interface BookRepository {
  saveBook(metadata: BookMetadata): Promise<void>;
  getBook(id: string): Promise<BookMetadata | undefined>;
  listBooks(): Promise<BookMetadata[]>;
  deleteBook(id: string): Promise<void>;
  updateProcessingStatus(id: string, status: BookMetadata["processingStatus"], progress: number, error?: string): Promise<void>;

  savePdfBlob(bookId: string, blob: Blob): Promise<void>;
  getPdfBlob(bookId: string): Promise<Blob | undefined>;

  saveAudioBlob(bookId: string, chunkId: string, blob: Blob): Promise<void>;
  getAudioBlob(bookId: string, chunkId: string): Promise<Blob | undefined>;

  saveAlignmentMap(bookId: string, alignmentData: DocumentAlignment): Promise<void>;
  getAlignmentMap(bookId: string): Promise<DocumentAlignment | undefined>;
}
