export const processingJobs = new Map<string, {
  status: "queued" | "extracting" | "cleaning" | "synthesizing" | "ready" | "error";
  progress: number;
  result?: any;
  error?: string;
}>();
