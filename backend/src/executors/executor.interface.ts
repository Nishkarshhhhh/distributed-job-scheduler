export type HttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

export interface HttpJobConfig {
  url: string;
  method?: HttpMethod;
  headers?: Record<string, string>;
  body?: unknown;
  timeoutMs?: number;
}

export interface JobExecutionResult {
  success: boolean;
  httpStatus?: number;
  durationMs: number;
  responseHeaders?: Record<string, string>;
  responseBody?: string;
  error?: string;
  retryable?: boolean;
}

export interface IJobExecutor {
  execute(config: HttpJobConfig, signal?: AbortSignal): Promise<JobExecutionResult>;
}
