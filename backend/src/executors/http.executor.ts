import { UnrecoverableError } from "bullmq";
import { HttpJobConfig, IJobExecutor, JobExecutionResult, HttpMethod } from "./executor.interface";
import { validateTargetUrl } from "./ssrf.validator";

const MAX_RESPONSE_BODY_BYTES = 32 * 1024; // 32 KB
const MAX_TIMEOUT_MS = 300_000; // 5 minutes max timeout
const DEFAULT_TIMEOUT_MS = 30_000; // 30 seconds default
const SENSITIVE_HEADERS = new Set([
  "authorization",
  "cookie",
  "set-cookie",
  "x-api-key",
  "api-key",
  "proxy-authorization",
]);

export class HttpExecutor implements IJobExecutor {
  async execute(config: HttpJobConfig, parentSignal?: AbortSignal): Promise<JobExecutionResult> {
    const startTime = Date.now();

    // 1. Validate URL presence & configuration
    if (!config || !config.url || typeof config.url !== "string" || config.url.trim() === "") {
      const errorMsg = "HTTP job is missing a valid URL";
      const unrec = new UnrecoverableError(errorMsg);
      (unrec as any).executionResult = {
        success: false,
        durationMs: 0,
        error: errorMsg,
        retryable: false,
      };
      throw unrec;
    }

    // 2. Validate URL & SSRF
    let validatedUrl: URL;
    try {
      validatedUrl = await validateTargetUrl(config.url);
    } catch (urlErr: any) {
      const errorMsg = urlErr.message || "Invalid URL format";
      const unrec = new UnrecoverableError(errorMsg);
      (unrec as any).executionResult = {
        success: false,
        durationMs: 0,
        error: errorMsg,
        retryable: false,
      };
      throw unrec;
    }

    // 3. Validate Method
    const method: HttpMethod = (config.method?.toUpperCase() as HttpMethod) || "GET";
    const allowedMethods: HttpMethod[] = ["GET", "POST", "PUT", "PATCH", "DELETE"];
    if (!allowedMethods.includes(method)) {
      const errorMsg = `Unsupported HTTP method "${method}"`;
      const unrec = new UnrecoverableError(errorMsg);
      (unrec as any).executionResult = {
        success: false,
        durationMs: 0,
        error: errorMsg,
        retryable: false,
      };
      throw unrec;
    }

    // 4. Setup Timeout & AbortController
    const timeoutMs = Math.min(
      Math.max(1000, config.timeoutMs ?? DEFAULT_TIMEOUT_MS),
      MAX_TIMEOUT_MS
    );

    const controller = new AbortController();
    const timeoutHandle = setTimeout(() => {
      controller.abort(new Error(`HTTP request timed out after ${timeoutMs}ms`));
    }, timeoutMs);

    // Link parent abort signal if provided
    let abortListener: (() => void) | undefined;
    if (parentSignal) {
      if (parentSignal.aborted) {
        clearTimeout(timeoutHandle);
        throw new Error("Job execution aborted by user");
      }
      abortListener = () => {
        controller.abort(new Error("Job execution aborted by user"));
      };
      parentSignal.addEventListener("abort", abortListener, { once: true });
    }

    try {
      // 5. Prepare Headers & Body
      const headers: Record<string, string> = {
        "User-Agent": "JobScheduler-Worker/1.0",
        Accept: "application/json, text/plain, */*",
        ...(config.headers ?? {}),
      };

      let body: string | undefined;
      if (config.body !== undefined && config.body !== null && method !== "GET") {
        if (typeof config.body === "string") {
          body = config.body;
        } else {
          body = JSON.stringify(config.body);
          if (!headers["Content-Type"] && !headers["content-type"]) {
            headers["Content-Type"] = "application/json";
          }
        }
      }

      // 6. Execute HTTP Request
      const response = await fetch(validatedUrl.toString(), {
        method,
        headers,
        body,
        signal: controller.signal,
      });

      const durationMs = Date.now() - startTime;

      // 7. Capture response body (safely truncated)
      let rawBody = "";
      try {
        const text = await response.text();
        if (text.length > MAX_RESPONSE_BODY_BYTES) {
          rawBody = text.slice(0, MAX_RESPONSE_BODY_BYTES) + `... [truncated after ${MAX_RESPONSE_BODY_BYTES} bytes]`;
        } else {
          rawBody = text;
        }
      } catch (err: any) {
        rawBody = `[Failed to read response body: ${err?.message}]`;
      }

      // 8. Capture response headers
      const responseHeaders: Record<string, string> = {};
      response.headers.forEach((val, key) => {
        if (!SENSITIVE_HEADERS.has(key.toLowerCase())) {
          responseHeaders[key] = val;
        }
      });

      const isSuccess = response.status >= 200 && response.status < 300;
      const isClientError = response.status >= 400 && response.status < 500;

      const result: JobExecutionResult = {
        success: isSuccess,
        httpStatus: response.status,
        durationMs,
        responseHeaders,
        responseBody: rawBody,
        retryable: !isSuccess && !isClientError, // 5xx and network errors are retryable; 4xx are client errors
      };

      // If client error (4xx), do not retry — fail unrecoverably with response details
      if (isClientError) {
        const errorMsg = `HTTP ${response.status} ${response.statusText}`;
        const error = new UnrecoverableError(errorMsg);
        (error as any).executionResult = result;
        throw error;
      }

      // If server error (5xx), throw retryable error for BullMQ backoff
      if (!isSuccess) {
        const errorMsg = `HTTP ${response.status} ${response.statusText}`;
        const error = new Error(errorMsg);
        (error as any).executionResult = result;
        throw error;
      }

      return result;
    } catch (err: any) {
      const durationMs = Date.now() - startTime;
      if (err instanceof UnrecoverableError) {
        throw err;
      }

      const isAbort = controller.signal.aborted;
      const isTimeout = isAbort && controller.signal.reason?.message?.includes("timed out");
      const isCancelled = isAbort && !isTimeout;

      const errorMsg = isTimeout
        ? `Request timed out after ${timeoutMs}ms`
        : isCancelled
        ? "Request cancelled by user"
        : err?.message || "HTTP request failed";

      const executionResult: JobExecutionResult = err.executionResult || {
        success: false,
        durationMs,
        error: errorMsg,
        retryable: !isCancelled && !err.message?.includes("SSRF protection"),
      };

      if (isCancelled || err.message?.includes("SSRF protection")) {
        const unrec = new UnrecoverableError(errorMsg);
        (unrec as any).executionResult = executionResult;
        throw unrec;
      }

      const retryError = new Error(errorMsg);
      (retryError as any).executionResult = executionResult;
      throw retryError;
    } finally {
      clearTimeout(timeoutHandle);
      if (parentSignal && abortListener) {
        parentSignal.removeEventListener("abort", abortListener);
      }
    }
  }
}
