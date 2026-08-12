import { NextResponse } from "next/server";
import { v4 as uuidv4 } from "uuid";
import { extractPdf } from "../../../lib/documents/extractor";
import { processPdfText } from "../../../lib/documents/pipeline";
import type { DocumentAlignment, SentenceTiming } from "../../../lib/storage/types";
import { processingJobs } from "../../../lib/storage/memory";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get("file") as File;
    const title = formData.get("title") as string || file.name.replace(/\.[^/.]+$/, "");
    
    if (!file) {
      return NextResponse.json({ error: "No file uploaded" }, { status: 400 });
    }

    const jobId = uuidv4();
    const bookId = uuidv4();
    
    processingJobs.set(jobId, { status: "queued", progress: 0 });

    // Read file buffer
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Fire & Forget background processing
    processJob(jobId, bookId, title, buffer, file.name).catch(console.error);

    return NextResponse.json({ jobId, bookId, status: "queued" }, { status: 202 });

  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

async function processJob(jobId: string, bookId: string, title: string, buffer: Buffer, fileName: string) {
  console.log(`[Job ${jobId}] Starting processJob for file: ${fileName} (${buffer.byteLength} bytes)`);
  try {
    // 1. Extraction
    console.log(`[Job ${jobId}] Phase 1: Extracting PDF...`);
    processingJobs.set(jobId, { status: "extracting", progress: 20 });
    const extractionResult = await extractPdf(buffer);
    console.log(`[Job ${jobId}] Phase 1 Complete. Extracted ${extractionResult.pageCount} pages.`);
    
    // 2. Cleaning & Pipeline
    console.log(`[Job ${jobId}] Phase 2: Cleaning text...`);
    processingJobs.set(jobId, { status: "cleaning", progress: 60 });
    const sentences = processPdfText(extractionResult.pages);
    console.log(`[Job ${jobId}] Phase 2 Complete. Found ${sentences.length} cleaned sentences.`);
    
    // 3. Generate Pseudo-Alignments for Web Speech API
    // Estimate durations based on average speaking rate (~15 chars per second)
    processingJobs.set(jobId, { status: "synthesizing", progress: 90 });
    let runningTime = 0;
    const timings: SentenceTiming[] = sentences.map((sentence, index) => {
      const durationSeconds = Math.max(1.5, sentence.text.length / 15);
      const start = runningTime;
      const end = runningTime + durationSeconds;
      runningTime = end;
      return {
        sentenceId: `sentence_${index}`,
        text: sentence.text,
        audioStart: start,
        audioEnd: end,
        pageIndex: sentence.pageIndex,
        boundingBoxes: sentence.boundingBoxes,
        isChapterHeading: sentence.isChapterHeading,
      };
    });

    const alignmentData = {
      timings,
      totalDuration: runningTime,
    };

    // 4. Ready
    console.log(`[Job ${jobId}] Job finished successfully! Marked as ready.`);
    processingJobs.set(jobId, { 
      status: "ready", 
      progress: 100,
      result: {
        bookId,
        title,
        fileName,
        pageCount: extractionResult.pageCount,
        alignmentData, // Send data directly instead of URL
        // No audioChunks or temp files needed anymore!
      }
    });

  } catch (error: any) {
    console.error(`[Job ${jobId}] ERROR in processJob:`, error);
    processingJobs.set(jobId, { status: "error", progress: 0, error: error.message });
  }
}
