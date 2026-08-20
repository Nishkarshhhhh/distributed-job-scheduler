import { Worker, Job as BullJob } from "bullmq";
import { Prisma } from "@prisma/client";
import { redisOptions } from "../config/redis";
import { prisma } from "../config/prisma";
import { ExecuteJobPayload, JOB_NAMES } from "./queue.constants";
import { logger } from "../config/logger";

const CONCURRENCY = 5;

async function runJobHandler(payload: ExecuteJobPayload): Promise<Record<string, unknown>> {
  // Placeholder execution strategy: real job "work" plugs in here.
  // For now, jobs are simulated as successful after processing their payload.
  await new Promise((resolve) => setTimeout(resolve, 500));
  return { executedAt: new Date().toISOString(), receivedPayload: payload.payload };
}

export function createWorker(queueName: string): Worker {
  const worker = new Worker(
    queueName,
    async (bullJob: BullJob<ExecuteJobPayload>) => {
      if (bullJob.name !== JOB_NAMES.EXECUTE_JOB) return;

      const { jobId, jobRunId } = bullJob.data;

      // Check if the job run was already cancelled before starting execution
      const currentRun = await prisma.jobRun.findUnique({
        where: { id: jobRunId },
      });

      if (!currentRun || currentRun.status === "CANCELLED") {
        logger.info(`JobRun ${jobRunId} is cancelled or missing, skipping execution`);
        return;
      }

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
        if (updateErr?.code === "P2025") return;
        throw updateErr;
      }

      const result = await runJobHandler(bullJob.data);

      // Guard against race condition: only update to COMPLETED if not CANCELLED
      try {
        const updateResult = await prisma.jobRun.updateMany({
          where: {
            id: jobRunId,
            status: { not: "CANCELLED" },
          },
          data: {
            status: "COMPLETED",
            result: result as Prisma.InputJsonValue,
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
    },
    { connection: redisOptions, concurrency: CONCURRENCY }
  );

  worker.on("failed", async (bullJob, err) => {
    if (!bullJob) return;
    const { jobRunId } = bullJob.data as ExecuteJobPayload;

    const isFinalAttempt = bullJob.attemptsMade >= (bullJob.opts.attempts ?? 1);

    try {
      // Guard against race condition: only update if not already CANCELLED
      await prisma.jobRun.updateMany({
        where: { id: jobRunId, status: { not: "CANCELLED" } },
        data: {
          status: isFinalAttempt ? "FAILED" : "RETRYING",
          error: err.message,
          finishedAt: isFinalAttempt ? new Date() : null,
        },
      });
    } catch (updateErr: any) {
      if (updateErr?.code !== "P2025") {
        logger.error(`Failed to update JobRun ${jobRunId}`, { error: updateErr });
      }
      // P2025 = record no longer exists (e.g. job was deleted); safe to ignore
    }

    logger.error(`Job ${bullJob.id} failed (attempt ${bullJob.attemptsMade})`, {
      error: err.message,
    });
  });

  worker.on("completed", (bullJob) => {
    logger.info(`Job ${bullJob.id} completed on queue "${queueName}"`);
  });

  return worker;
}