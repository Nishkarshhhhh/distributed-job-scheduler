export const DEFAULT_QUEUE_NAME = "default";

export const JOB_NAMES = {
  EXECUTE_JOB: "execute-job",
} as const;

export interface ExecuteJobPayload {
  jobId: string;
  jobRunId: string;
  payload: Record<string, unknown>;
}