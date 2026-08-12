import { PDFExtract } from "pdf.js-extract";
import type { PageModel, TextSegment } from "../storage/types";

export interface PDFExtractionResult {
  pages: PageModel[];
  pageCount: number;
}

export async function extractPdf(buffer: Buffer): Promise<PDFExtractionResult> {
  console.log(`[extractor] Initializing PDFExtract for buffer size: ${buffer.byteLength}`);
  const pdfExtract = new PDFExtract();
  
  try {
    // Extract data from the PDF buffer
    console.log(`[extractor] Calling pdfExtract.extractBuffer...`);
    const data = await pdfExtract.extractBuffer(buffer, {
      // Optional configuration for pdf.js-extract
      disableCombineTextItems: false,
    });

    console.log(`[extractor] extractBuffer succeeded. Pages found: ${data.pages?.length || 0}`);
    const pages: PageModel[] = [];

    for (let i = 0; i < data.pages.length; i++) {
      const page = data.pages[i];
      const pageIndex = i; // 0-indexed

      const segments: TextSegment[] = [];

      // The page structure has .content array which contains { str, dir, width, height, x, y, fontName }
      for (let j = 0; j < page.content.length; j++) {
        const item = page.content[j];
        
        // Skip empty strings
        if (!item.str || item.str.trim() === "") continue;

        segments.push({
          id: `segment_${pageIndex}_${j}`,
          pageIndex,
          text: item.str,
          boundingBox: {
            x: item.x,
            y: item.y,
            width: item.width,
            height: item.height,
          },
        });
      }

      pages.push({
        pageIndex,
        width: page.info?.width || 800,
        height: page.info?.height || 1200,
        segments,
      });
    }

    console.log(`[extractor] Built PageModel array. Total segments across all pages: ${pages.reduce((acc, p) => acc + p.segments.length, 0)}`);
    return {
      pages,
      pageCount: data.pages.length,
    };
  } catch (err) {
    console.error(`[extractor] Fatal error during PDF extraction:`, err);
    throw err;
  }
}
