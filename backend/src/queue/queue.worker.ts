import { Worker, Job as BullJob } from "bullmq";
import { Prisma } from "@prisma/client";
import { redisOptions } from "../config/redis";
import { prisma } from "../config/prisma";
import { ExecuteJobPayload, JOB_NAMES } from "./queue.constants";
import { logger } from "../config/logger";
import { getJobExecutor } from "../executors/executor.registry";
import { env } from "../config/env";
import { HttpJobConfig } from "../executors/executor.interface";

// Active in-flight executions for graceful local cancellation
const activeControllers = new Map<string, AbortController>();

export function abortRunningExecution(jobRunId: string): boolean {
  const controller = activeControllers.get(jobRunId);
  if (controller) {
    controller.abort(new Error("Job cancelled by user"));
    activeControllers.delete(jobRunId);
    return true;
  }
  return false;
}

export function createWorker(queueName: string, concurrency: number = env.WORKER_CONCURRENCY): Worker {
  const worker = new Worker(
    queueName,
    async (bullJob: BullJob<ExecuteJobPayload>) => {
      if (bullJob.name !== JOB_NAMES.EXECUTE_JOB) return;

      const { jobId, jobRunId, executionType, payload } = bullJob.data;

      // 1. Check if the job run was already cancelled before starting execution
      const currentRun = await prisma.jobRun.findUnique({
        where: { id: jobRunId },
      });

      if (!currentRun || currentRun.status === "CANCELLED") {
        logger.info(`JobRun ${jobRunId} is cancelled or missing, skipping execution`);
        return;
      }

      // 2. Set status to RUNNING and record attempt & startedAt
      try {
        await prisma.jobRun.update({
          where: { id: jobRunId },
          data: {
            status: "RUNNING",
            attempt: bullJob.attemptsMade + 1,
            startedAt: new Date(),
          },
        });
      } catch (updateErr: any) {
        if (updateErr?.code === "P2025") return; // Record was deleted
        throw updateErr;
      }

      // 3. Register AbortController for in-flight cancellation
      const controller = new AbortController();
      activeControllers.set(jobRunId, controller);

      try {
        const executor = getJobExecutor(executionType);
        const result = await executor.execute(payload as unknown as HttpJobConfig, controller.signal);

        // 4. Update JobRun to COMPLETED (guard against CANCELLED race)
        try {
          const updateResult = await prisma.jobRun.updateMany({
            where: {
              id: jobRunId,
              status: { not: "CANCELLED" },
            },
            data: {
              status: "COMPLETED",
              httpStatus: result.httpStatus ?? 200,
              durationMs: result.durationMs,
              result: result as unknown as Prisma.InputJsonValue,
              finishedAt: new Date(),
            },
          });

          if (updateResult.count > 0) {
            await prisma.job.update({
              where: { id: jobId },
              data: { lastRunAt: new Date() },
            });
          }
        } catch (updateErr: any) {
          if (updateErr?.code !== "P2025") throw updateErr;
        }

        return result;
      } finally {
        activeControllers.delete(jobRunId);
      }
    },
    {
      connection: redisOptions,
      concurrency,
      lockDuration: 30000,
      stalledInterval: 30000,
    }
  );

  worker.on("failed", async (bullJob, err) => {
    if (!bullJob) return;
    const { jobRunId } = bullJob.data as ExecuteJobPayload;

    const totalAttempts = bullJob.opts.attempts ?? 1;
    // An error is final if attempts exhausted OR if error was unrecoverable
    const isUnrecoverable = err.name === "UnrecoverableError";
    const isFinalAttempt = isUnrecoverable || bullJob.attemptsMade >= totalAttempts;

    const executionResult = (err as any).executionResult;

    try {
      // Guard against race condition: only update if not already CANCELLED or COMPLETED
      await prisma.jobRun.updateMany({
        where: { id: jobRunId, status: { notIn: ["CANCELLED", "COMPLETED"] } },
        data: {
          status: isFinalAttempt ? "FAILED" : "RETRYING",
          httpStatus: executionResult?.httpStatus ?? null,
          durationMs: executionResult?.durationMs ?? null,
          result: executionResult ? (executionResult as Prisma.InputJsonValue) : undefined,
          error: err.message,
          finishedAt: isFinalAttempt ? new Date() : null,
        },
      });
    } catch (updateErr: any) {
      if (updateErr?.code !== "P2025") {
        logger.error(`Failed to update JobRun ${jobRunId} on failure`, { error: updateErr });
      }
    }

    logger.error(
      `Job ${bullJob.id} (run ${jobRunId}) ${isFinalAttempt ? "FAILED" : "RETRYING"} (attempt ${bullJob.attemptsMade}/${totalAttempts}): ${err.message}`
    );
  });

  worker.on("completed", (bullJob) => {
    logger.info(`Job ${bullJob.id} completed successfully on queue "${queueName}"`);
  });

  worker.on("stalled", (jobId) => {
    logger.warn(`Job ${jobId} stalled on queue "${queueName}", will be re-assigned`);
  });

  worker.on("error", (err) => {
    logger.error(`Worker error on queue "${queueName}"`, { error: err.message });
  });

  return worker;
}