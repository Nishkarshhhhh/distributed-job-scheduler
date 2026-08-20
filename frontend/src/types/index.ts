export type Role = "ADMIN" | "USER";
export type JobType = "CRON" | "ONE_TIME";
export type JobStatus = "ACTIVE" | "PAUSED" | "DISABLED";
export type JobRunStatus = "PENDING" | "RUNNING" | "COMPLETED" | "FAILED" | "RETRYING" | "CANCELLED";
export type BackoffType = "FIXED" | "EXPONENTIAL";

export interface User {
  id: string;
  name: string;
  email: string;
  role: Role;
}

export interface AuthResponse {
  success: boolean;
  data: {
    user: User;
    token: string;
  };
}

export interface Job {
  id: string;
  name: string;
  description?: string | null;
  type: JobType;
  cronExpression?: string | null;
  payload: Record<string, unknown>;
  queueName: string;
  status: JobStatus;
  retryLimit: number;
  backoffType: BackoffType;
  backoffDelayMs: number;
  timeoutMs: number;
  nextRunAt?: string | null;
  lastRunAt?: string | null;
  ownerId: string;
  createdAt: string;
  updatedAt: string;
}

export interface JobRun {
  id: string;
  jobId: string;
  bullJobId?: string | null;
  status: JobRunStatus;
  attempt: number;
  result?: Record<string, unknown> | null;
  error?: string | null;
  startedAt?: string | null;
  finishedAt?: string | null;
  createdAt: string;
}

export interface PaginatedJobs {
  success: boolean;
  items: Job[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface CreateJobInput {
  name: string;
  description?: string;
  type: JobType;
  cronExpression?: string;
  payload?: Record<string, unknown>;
  queueName?: string;
  retryLimit?: number;
  backoffType?: BackoffType;
  backoffDelayMs?: number;
  timeoutMs?: number;
  runAt?: string;
}