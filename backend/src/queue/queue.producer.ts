import { Job as PrismaJob, BackoffType } from "@prisma/client";
import { getQueue } from "./queue.registry";
import { JOB_NAMES, ExecuteJobPayload } from "./queue.constants";
import { prisma } from "../config/prisma";
import { logger } from "../config/logger";

function toBullBackoffType(type: BackoffType): "fixed" | "exponential" {
  return type === BackoffType.FIXED ? "fixed" : "exponential";
}

export async function enqueueJob(job: PrismaJob, opts?: { delayMs?: number }) {
  const jobRun = await prisma.jobRun.create({
    data: {
      jobId: job.id,
      status: "PENDING",
      attempt: 1,
    },
  });

  const queue = getQueue(job.queueName);

  const payload: ExecuteJobPayload = {
    jobId: job.id,
    jobRunId: jobRun.id,
    payload: (job.payload as Record<string, unknown>) ?? {},
  };

  const bullJob = await queue.add(JOB_NAMES.EXECUTE_JOB, payload, {
    delay: opts?.delayMs,
    attempts: job.retryLimit,
    backoff: {
      type: toBullBackoffType(job.backoffType),
      delay: job.backoffDelayMs,
    },
    removeOnComplete: { age: 86400, count: 1000 },
    removeOnFail: { age: 604800 },
  });

  await prisma.jobRun.update({
    where: { id: jobRun.id },
    data: { bullJobId: bullJob.id },
  });

  return { jobRun, bullJobId: bullJob.id };
}

export async function cancelBullJob(queueName: string, bullJobId: string): Promise<boolean> {
  try {
    const queue = getQueue(queueName);
    const bullJob = await queue.getJob(bullJobId);
    if (!bullJob) return false;

    const state = await bullJob.getState();
    if (state === "completed" || state === "failed") return false;

    if (state === "active") {
      try {
        await bullJob.moveToFailed(new Error("Job cancelled by user"), "0", true);
      } catch (err: any) {
        logger.warn(`Could not moveToFailed for active job ${bullJobId}`, { error: err?.message });
        try {
          await bullJob.discard();
        } catch {
          // ignore
        }
      }
      return true;
    }

    await bullJob.remove();
    return true;
  } catch (err: any) {
    logger.error(`Error cancelling BullMQ job ${bullJobId}`, { error: err?.message });
    return false;
  }
}