import { NextResponse } from "next/server";
import { processingJobs } from "../../../../lib/storage/memory";

export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ jobId: string }> }
) {
  const { jobId } = await params;
  
  const job = processingJobs.get(jobId);
  
  if (!job) {
    return NextResponse.json({ error: "Job not found" }, { status: 404 });
  }

  return NextResponse.json({
    jobId,
    status: job.status,
    progress: job.progress,
    result: job.result,
    error: job.error
  });
}
