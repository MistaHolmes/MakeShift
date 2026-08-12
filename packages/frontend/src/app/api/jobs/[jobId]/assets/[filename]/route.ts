import { NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";

export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ jobId: string, filename: string }> }
) {
  const { jobId, filename } = await params;
  
  try {
    const filePath = path.join(process.cwd(), "tmp", jobId, filename);
    const fileBuffer = await fs.readFile(filePath);

    let contentType = "application/octet-stream";
    if (filename.endsWith(".mp3")) contentType = "audio/mpeg";
    if (filename.endsWith(".json")) contentType = "application/json";
    if (filename.endsWith(".pdf")) contentType = "application/pdf";

    return new NextResponse(fileBuffer, {
      headers: {
        "Content-Type": contentType,
      },
    });
  } catch (error) {
    return NextResponse.json({ error: "File not found" }, { status: 404 });
  }
}
