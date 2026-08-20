import { JobExecutionType } from "@prisma/client";

export const DEFAULT_QUEUE_NAME = "default";

export const JOB_NAMES = {
  EXECUTE_JOB: "execute-job",
} as const;

export interface ExecuteJobPayload {
  jobId: string;
  jobRunId: string;
  executionType?: JobExecutionType;
  payload: Record<string, unknown>;
}